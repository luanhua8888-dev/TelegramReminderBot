import type { Api } from "grammy";
import { config } from "./config.ts";
import type { Db } from "./db.ts";
import { escapeHtml, formatTask, reminderKeyboard } from "./tasks.ts";
import { DAY, startOfLocalDay, toLocal, toLocalIso } from "./time.ts";

const TICK_MS = 30_000;

export function startScheduler(db: Db, api: Api): () => void {
  let running = false;

  async function tick() {
    if (running) return; // tick trước chưa xong (mạng chậm) thì bỏ qua
    running = true;
    try {
      await sendDueReminders();
      await sendDailyDigest();
    } catch (err) {
      console.error("[scheduler]", err);
    } finally {
      running = false;
    }
  }

  async function sendDueReminders() {
    const now = Date.now();
    for (const task of db.tasksToRemind(now)) {
      const isRepeat = task.remind_count > 0;
      const last = task.remind_count + 1 >= config.maxRepeats;
      const header = isRepeat ? `🔔 Nhắc lại (lần ${task.remind_count + 1})` : "🔔 Đến giờ rồi";
      const footer = last ? "\n<i>Đây là lần nhắc cuối, bấm 📅 để dời nếu chưa làm.</i>" : "";
      try {
        await api.sendMessage(task.chat_id, `${header}\n\n<b>${escapeHtml(task.text)}</b>${footer}`, {
          parse_mode: "HTML",
          reply_markup: reminderKeyboard(task.id),
        });
      } catch (err) {
        console.error(`[scheduler] gửi #${task.id} lỗi:`, (err as Error).message);
        continue; // để tick sau thử lại
      }
      db.markReminded(task.id, last ? null : now + config.repeatEveryMin * 60_000);
    }
  }

  async function sendDailyDigest() {
    if (config.digestHour < 0) return;
    const now = Date.now();
    const off = config.tzOffsetMin;
    if (toLocal(now, off).h < config.digestHour) return;
    const today = toLocalIso(now, off).slice(0, 10);
    if (db.getMeta("digest_date") === today) return;
    db.setMeta("digest_date", today);

    const endOfDay = startOfLocalDay(now, off) + DAY;
    for (const chatId of db.activeChats()) {
      const pending = db.pendingTasks(chatId);
      const todayTasks = pending.filter((t) => t.due_at !== null && t.due_at < endOfDay);
      const inbox = pending.filter((t) => t.due_at === null);
      if (!todayTasks.length && !inbox.length) continue;
      const lines = ["☀️ <b>Việc hôm nay</b>"];
      lines.push(...(todayTasks.length ? todayTasks.map(formatTask) : ["(không có)"]));
      if (inbox.length) lines.push("", "📥 <b>Inbox chưa có giờ</b>", ...inbox.map(formatTask));
      await api.sendMessage(chatId, lines.join("\n"), { parse_mode: "HTML" }).catch((err) => {
        console.error("[digest]", (err as Error).message);
      });
    }
  }

  void tick();
  const timer = setInterval(tick, TICK_MS);
  return () => clearInterval(timer);
}
