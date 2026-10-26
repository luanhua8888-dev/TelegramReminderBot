import { existsSync } from "node:fs";
import { createBot } from "./bot.ts";
import { config, llmEnabled } from "./config.ts";
import { openDb } from "./db.ts";
import { startScheduler } from "./scheduler.ts";
import { createTaskService } from "./tasks.ts";
import { startZaloBridge } from "./zalo.ts";

const db = openDb(config.dbPath);
const tasks = createTaskService(db);
const bot = createBot(db, tasks);

await bot.api.setMyCommands([
  { command: "list", description: "Việc chưa xong" },
  { command: "today", description: "Việc hôm nay" },
  { command: "move", description: "Dời giờ: /move 12 mai 10h" },
  { command: "done", description: "Xong: /done 12" },
  { command: "del", description: "Xoá: /del 12" },
  { command: "zalo", description: "Kết nối Zalo (lấy mã QR)" },
  { command: "help", description: "Hướng dẫn" },
]);

const stopScheduler = startScheduler(db, bot.api);

if (config.zalo.enabled) {
  if (existsSync(config.zalo.credentialsPath)) {
    startZaloBridge(tasks, bot.api).catch((err) => console.error("[zalo] không khởi động được:", err.message ?? err));
  } else {
    console.log("[zalo] chưa đăng nhập, gõ /zalo trên Telegram để lấy mã QR");
  }
}

if (!config.allowedChatIds.length) {
  console.warn("⚠️  ALLOWED_CHAT_IDS đang trống: ai nhắn bot cũng dùng được. Nhắn /id cho bot rồi điền vào .env.");
}

const shutdown = async () => {
  stopScheduler();
  await bot.stop();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

await bot.start({
  drop_pending_updates: false,
  onStart: (me) => console.log(`🤖 @${me.username} đang chạy | parser: ${llmEnabled ? `LLM (${config.llm.model})` : "luật"} | Zalo: ${config.zalo.enabled ? "bật" : "tắt"}`),
});
