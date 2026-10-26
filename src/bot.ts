import { Bot, type Context } from "grammy";
import { config, llmEnabled } from "./config.ts";
import type { Db } from "./db.ts";
import { formatTask, escapeHtml, taskKeyboard, when, type AddResult, type TaskService } from "./tasks.ts";
import { DAY, HOUR, fromLocal, startOfLocalDay, toLocal } from "./time.ts";

const HELP = `<b>Ghi note nhanh, bot nhắc đúng giờ</b>

Cứ gõ tin nhắn bình thường, ví dụ:
• <code>mai 9h gọi khách A</code>
• <code>30p nữa uống thuốc</code>
• <code>thứ 6 3h chiều nộp báo cáo</code>
• <code>mỗi ngày 7h tập thể dục</code>
• <code>mua sữa</code> (không có giờ → ${llmEnabled ? "AI tự xếp giờ" : "lưu vào inbox"})

Lệnh:
/list – việc chưa xong
/today – việc hôm nay
/done 12 – đánh dấu xong #12
/move 12 mai 10h – dời giờ #12
/del 12 – xoá #12
/id – xem chat id

Đến giờ mà chưa bấm ✅ thì bot nhắc lại mỗi ${config.repeatEveryMin} phút (tối đa ${config.maxRepeats} lần).`;

export function createBot(db: Db, tasks: TaskService) {
  const bot = new Bot(config.telegramToken);

  // Chỉ cho phép các chat trong ALLOWED_CHAT_IDS
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) return;
    if (config.allowedChatIds.length && !config.allowedChatIds.includes(chatId)) {
      if (ctx.message) await ctx.reply(`Bot riêng tư. Chat id của bạn: ${chatId}`);
      return;
    }
    await next();
  });

  bot.command(["start", "help"], (ctx) => ctx.reply(HELP, { parse_mode: "HTML" }));
  bot.command("id", (ctx) => ctx.reply(`Chat id: <code>${ctx.chat.id}</code>`, { parse_mode: "HTML" }));

  bot.command("add", async (ctx) => {
    if (!ctx.match.trim()) return ctx.reply("Cú pháp: /add mai 9h gọi khách A");
    await replyAdded(ctx, await tasks.add(ctx.chat.id, ctx.match, "telegram"));
  });

  bot.command("list", (ctx) => {
    const list = db.pendingTasks(ctx.chat.id);
    if (!list.length) return ctx.reply("🎉 Không còn việc nào.");
    return ctx.reply(list.map(formatTask).join("\n"), { parse_mode: "HTML" });
  });

  bot.command("today", (ctx) => {
    const end = startOfLocalDay(Date.now(), config.tzOffsetMin) + DAY;
    const list = db.pendingTasks(ctx.chat.id).filter((t) => t.due_at !== null && t.due_at < end);
    if (!list.length) return ctx.reply("Hôm nay không có việc nào có giờ. /list để xem tất cả.");
    return ctx.reply(list.map(formatTask).join("\n"), { parse_mode: "HTML" });
  });

  bot.command("done", (ctx) => {
    const id = Number(ctx.match.trim());
    const r = tasks.complete(id, ctx.chat.id);
    if (!r) return ctx.reply(`Không tìm thấy việc #${ctx.match.trim()} đang chờ.`);
    return ctx.reply(doneMessage(r.task.text, r.nextDue), { parse_mode: "HTML" });
  });

  bot.command("del", (ctx) => {
    const id = Number(ctx.match.trim());
    return ctx.reply(tasks.remove(id, ctx.chat.id) ? `🗑 Đã xoá #${id}` : `Không tìm thấy #${id}`);
  });

  bot.command("move", (ctx) => {
    const m = ctx.match.trim().match(/^(\d+)\s+(.+)$/);
    if (!m) return ctx.reply("Cú pháp: /move 12 mai 10h");
    const at = tasks.reschedule(Number(m[1]), ctx.chat.id, m[2]);
    return ctx.reply(at === null ? "Không hiểu thời gian hoặc không tìm thấy việc." : `📅 #${m[1]} → ${when(at)}`);
  });

  // Tin nhắn thường = ghi note mới
  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return ctx.reply("Lệnh không tồn tại. /help để xem hướng dẫn.");
    await ctx.replyWithChatAction("typing");
    await replyAdded(ctx, await tasks.add(ctx.chat.id, ctx.message.text, "telegram"));
  });

  bot.callbackQuery(/^(done|del|tmr|snz):(\d+)(?::(\w+))?$/, async (ctx) => {
    const [, action, idStr, arg] = ctx.match;
    const id = Number(idStr);
    const chatId = ctx.chat!.id;
    let text: string;

    if (action === "done") {
      const r = tasks.complete(id, chatId);
      text = r ? doneMessage(r.task.text, r.nextDue) : "Việc này đã xử lý rồi.";
    } else if (action === "del") {
      text = tasks.remove(id, chatId) ? `🗑 Đã xoá #${id}` : "Không tìm thấy việc.";
    } else if (action === "tmr") {
      const at = tasks.toTomorrow(id, chatId);
      text = at === null ? "Không tìm thấy việc." : `📅 #${id} dời sang ${when(at)}`;
    } else {
      const ms = arg === "tonight" ? untilTonight() : Number(arg) * 60_000;
      const at = tasks.snooze(id, chatId, ms);
      text = at === null ? "Không tìm thấy việc." : `⏰ #${id} nhắc lại lúc ${when(at)}`;
    }

    await ctx.answerCallbackQuery();
    // Giữ nội dung lời nhắc gốc, thêm dòng trạng thái và bỏ nút
    const original = ctx.callbackQuery.message?.text ?? "";
    await ctx.editMessageText(`${escapeHtml(original)}\n\n${text}`, { parse_mode: "HTML" }).catch(() => ctx.reply(text, { parse_mode: "HTML" }));
  });

  bot.catch((err) => console.error("[bot]", err.error));
  return bot;
}

function doneMessage(text: string, nextDue: number | null): string {
  return nextDue === null ? `✅ Xong: ${escapeHtml(text)}` : `✅ Xong lần này. Lần tới: ${when(nextDue)}`;
}

/** Tới 20:00 tối nay; nếu đã quá 20h thì 1 tiếng nữa. */
function untilTonight(): number {
  const now = Date.now();
  const p = toLocal(now, config.tzOffsetMin);
  const tonight = fromLocal(p.y, p.mo, p.d, 20, 0, config.tzOffsetMin);
  return tonight > now ? tonight - now : HOUR;
}

async function replyAdded(ctx: Context, { task, auto, via }: AddResult) {
  let msg = `📝 ${formatTask(task)}`;
  if (task.due_at === null) msg += `\n<i>Chưa có giờ nên chưa nhắc. Đặt giờ: /move ${task.id} mai 9h</i>`;
  else if (auto) msg += "\n<i>🤖 Tự xếp giờ, bấm 📅 hoặc /move để đổi.</i>";
  if (via === "rules" && llmEnabled) msg += "\n<i>(AI lỗi, dùng parser dự phòng)</i>";
  await ctx.reply(msg, { parse_mode: "HTML", reply_markup: taskKeyboard(task.id) });
}
