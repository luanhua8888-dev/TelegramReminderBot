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
  // Rỗng = ai cũng dùng được bot (chỉ nên để rỗng lúc mới setup để lấy chat id)
  allowedChatIds,
  // Chat nhận note từ Zalo và tin nhắn hệ thống
  ownerChatId: allowedChatIds[0],
  dbPath: process.env.DB_PATH ?? "data/reminders.db",
  // Việt Nam = UTC+7, không có giờ mùa hè nên dùng offset cố định
  tzOffsetMin: num("TZ_OFFSET_MIN", 420),
  // Chưa bấm "Xong" thì nhắc lại sau bao nhiêu phút, tối đa bao nhiêu lần
  repeatEveryMin: num("REPEAT_EVERY_MIN", 15),
  maxRepeats: num("MAX_REPEATS", 6),
  // Giờ gửi bản tóm tắt việc trong ngày (-1 để tắt)
  digestHour: num("DIGEST_HOUR", 7),
  // Giờ mặc định khi chỉ nói ngày mà không nói giờ
  defaultHour: num("DEFAULT_HOUR", 9),
  // Khung giờ để LLM tự xếp lịch
  workStartHour: num("WORK_START_HOUR", 8),
  workEndHour: num("WORK_END_HOUR", 21),
  llm: {
    apiKey: process.env.LLM_API_KEY ?? "",
    // Endpoint kiểu OpenAI: OpenAI, OpenRouter, Ollama, ... đều dùng được
    baseUrl: (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.LLM_MODEL ?? "",
  },
  zalo: {
    enabled: process.env.ZALO_ENABLED === "1",
    credentialsPath: process.env.ZALO_CREDENTIALS_PATH ?? "data/zalo-credentials.json",
    // 1 = nhận cả "#note" do người khác gửi cho mình, mặc định chỉ nhận tin của chính mình
    acceptFromOthers: process.env.ZALO_ACCEPT_FROM_OTHERS === "1",
  },
};

export const llmEnabled = Boolean(config.llm.model && (config.llm.apiKey || !config.llm.baseUrl.includes("openai.com")));
