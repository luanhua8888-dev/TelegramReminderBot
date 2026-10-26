import { Bot, type Context } from "grammy";
import { accessMiddleware, isHost, registerHostCommands } from "./access.ts";
import { config, llmEnabled } from "./config.ts";
import type { Db } from "./db.ts";
import { formatTask, escapeHtml, taskKeyboard, when, type AddResult, type TaskService } from "./tasks.ts";
import { DAY, HOUR, fromLocal, startOfLocalDay, toLocal } from "./time.ts";
import { requestZaloLogin } from "./zalo.ts";

const HELP = `<b>Ghi note nhanh, bot nhắc đúng giờ</b>

Cứ gõ tin nhắn bình thường, ví dụ:
• <code>mai 9h gọi khách A</code>
• <code>30p nữa uống thuốc</code>
• <code>thứ 6 3h chiều nộp báo cáo</code>
• <code>mỗi ngày 7h tập thể dục</code>
• <code>cuối tuần dọn nhà</code>${llmEnabled ? " (AI hiểu)" : ""}
• <code>mua sữa</code> (không có giờ → ${config.autoSchedule ? "tự xếp vào khung trống" : "lưu vào inbox"})

Lệnh:
/list – việc chưa xong
/today – việc hôm nay
/done 12 – đánh dấu xong #12
/move 12 mai 10h – dời giờ #12
/del 12 – xoá #12
/id – xem chat id

Đến giờ mà chưa bấm ✅ thì bot nhắc lại mỗi ${config.repeatEveryMin} phút (tối đa ${config.maxRepeats} lần).

⚠️ Ghi chú được lưu trên máy của chủ bot. Đừng ghi thông tin nhạy cảm: tên bệnh nhân, số giấy tờ, mật khẩu...`;

const HOST_HELP = `

<b>Lệnh của chủ bot</b>
/users – người dùng và yêu cầu chờ duyệt
/approve 123 – duyệt chat id 123
/revoke 123 – thu hồi quyền chat id 123
/zalo – lấy mã QR kết nối Zalo`;

export function createBot(db: Db, tasks: TaskService) {
  const bot = new Bot(config.telegramToken);

  bot.use(accessMiddleware(db));
  registerHostCommands(bot, db, HELP);

  bot.command(["start", "help"], (ctx) => ctx.reply(HELP + (isHost(ctx.chat.id) ? HOST_HELP : ""), { parse_mode: "HTML" }));
  bot.command("id", (ctx) => ctx.reply(`Chat id: <code>${ctx.chat.id}</code>`, { parse_mode: "HTML" }));

  bot.command("zalo", (ctx) => {
    if (!isHost(ctx.chat.id)) return ctx.reply("Lệnh này chỉ dành cho chủ bot.");
    return ctx.reply(config.zalo.enabled ? requestZaloLogin(tasks, bot.api) : "Bridge Zalo đang tắt (ZALO_ENABLED=0 trong .env).");
  });

  // Chống spam: giới hạn số việc chưa xong và số note mỗi phút (chủ bot không bị giới hạn)
  const recent = new Map<number, number[]>();
  function overLimit(chatId: number): string | null {
    if (isHost(chatId)) return null;
    if (db.countPending(chatId) >= config.maxPendingPerChat) {
      return `Bạn đã có ${config.maxPendingPerChat} việc chưa xong. Xoá bớt (/list, /del) rồi ghi tiếp nhé.`;
    }
    const now = Date.now();
    const times = (recent.get(chatId) ?? []).filter((t) => now - t < 60_000);
    if (times.length >= config.maxNotesPerMinute) return "Bạn ghi nhanh quá, đợi một phút rồi thử lại nhé.";
    times.push(now);
    recent.set(chatId, times);
    return null;
  }

  async function addNote(ctx: Context, text: string) {
    const chatId = ctx.chat!.id;
    const blocked = overLimit(chatId);
    if (blocked) return ctx.reply(blocked);
    await ctx.replyWithChatAction("typing");
    await replyAdded(ctx, await tasks.add(chatId, text, "telegram"));
  }

  bot.command("add", async (ctx) => {
    if (!ctx.match.trim()) return ctx.reply("Cú pháp: /add mai 9h gọi khách A");
    await addNote(ctx, ctx.match);
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

  // Tin nhắn thường = ghi note mới. Trong nhóm chỉ nhận /add, để không biến mọi câu chat thành việc
  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    if (ctx.message.text.startsWith("/")) return ctx.reply("Lệnh không tồn tại. /help để xem hướng dẫn.");
    await addNote(ctx, ctx.message.text);
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

async function replyAdded(ctx: Context, { task, auto }: AddResult) {
  let msg = `📝 ${formatTask(task)}`;
  if (task.due_at === null) msg += `\n<i>Chưa có giờ nên chưa nhắc. Đặt giờ: /move ${task.id} mai 9h</i>`;
  else if (auto) msg += `\n<i>🤖 Bạn chưa nói giờ nên mình xếp vào khung trống. Đổi: /move ${task.id} mai 10h</i>`;
  await ctx.reply(msg, { parse_mode: "HTML", reply_markup: taskKeyboard(task.id) });
}
