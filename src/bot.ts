import { Bot, Keyboard, type Context } from "grammy";
import { accessMiddleware, isHost, registerHostCommands } from "./access.ts";
import { config, llmEnabled, sttEnabled } from "./config.ts";
import type { Db } from "./db.ts";
import { fetchMuStatus, formatMuMessage, isMuQuery, muKeyboard } from "./mu.ts";
import { checkSensitiveContent } from "./security.ts";
import { transcribeAudio } from "./stt.ts";
import {
  formatTask,
  formatTaskCard,
  formatGroupedTasks,
  renderProgressBar,
  escapeHtml,
  taskKeyboard,
  parseTaskId,
  when,
  type AddResult,
  type TaskService,
} from "./tasks.ts";
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
/done 12 – đánh dấu xong #12 (hoặc /done #12)
/move 12 mai 10h – dời giờ #12 (hoặc /move #12 mai 10h)
/del 12 – xoá #12 (hoặc /del #12)
/mu – tình trạng MU "Ra Hang" hay "Vô Hang"
/id – xem chat id

Đến giờ mà chưa bấm ✅ thì bot nhắc lại mỗi ${config.repeatEveryMin} phút (tối đa ${config.maxRepeats} lần).

⚠️ Ghi chú được lưu trên máy của chủ bot. Đừng ghi thông tin nhạy cảm: tên bệnh nhân, số giấy tờ, mật khẩu... (Bot có lớp bảo vệ tự động chặn thông tin tài chính và nội dung nhạy cảm).`;

const HOST_HELP = `

