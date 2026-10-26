// Phân quyền: host (OWNER_CHAT_ID) + ALLOWED_CHAT_IDS luôn được dùng.
// Người khác nhắn bot → gửi yêu cầu cho host với nút Duyệt / Từ chối; kết quả lưu trong bảng users.
// Không cấu hình host lẫn ALLOWED_CHAT_IDS → mở cho mọi người.

import { InlineKeyboard, type Bot, type Context, type NextFunction } from "grammy";
import { config } from "./config.ts";
import type { Db, User } from "./db.ts";
import { escapeHtml } from "./tasks.ts";

const STATUS_LABEL = { pending: "⏳ chờ duyệt", approved: "✅ đã duyệt", rejected: "❌ từ chối" } as const;

export function isHost(chatId: number | undefined): boolean {
  return chatId !== undefined && chatId === config.ownerChatId;
}

function displayName(ctx: Context): string {
  const chat = ctx.chat!;
  if (chat.type !== "private") return `Nhóm "${chat.title}"`;
  const full = [chat.first_name, chat.last_name].filter(Boolean).join(" ") || String(chat.id);
  return chat.username ? `${full} (@${chat.username})` : full;
}

function requestKeyboard(chatId: number): InlineKeyboard {
  return new InlineKeyboard().text("✅ Duyệt", `acc:ok:${chatId}`).text("❌ Từ chối", `acc:no:${chatId}`);
}

export function accessMiddleware(db: Db) {
  return async (ctx: Context, next: NextFunction) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) return;
    if (isHost(chatId) || config.allowedChatIds.includes(chatId)) return next();
    if (!config.ownerChatId && !config.allowedChatIds.length) return next(); // không cấu hình gì = mở

    const user = db.getUser(chatId);
    if (user?.status === "approved") return next();

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: "Bạn chưa được duyệt dùng bot." });
      return;
    }
    if (!ctx.message || user?.status === "rejected") return; // bị từ chối thì im lặng, tránh bị spam ngược
    if (user?.status === "pending") {
      await ctx.reply("⏳ Yêu cầu của bạn đang chờ chủ bot duyệt.");
      return;
    }
    if (!config.ownerChatId) {
      await ctx.reply(`Bot riêng tư. Chat id của bạn: ${chatId}`);
      return;
    }

    const name = displayName(ctx);
    db.setUser(chatId, name, "pending");
    await ctx.api.sendMessage(
      config.ownerChatId,
      `🙋 <b>${escapeHtml(name)}</b> muốn dùng bot.\nChat id: <code>${chatId}</code>`,
      { parse_mode: "HTML", reply_markup: requestKeyboard(chatId) },
    );
    await ctx.reply("👋 Bot đang ở chế độ duyệt. Mình đã gửi yêu cầu tới chủ bot, bạn sẽ nhận tin khi được duyệt.");
  };
}

/** Lệnh và nút chỉ host dùng được. `welcome` = tin gửi cho người vừa được duyệt. */
export function registerHostCommands(bot: Bot, db: Db, welcome: string) {
  async function decide(chatId: number, approve: boolean): Promise<string> {
    const user = db.getUser(chatId);
    const name = user?.name ?? String(chatId);
    db.setUser(chatId, name, approve ? "approved" : "rejected");
    const notice = approve ? `✅ Chủ bot đã duyệt, bạn dùng được rồi!\n\n${welcome}` : "Yêu cầu dùng bot của bạn không được chấp nhận.";
    await bot.api.sendMessage(chatId, notice, { parse_mode: "HTML" }).catch((err) => {
      console.warn(`[access] không gửi được tin cho ${chatId}:`, err.message);
    });
    return `${approve ? "✅ Đã duyệt" : "❌ Đã từ chối"} ${escapeHtml(name)}`;
  }

  bot.callbackQuery(/^acc:(ok|no):(-?\d+)$/, async (ctx) => {
    if (!isHost(ctx.chat?.id)) return ctx.answerCallbackQuery({ text: "Chỉ chủ bot mới duyệt được." });
    const result = await decide(Number(ctx.match[2]), ctx.match[1] === "ok");
    await ctx.answerCallbackQuery();
    const original = ctx.callbackQuery.message?.text ?? "";
    await ctx.editMessageText(`${escapeHtml(original)}\n\n${result}`, { parse_mode: "HTML" }).catch(() => {});
  });

  const hostOnly = (handler: (ctx: Context & { match: string }) => unknown) => (ctx: Context & { match: string }) =>
    isHost(ctx.chat?.id) ? handler(ctx) : ctx.reply("Lệnh này chỉ dành cho chủ bot.");

  bot.command(
    "users",
    hostOnly((ctx) => {
      const users = db.listUsers();
      if (!users.length) return ctx.reply("Chưa có ai xin dùng bot.");
      const lines = users.map((u: User) => `${STATUS_LABEL[u.status]} · ${escapeHtml(u.name)} · <code>${u.chat_id}</code>`);
      return ctx.reply(`<b>Người dùng</b>\n${lines.join("\n")}\n\n/approve &lt;id&gt; · /revoke &lt;id&gt;`, { parse_mode: "HTML" });
    }),
  );

  for (const [cmd, approve] of [["approve", true], ["revoke", false]] as const) {
    bot.command(
      cmd,
      hostOnly(async (ctx) => {
        const id = Number(ctx.match.trim());
        if (!Number.isInteger(id) || id === 0) return ctx.reply(`Cú pháp: /${cmd} <chat id> (xem /users)`);
        if (isHost(id)) return ctx.reply("Không thể đổi quyền của chủ bot.");
        return ctx.reply(await decide(id, approve), { parse_mode: "HTML" });
      }),
    );
  }
}
