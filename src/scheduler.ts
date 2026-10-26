import type { Api } from "grammy";
import { config } from "./config.ts";
import type { Db } from "./db.ts";
import { escapeHtml, formatReminder, formatTaskCard, reminderKeyboard } from "./tasks.ts";
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
      const last = task.remind_count + 1 >= config.maxRepeats;
      const msg = formatReminder(task, config.maxRepeats);

      // Xoá tin nhắc cũ nếu có để tránh ngập màn hình chat
      if (task.last_msg_id) {
        await api.deleteMessage(task.chat_id, task.last_msg_id).catch(() => {});
      }

      try {
        const sent = await api.sendMessage(task.chat_id, msg, {
          parse_mode: "HTML",
          reply_markup: reminderKeyboard(task.id),
        });
        db.setLastMsgId(task.id, sent.message_id);
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
      const lines = ["☀️ <b>Kế hoạch hôm nay</b>"];
      if (todayTasks.length) {
        lines.push(...todayTasks.map((t, idx) => formatTaskCard(t, idx + 1)));
      } else {
        lines.push("<i>(Không có việc nào có giờ hôm nay)</i>");
      }
      if (inbox.length) {
        lines.push("", "📥 <b>Hộp thư Inbox (chưa xếp giờ)</b>", ...inbox.map((t, idx) => formatTaskCard(t, idx + 1)));
      }
      await api.sendMessage(chatId, lines.join("\n\n"), { parse_mode: "HTML" }).catch((err) => {
        console.error("[digest]", (err as Error).message);
      });
    }
  }

  void tick();
  const timer = setInterval(tick, TICK_MS);
  return () => clearInterval(timer);
}