<b>Lệnh của chủ bot</b>
/users – người dùng và yêu cầu chờ duyệt
/approve 123 – duyệt chat id 123
/revoke 123 – thu hồi quyền chat id 123
/zalo – lấy mã QR kết nối Zalo`;

export function createBot(db: Db, tasks: TaskService) {
  const bot = new Bot(config.telegramToken);

  // Chuẩn hoá lệnh viết hoa (/MU, /Mu, /TODAY, /DEL...) về chữ thường để người dùng gõ kiểu gì cũng nhận
  bot.use((ctx, next) => {
    if (ctx.message?.text?.startsWith("/")) {
      const m = ctx.message.text.match(/^(\/[a-zA-Z0-9_]+)(.*)$/s);
      if (m) ctx.message.text = m[1].toLowerCase() + m[2];
    }
    return next();
  });

  bot.use(accessMiddleware(db));
  registerHostCommands(bot, db, HELP);

  bot.command(["start", "help"], (ctx) =>
    ctx.reply(HELP + (isHost(ctx.chat.id) ? HOST_HELP : ""), {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(),
    }),
  );
  bot.command("id", (ctx) => ctx.reply(`Chat id: <code>${ctx.chat.id}</code>`, { parse_mode: "HTML" }));

  bot.command("zalo", (ctx) => {
    if (!isHost(ctx.chat.id)) return ctx.reply("Lệnh này chỉ dành cho chủ bot.");
    return ctx.reply(config.zalo.enabled ? requestZaloLogin(tasks, bot.api) : "Bridge Zalo đang tắt (ZALO_ENABLED=0 trong .env).");
  });

  // Trạng thái chờ người dùng nhập giờ mới cho việc cần dời: chatId -> taskId
  const awaitingMove = new Map<number, number>();

  // Chống spam: giới hạn số việc chưa xong và số note mỗi phút (chủ bot không bị giới hạn)
  const recent = new Map<number, number[]>();
  function overLimit(chatId: number, record = true): string | null {
    if (isHost(chatId)) return null;
    if (db.countPending(chatId) >= config.maxPendingPerChat) {
      return `Bạn đã có ${config.maxPendingPerChat} việc chưa xong. Xoá bớt (/list, /del) rồi ghi tiếp nhé.`;
    }
    const now = Date.now();
    const times = (recent.get(chatId) ?? []).filter((t) => now - t < 60_000);
    if (times.length >= config.maxNotesPerMinute) return "Bạn ghi nhanh quá, đợi một phút rồi thử lại nhé.";
    if (record) {
      times.push(now);
      recent.set(chatId, times);
    }
    return null;
  }

  async function addNote(ctx: Context, text: string) {
    const chatId = ctx.chat!.id;
    const check = checkSensitiveContent(text);
    if (!check.safe) {
      return ctx.reply(check.message);
    }
    const blocked = overLimit(chatId);
    if (blocked) return ctx.reply(blocked);
    // Telegram tắt "đang nhập..." sau ~5 giây; AI local có thể mất 10–20 giây nên gửi lại liên tục
    const typing = () => ctx.replyWithChatAction("typing").catch(() => {});
    void typing();
    const keepTyping = setInterval(typing, 4500);
    try {
      await replyAdded(ctx, await tasks.add(chatId, text, "telegram"));
    } finally {
      clearInterval(keepTyping);
    }
  }

  function handleToday(ctx: Context) {
    const start = startOfLocalDay(Date.now(), config.tzOffsetMin);
    const end = start + DAY;
    const list = db.pendingTasks(ctx.chat!.id).filter((t) => t.due_at !== null && t.due_at < end);
    const stats = db.getDailyStats(ctx.chat!.id, start, end);
    const totalToday = stats.doneToday + stats.pendingToday;
    const progress = renderProgressBar(stats.doneToday, totalToday);

    if (!list.length && stats.doneToday === 0) {
      return ctx.reply("☀️ <b>Việc hôm nay</b>\n\nBạn chưa có việc nào hôm nay. Nhắn nội dung bất kỳ để tạo việc mới!", {
        parse_mode: "HTML",
        reply_markup: mainMenuKeyboard(),
      });
    }

    const header = `☀️ <b>Việc hôm nay</b> · Tiến độ: <code>${progress}</code> (${stats.doneToday}/${totalToday} đã xong)\n\n`;
    const body = list.length
      ? formatGroupedTasks(list)
      : "🎉 <i>Bạn đã hoàn thành toàn bộ công việc hôm nay!</i>";
    return ctx.reply(`${header}${body}`, { parse_mode: "HTML", reply_markup: mainMenuKeyboard() });
  }

  function handleInbox(ctx: Context) {
    const list = db.pendingTasks(ctx.chat!.id).filter((t) => t.due_at === null);
    if (!list.length) {
      return ctx.reply("📥 Hộp thư Inbox trống. Mọi việc đều đã có lịch nhắc!", {
        reply_markup: mainMenuKeyboard(),
      });
    }
    const formatted = list.map((t, idx) => formatTaskCard(t, idx + 1)).join("\n\n");
    return ctx.reply(
      `📥 <b>Hộp thư Inbox (${list.length} việc chưa xếp giờ)</b>\n<i>Dùng <code>/move &lt;id&gt; &lt;thời gian&gt;</code> để đặt giờ nhắc</i>\n\n${formatted}`,
      { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
    );
  }

  function handleStats(ctx: Context) {
    const start = startOfLocalDay(Date.now(), config.tzOffsetMin);
    const end = start + DAY;
    const stats = db.getDailyStats(ctx.chat!.id, start, end);
    const totalToday = stats.doneToday + stats.pendingToday;
    const progress = renderProgressBar(stats.doneToday, totalToday);
    const totalPending = db.countPending(ctx.chat!.id);

    const msg = [
      "📊 <b>Thống kê công việc</b>",
      "",
      `Tiến độ hôm nay: <code>${progress}</code>`,
      `• Đã hoàn thành: <b>${stats.doneToday}</b> việc`,
      `• Đang chờ hôm nay: <b>${stats.pendingToday}</b> việc`,
      `• Hộp thư (chưa xếp giờ): <b>${stats.inbox}</b> việc`,
      `• Tổng việc chưa hoàn thành: <b>${totalPending}</b> việc`,
    ].join("\n");

    return ctx.reply(msg, { parse_mode: "HTML", reply_markup: mainMenuKeyboard() });
  }

  function handleAddHelp(ctx: Context) {
    const msg = [
      "✍️ <b>Thêm nhắc việc nhanh</b>",
      "",
      "Bạn chỉ cần gõ tin nhắn bình thường (hoặc gửi 🎙 <b>tin nhắn thoại</b>):",
      "• <code>mai 9h gọi khách A</code>",
      "• <code>30p nữa uống thuốc</code>",
      "• <code>thứ 6 3h chiều nộp báo cáo</code>",
      "• <code>mỗi ngày 7h tập thể dục</code>",
      "• <code>mua sữa</code> (tự xếp vào khung giờ trống)",
    ].join("\n");
    return ctx.reply(msg, { parse_mode: "HTML", reply_markup: mainMenuKeyboard() });
  }

  bot.command("add", async (ctx) => {
    if (!ctx.match.trim()) return ctx.reply("Cú pháp: /add mai 9h gọi khách A");
    await addNote(ctx, ctx.match);
  });

  bot.command("list", (ctx) => {
    const list = db.pendingTasks(ctx.chat.id);
    if (!list.length) return ctx.reply("🎉 Không còn việc nào đang chờ.", { reply_markup: mainMenuKeyboard() });
    return ctx.reply(`📋 <b>Danh sách việc đang chờ (${list.length})</b>\n\n${formatGroupedTasks(list)}`, {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.command("today", (ctx) => handleToday(ctx));
  bot.command("inbox", (ctx) => handleInbox(ctx));
  bot.command(["stats", "status"], (ctx) => handleStats(ctx));

  bot.command(["done", "xong"], (ctx) => {
    const id = parseTaskId(ctx.match);
    if (id === null) return ctx.reply("Cú pháp: /done 12 (hoặc /done #12)");
    const r = tasks.complete(id, ctx.chat.id);
    if (!r) return ctx.reply(`Không tìm thấy việc #${id} đang chờ.`);
    return ctx.reply(doneMessage(r.task.text, r.nextDue), { parse_mode: "HTML" });
  });

  bot.command(["del", "rm", "delete", "xoa"], (ctx) => {
    const id = parseTaskId(ctx.match);
    if (id === null) return ctx.reply("Cú pháp: /del 12 (hoặc /del #12)");
    return ctx.reply(tasks.remove(id, ctx.chat.id) ? `🗑 Đã xoá #${id}` : `Không tìm thấy việc #${id}`);
  });

  bot.command(["move", "doi"], (ctx) => {
    const m = ctx.match.trim().match(/^#?\s*(\d+)\s+(.+)$/);
    if (!m) return ctx.reply("Cú pháp: /move 12 mai 10h (hoặc /move #12 mai 10h)");
    const id = Number(m[1]);
    const at = tasks.reschedule(id, ctx.chat.id, m[2]);
    return ctx.reply(at === null ? "Không hiểu thời gian hoặc không tìm thấy việc." : `📅 #${id} → ${when(at)}`);
  });

  async function handleMu(ctx: Context) {
    try {
      const status = await fetchMuStatus();
      return ctx.reply(formatMuMessage(status), {
        parse_mode: "HTML",
        reply_markup: muKeyboard(status.nextMatch?.kickoffEpoch),
      });
    } catch {
      return ctx.reply("⚽ Chưa lấy được dữ liệu Manchester United lúc này, bạn thử lại sau nhé!");
    }
  }

  bot.command(["mu", "hang", "manutd"], handleMu);

  // Tin nhắn thường = ghi note mới hoặc tương tác menu. Trong nhóm chỉ nhận /add
  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const text = ctx.message.text.trim();

    // Huỷ trạng thái dời việc nếu người dùng bấm menu hoặc lệnh khác
    if (text.startsWith("/") || text.startsWith("📋") || text.startsWith("📥") || text.startsWith("📊") || text.startsWith("➕") || text.startsWith("❓")) {
      awaitingMove.delete(ctx.chat.id);
    }

    if (text.startsWith("/")) return ctx.reply("Lệnh không tồn tại. /help để xem hướng dẫn.");

    if (text === "📋 Việc hôm nay" || text === "📋 Hôm nay") return handleToday(ctx);
    if (text === "📥 Hộp thư Inbox" || text === "📥 Hộp thư") return handleInbox(ctx);
    if (text === "📊 Tiến độ" || text === "📊 Thống kê") return handleStats(ctx);
    if (text === "➕ Thêm việc") return handleAddHelp(ctx);
    if (text === "❓ Trợ giúp") {
      return ctx.reply(HELP + (isHost(ctx.chat.id) ? HOST_HELP : ""), {
        parse_mode: "HTML",
        reply_markup: mainMenuKeyboard(),
      });
    }

    // Hỗ trợ lệnh nhanh: "xóa #2", "del #2", "xóa 2", "xong #2", "done 2"
    const quickDel = text.match(/^(?:del|x[oóòỏõọ]a|rm)\s+#?\s*(\d+)$/i);
    if (quickDel) {
      const id = Number(quickDel[1]);
      return ctx.reply(tasks.remove(id, ctx.chat.id) ? `🗑 Đã xoá #${id}` : `Không tìm thấy việc #${id}`);
    }
    const quickDone = text.match(/^(?:done|xong)\s+#?\s*(\d+)$/i);
    if (quickDone) {
      const id = Number(quickDone[1]);
      const r = tasks.complete(id, ctx.chat.id);
      if (!r) return ctx.reply(`Không tìm thấy việc #${id} đang chờ.`);
      return ctx.reply(doneMessage(r.task.text, r.nextDue), { parse_mode: "HTML" });
    }

    // Kiểm tra câu hỏi / nhắc về MU hoặc Ra hang / Vô hang
    if (isMuQuery(text)) {
      return handleMu(ctx);
    }

    // Kiểm tra nếu đang chờ nhập giờ mới để dời việc
    let moveTaskId = awaitingMove.get(ctx.chat.id);
    if (!moveTaskId && ctx.message.reply_to_message?.text) {
      const match = ctx.message.reply_to_message.text.match(/dời việc #(\d+)/i);
      if (match) moveTaskId = Number(match[1]);
    }

    if (moveTaskId) {
      const check = checkSensitiveContent(text);
      if (!check.safe) {
        return ctx.reply(check.message);
      }
      const at = tasks.reschedule(moveTaskId, ctx.chat.id, text);
      if (at !== null) {
        awaitingMove.delete(ctx.chat.id);
        return ctx.reply(`📅 Đã dời việc <b>#${moveTaskId}</b> sang <b>${when(at)}</b>`, {
          parse_mode: "HTML",
          reply_markup: mainMenuKeyboard(),
        });
      } else {
        return ctx.reply(
          `⚠️ Không hiểu mốc thời gian "<code>${escapeHtml(text)}</code>".\n\nBạn nhập lại nhé (ví dụ: <code>15h30</code>, <code>mai 9h</code>, <code>30p nữa</code>):`,
          {
            parse_mode: "HTML",
            reply_markup: { force_reply: true, selective: true },
          },
        );
      }
    }

    await addNote(ctx, text);
  });

  // Nhận voice note hoặc file audio, chuyển thành text qua STT rồi tự động tạo nhắc việc
  bot.on(["message:voice", "message:audio"], async (ctx) => {
    const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.me.id;
    if (ctx.chat.type !== "private" && !isReplyToBot) return;
    const blocked = overLimit(ctx.chat.id, false);
    if (blocked) return ctx.reply(blocked);

    if (!sttEnabled) {
      return ctx.reply(
        "🎙 <b>Tính năng ghi âm chưa bật</b>\n\nĐể bot nhận diện giọng nói, vui lòng điền <code>STT_API_KEY</code> (hỗ trợ Groq hoặc OpenAI) trong file <code>.env</code>.",
        { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
      );
    }

    const typing = () => ctx.replyWithChatAction("record_voice").catch(() => {});
    void typing();
    const keepTyping = setInterval(typing, 4500);

    try {
      const fileId = ctx.message.voice ? ctx.message.voice.file_id : ctx.message.audio!.file_id;
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) {
        return ctx.reply("Không thể tải file âm thanh từ Telegram.");
      }
      const downloadUrl = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        return ctx.reply("Không thể tải dữ liệu âm thanh từ máy chủ Telegram.");
      }
      const buffer = await res.arrayBuffer();
      const transcribed = await transcribeAudio(new Uint8Array(buffer), file.file_path.split("/").pop() ?? "voice.ogg");
      if (!transcribed.trim()) {
        return ctx.reply("🎙 Không nhận diện được nội dung từ file ghi âm. Bạn nói lại rõ hơn nhé!");
      }

      let moveTaskId = awaitingMove.get(ctx.chat.id);
      if (moveTaskId) {
        const check = checkSensitiveContent(transcribed);
        if (!check.safe) {
          return ctx.reply(check.message);
        }
        const at = tasks.reschedule(moveTaskId, ctx.chat.id, transcribed);
        await ctx.reply(`🎙 <i>"${escapeHtml(transcribed)}"</i>`, { parse_mode: "HTML" });
        if (at !== null) {
          awaitingMove.delete(ctx.chat.id);
          return ctx.reply(`📅 Đã dời việc <b>#${moveTaskId}</b> sang <b>${when(at)}</b>`, {
            parse_mode: "HTML",
            reply_markup: mainMenuKeyboard(),
          });
        } else {
          return ctx.reply(
            `⚠️ Không hiểu mốc thời gian "<code>${escapeHtml(transcribed)}</code>".\n\nBạn nói hoặc nhập lại nhé (ví dụ: <code>15h30</code>, <code>mai 9h</code>):`,
            { parse_mode: "HTML", reply_markup: { force_reply: true, selective: true } },
          );
        }
      }

      await ctx.reply(`🎙 <i>"${escapeHtml(transcribed)}"</i>`, { parse_mode: "HTML" });
      await addNote(ctx, transcribed);
    } catch (err) {
      console.error("[stt]", (err as Error).message);
      await ctx.reply("Có lỗi khi nhận diện giọng nói, vui lòng thử lại bằng tin nhắn gõ tay.");
    } finally {
      clearInterval(keepTyping);
    }
  });

  bot.callbackQuery(/^(done|del|tmr|snz|mv):(\d+)(?::(\w+))?$/, async (ctx) => {
    const [, action, idStr, arg] = ctx.match;
    const id = Number(idStr);
    const chatId = ctx.chat!.id;
    let text: string;

    if (action === "mv") {
      awaitingMove.set(chatId, id);
      await ctx.answerCallbackQuery();
      return ctx.reply(
        `✍️ Bạn muốn dời việc <b>#${id}</b> sang lúc mấy giờ?\n\nHãy reply tin nhắn này hoặc gõ giờ mới (ví dụ: <code>15h</code>, <code>mai 9h</code>, <code>30p nữa</code>, <code>tối nay</code>)...`,
        {
          parse_mode: "HTML",
          reply_markup: { force_reply: true, selective: true },
        },
      );
    }

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

  bot.callbackQuery(/^mu:(refresh|remind)(?::(\d+))?$/, async (ctx) => {
    const [, subAction, epochStr] = ctx.match;
    if (subAction === "refresh") {
      try {
        const status = await fetchMuStatus(true);
        await ctx.editMessageText(formatMuMessage(status), {
          parse_mode: "HTML",
          reply_markup: muKeyboard(status.nextMatch?.kickoffEpoch),
        });
        return ctx.answerCallbackQuery({ text: "Đã cập nhật tình hình Hang MU mới nhất!" });
      } catch {
        return ctx.answerCallbackQuery({ text: "Không thể làm mới lúc này." });
      }
    }
    if (subAction === "remind" && epochStr) {
      const epoch = Number(epochStr);
      const remindTime = epoch - 15 * 60_000;
      if (remindTime > Date.now()) {
        db.addTask(ctx.chat!.id, "Xem trực tiếp Manchester United thi đấu ⚽🔥", remindTime, null, "telegram");
        await ctx.answerCallbackQuery({ text: "⏰ Đã đặt lịch nhắc trước 15 phút khi MU đá!" });
        return ctx.reply("⏰ Đã tạo nhắc nhở trước 15 phút giờ bóng lăn! Chuẩn bị sẵn sàng ra hang nhé!");
      } else {
        return ctx.answerCallbackQuery({ text: "Trận đấu đã diễn ra hoặc không còn hợp lệ." });
      }
    }
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

export function mainMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text("📋 Việc hôm nay")
    .text("➕ Thêm việc")
    .row()
    .text("📥 Hộp thư Inbox")
    .text("📊 Tiến độ")
    .text("❓ Trợ giúp")
    .resized()
    .persistent();
}

async function replyAdded(ctx: Context, { task, auto }: AddResult) {
  let msg = `📝 Đã ghi nhận: <b>#${task.id}</b>\n<blockquote>${escapeHtml(task.text)}</blockquote>`;
  if (task.due_at === null) {
    msg += `\n⏰ <i>Chưa có giờ (lưu vào inbox). Đặt giờ: <code>/move ${task.id} mai 9h</code></i>`;
  } else if (auto) {
    msg += `\n⏰ Nhắc lúc: <b>${when(task.due_at)}</b> <i>(🤖 tự xếp vào khung trống)</i>`;
  } else {
    msg += `\n⏰ Nhắc lúc: <b>${when(task.due_at)}</b>`;
  }
  await ctx.reply(msg, { parse_mode: "HTML", reply_markup: taskKeyboard(task.id) });
}
