function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${name} phải là số, đang là "${raw}"`);
  return n;
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Thiếu TELEGRAM_BOT_TOKEN. Copy .env.example thành .env rồi điền token từ @BotFather.");
  process.exit(1);
}

const allowedChatIds = (process.env.ALLOWED_CHAT_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

export const config = {
  telegramToken: token,
  // Rỗng = ai cũng dùng được bot
  allowedChatIds,
  // Chủ bot: nhận note từ Zalo, được dùng /zalo. Mặc định = chat id đầu tiên trong ALLOWED_CHAT_IDS
  ownerChatId: process.env.OWNER_CHAT_ID ? Number(process.env.OWNER_CHAT_ID) : allowedChatIds[0],
  // Chống spam khi mở cho mọi người
  maxPendingPerChat: num("MAX_PENDING_PER_CHAT", 200),
  maxNotesPerMinute: num("MAX_NOTES_PER_MINUTE", 20),
  dbPath: process.env.DB_PATH ?? "data/reminders.db",
  // Việt Nam = UTC+7, không có giờ mùa hè nên dùng offset cố định
  tzOffsetMin: num("TZ_OFFSET_MIN", 420),
  // Chưa bấm "Xong" thì nhắc lại sau bao nhiêu phút, tối đa bao nhiêu lần
  repeatEveryMin: num("REPEAT_EVERY_MIN", 5),
  maxRepeats: num("MAX_REPEATS", 6),
  // Giờ gửi bản tóm tắt việc trong ngày (-1 để tắt)
  digestHour: num("DIGEST_HOUR", 7),
  // Giờ mặc định khi chỉ nói ngày mà không nói giờ
  defaultHour: num("DEFAULT_HOUR", 9),
  // Việc không có giờ: 1 = tự xếp vào khung trống, 0 = để trong inbox
  autoSchedule: process.env.AUTO_SCHEDULE !== "0",
  // Khung giờ được tự xếp việc
  workStartHour: num("WORK_START_HOUR", 8),
  workEndHour: num("WORK_END_HOUR", 21),
  llm: {
    apiKey: process.env.LLM_API_KEY ?? "",
    // Endpoint kiểu OpenAI: OpenAI, OpenRouter, Ollama, ... đều dùng được
    baseUrl: (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.LLM_MODEL ?? "",
    // Model local chạy CPU có thể mất vài chục giây ở lần gọi đầu (nạp model)
    timeoutMs: num("LLM_TIMEOUT_SEC", 60) * 1000,
  },
  stt: {
    apiKey: process.env.STT_API_KEY ?? process.env.LLM_API_KEY ?? "",
    // Mặc định Groq hoặc OpenAI
    baseUrl: (process.env.STT_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.STT_MODEL ?? "whisper-1",
    language: process.env.STT_LANGUAGE ?? "vi",
  },
  zalo: {
    enabled: process.env.ZALO_ENABLED === "1",
    credentialsPath: process.env.ZALO_CREDENTIALS_PATH ?? "data/zalo-credentials.json",
    // 1 = nhận cả "#note" do người khác gửi cho mình, mặc định chỉ nhận tin của chính mình
    acceptFromOthers: process.env.ZALO_ACCEPT_FROM_OTHERS === "1",
  },
};

function isLocalEndpoint(url: string): boolean {
  return url.startsWith("http://") || url.includes("localhost") || url.includes("127.0.0.1");
}

export const llmEnabled = Boolean(config.llm.model && (config.llm.apiKey || isLocalEndpoint(config.llm.baseUrl)));
export const sttEnabled = Boolean(config.stt.apiKey || isLocalEndpoint(config.stt.baseUrl));
