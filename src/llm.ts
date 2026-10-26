// Parser bằng LLM qua endpoint kiểu OpenAI (/chat/completions).
// Đổi LLM_BASE_URL + LLM_MODEL là chạy được với OpenAI, OpenRouter, Ollama, LM Studio...

import { config } from "./config.ts";
import type { Parsed, Recurring } from "./parser.ts";
import { parseLocalIso, toLocal, toLocalIso, weekdayName } from "./time.ts";

export type Busy = { text: string; dueAt: number };

const SYSTEM_PROMPT = `Bạn là bộ phân tích lời nhắc việc tiếng Việt. Người dùng gõ nhanh một ghi chú, bạn tách ra:
- "text": nội dung việc cần làm, ngắn gọn, bỏ các phần chỉ thời gian và các từ thừa như "nhắc tôi", "nhớ".
- "due": thời điểm nhắc, định dạng "YYYY-MM-DD HH:mm" theo giờ địa phương.
- "recurring": "daily", "weekly" hoặc "none".
- "auto": true nếu bạn tự chọn giờ vì người dùng không nói, false nếu người dùng đã nói rõ.

Quy tắc:
- Hiểu cách nói tự nhiên: "mai", "mốt", "tối nay", "thứ 6 tuần sau", "30p nữa", "3h chiều", "cuối tuần", "đầu tháng sau".
- "3h", "4h" không nói buổi → hiểu là buổi chiều.
- Nếu người dùng không nói thời gian: tự xếp một khung giờ hợp lý trong khoảng WORK_HOURS, ưu tiên sớm nhất có thể
  (ít nhất 30 phút sau hiện tại), tránh trùng ±30 phút với các việc đã có. Việc gấp thì xếp sớm, việc nhẹ có thể để chiều/tối.
- Không bao giờ trả về thời điểm trong quá khứ.
Chỉ trả về JSON: {"text": string, "due": string, "recurring": "daily"|"weekly"|"none", "auto": boolean}`;

export async function llmParse(input: string, now: number, busy: Busy[]): Promise<(Parsed & { auto: boolean }) | null> {
  const off = config.tzOffsetMin;
  const nowParts = toLocal(now, off);
  const schedule = busy.length
    ? busy.map((b) => `- ${toLocalIso(b.dueAt, off)}: ${b.text}`).join("\n")
    : "(trống)";
  const userMsg = `Bây giờ là ${toLocalIso(now, off)} (${weekdayName(nowParts.dow)}).
Các việc đã có lịch:
${schedule}

Ghi chú: ${input}`;

  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.llm.apiKey ? { Authorization: `Bearer ${config.llm.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.llm.model,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT.replace("WORK_HOURS", `${config.workStartHour}h–${config.workEndHour}h`),
        },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = body.choices?.[0]?.message?.content;
  if (!raw) return null;
  const json = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as {
    text?: unknown;
    due?: unknown;
    recurring?: unknown;
    auto?: unknown;
  };

  const text = typeof json.text === "string" && json.text.trim() ? json.text.trim() : input;
  let dueAt = typeof json.due === "string" ? parseLocalIso(json.due, off) : null;
  if (dueAt !== null && dueAt < now - 60_000) dueAt = null; // LLM trả về quá khứ → coi như không hợp lệ
  if (dueAt === null) return null;
  const recurring: Recurring = json.recurring === "daily" || json.recurring === "weekly" ? json.recurring : null;
  return { text, dueAt, recurring, auto: json.auto === true };
}
