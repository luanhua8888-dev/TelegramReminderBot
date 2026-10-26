// Parser bằng LLM qua endpoint kiểu OpenAI (/chat/completions).
// Đổi LLM_BASE_URL + LLM_MODEL là chạy được với OpenAI, OpenRouter, Ollama, LM Studio...
// Chỉ được gọi khi parser luật không tìm thấy thời gian ("cuối tuần", "đầu tháng sau"...).
// Model nhỏ tính ngày rất kém, nên đưa sẵn bảng lịch để nó tra thay vì tự cộng ngày.

import { config } from "./config.ts";
import type { Parsed, Recurring } from "./parser.ts";
import { DAY, nextTet, parseLocalIso, startOfLocalDay, toLocal, toLocalIso, weekdayName } from "./time.ts";

const SYSTEM_PROMPT = `Bạn tách ghi chú nhắc việc tiếng Việt thành JSON:
{"text": string, "has_time": boolean, "due": "YYYY-MM-DD HH:mm" | null, "recurring": "daily" | "weekly" | "none"}

- "text": việc cần làm, bỏ phần chỉ thời gian và các từ như "nhắc tôi", "nhớ". Giữ nguyên tên người.
- "has_time": true CHỈ KHI ghi chú có nói thời điểm (ví dụ "cuối tuần", "đầu tháng sau", "tối mai", "sau Tết").
  Tên người như "chị Mai" không phải thời gian. Không nói thời điểm → false và "due": null.
- "due": tra ngày trong BẢNG LỊCH, không tự tính. Không nói giờ thì dùng DEFAULT_HOUR:00.
  "cuối tuần" = thứ 7 gần nhất. "đầu tháng sau" = ngày 1 tháng sau. "Tết" = Tết Nguyên Đán (TET_DATE).
- Chỉ trả về JSON.

Ví dụ (giả sử hôm nay 2026-03-10):
"ngày 20 tháng sau trả tiền nhà" → {"text":"trả tiền nhà","has_time":true,"due":"2026-04-20 DEFAULT_HOUR:00","recurring":"none"}
"sau Tết đi khám răng" → {"text":"đi khám răng","has_time":true,"due":"<ngày sau Tết> DEFAULT_HOUR:00","recurring":"none"}
"mua sữa" → {"text":"mua sữa","has_time":false,"due":null,"recurring":"none"}
"gọi chị Mai" → {"text":"gọi chị Mai","has_time":false,"due":null,"recurring":"none"}`;

function calendar(now: number): string {
  const off = config.tzOffsetMin;
  const today = startOfLocalDay(now, off);
  return Array.from({ length: 14 }, (_, i) => {
    const d = today + i * DAY;
    const label = i === 0 ? " (hôm nay)" : i === 1 ? " (mai)" : "";
    return `${toLocalIso(d, off).slice(0, 10)} ${weekdayName(toLocal(d, off).dow)}${label}`;
  }).join("\n");
}

/** dueAt = null khi ghi chú không nói thời gian. Trả về null nếu LLM trả lời không dùng được. */
export async function llmParse(input: string, now: number): Promise<Parsed | null> {
  const off = config.tzOffsetMin;
  const userMsg = `Bây giờ: ${toLocalIso(now, off)} (${weekdayName(toLocal(now, off).dow)})
BẢNG LỊCH:
${calendar(now)}

Ghi chú: ${input}`;

  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.llm.apiKey ? { Authorization: `Bearer ${config.llm.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.llm.model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT.replaceAll("DEFAULT_HOUR", String(config.defaultHour).padStart(2, "0")).replace(
            "TET_DATE",
            `mùng 1 Tết sắp tới: ${nextTet(now, off) ?? "không rõ"}`,
          ),
        },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(config.llm.timeoutMs),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = body.choices?.[0]?.message?.content;
  if (!raw) return null;
  const json = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as {
    text?: unknown;
    has_time?: unknown;
    due?: unknown;
    recurring?: unknown;
  };

  const text = typeof json.text === "string" && json.text.trim() ? json.text.trim() : input;
  const recurring: Recurring = json.recurring === "daily" || json.recurring === "weekly" ? json.recurring : null;
  if (json.has_time !== true) return { text, dueAt: null, recurring };
  const dueAt = typeof json.due === "string" ? parseLocalIso(json.due, off) : null;
  // Quá khứ hoặc xa hơn 1 năm → coi như LLM đoán bậy
  if (dueAt === null || dueAt < now - 60_000 || dueAt > now + 366 * DAY) return null;
  return { text, dueAt, recurring };
}
