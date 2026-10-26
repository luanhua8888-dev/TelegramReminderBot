// Bridge Zalo → Telegram qua zca-js (thư viện KHÔNG chính thức, đăng nhập bằng tài khoản cá nhân).
// Rủi ro: Zalo có thể khoá tài khoản, nên dùng nick phụ.
// Cách dùng: nhắn "#note mai 9h gọi khách" ở bất kỳ đâu trên Zalo (ví dụ "Cloud của tôi"),
// bot lưu việc và xác nhận trên Telegram. Bot không trả lời trong Zalo để người khác không thấy.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { InputFile, type Api } from "grammy";
import { config } from "./config.ts";
import { formatTask, taskKeyboard, type TaskService } from "./tasks.ts";

const NOTE_PREFIX = /^\s*#(?:note|nhac|nhắc|todo)\s+([\s\S]+)/iu;

// QR hết hạn quá số lần này thì dừng, tránh spam QR vào Telegram; gõ /zalo để thử lại
const MAX_QR = 3;

let state: "idle" | "connecting" | "connected" = "idle";

/** Gọi từ lệnh /zalo: trả về câu trả lời cho người dùng. */
export function requestZaloLogin(tasks: TaskService, tg: Api): string {
  if (state === "connected") return "Bridge Zalo đang kết nối rồi.";
  if (state === "connecting") return "Đang chờ quét QR, xem mã QR mới nhất ở trên.";
  startZaloBridge(tasks, tg).catch((err) => console.error("[zalo] không khởi động được:", err.message ?? err));
  return "Đang tạo mã QR Zalo...";
}

export async function startZaloBridge(tasks: TaskService, tg: Api): Promise<void> {
  const ownerChatId = config.ownerChatId;
  if (!ownerChatId) {
    console.warn("[zalo] cần ALLOWED_CHAT_IDS để biết gửi note Zalo về chat Telegram nào, bỏ qua bridge.");
    return;
  }
  state = "connecting";
  try {
    await connect(tasks, tg, ownerChatId);
    state = "connected";
  } catch (err) {
    state = "idle";
    throw err;
  }
}

async function connect(tasks: TaskService, tg: Api, ownerChatId: number): Promise<void> {

  // index.d.ts của zca-js không resolve được với moduleResolution NodeNext, nên trỏ thẳng vào file type
  type ZcaModule = typeof import("../node_modules/zca-js/dist/index.js");
  const { Zalo, LoginQRCallbackEventType } = (await import("zca-js")) as unknown as ZcaModule;
  const zalo = new Zalo({ selfListen: true, logging: false });
  const credPath = config.zalo.credentialsPath;

  let api;
  if (existsSync(credPath)) {
    try {
      api = await zalo.login(JSON.parse(readFileSync(credPath, "utf8")));
      console.log("[zalo] đăng nhập bằng phiên đã lưu");
    } catch (err) {
      console.warn("[zalo] phiên cũ hết hạn, chuyển sang quét QR:", (err as Error).message);
    }
  }

  if (!api) {
    let qrCount = 0;
    api = await zalo.loginQR({}, async (event) => {
      if (event.type === LoginQRCallbackEventType.QRCodeGenerated) {
        qrCount++;
        await event.actions.saveToFile("data/zalo-qr.png");
        // Gửi luôn QR về Telegram để quét bằng app Zalo trên điện thoại
        await tg
          .sendPhoto(ownerChatId, new InputFile(Buffer.from(event.data.image, "base64"), "zalo-qr.png"), {
            caption: "Mở Zalo trên điện thoại → quét QR này để kết nối bridge.",
          })
          .catch((err) => console.error("[zalo] gửi QR qua Telegram lỗi:", err.message));
        console.log("[zalo] đã lưu QR vào data/zalo-qr.png, hãy quét bằng app Zalo");
      } else if (event.type === LoginQRCallbackEventType.QRCodeExpired) {
        if (qrCount >= MAX_QR) {
          console.log(`[zalo] QR hết hạn ${qrCount} lần, dừng. Gõ /zalo trên Telegram để thử lại.`);
          await tg
            .sendMessage(ownerChatId, "⌛ QR Zalo hết hạn. Khi nào sẵn sàng quét thì gõ /zalo để lấy mã mới.")
            .catch(() => {});
          event.actions.abort();
          return;
        }
        console.log("[zalo] QR hết hạn, tạo QR mới");
        event.actions.retry();
      } else if (event.type === LoginQRCallbackEventType.GotLoginInfo) {
        mkdirSync(dirname(credPath), { recursive: true });
        writeFileSync(credPath, JSON.stringify(event.data, null, 2));
        console.log(`[zalo] đã lưu phiên đăng nhập vào ${credPath}`);
      }
    });
  }

  api.listener.on("message", async (msg) => {
    if (typeof msg.data.content !== "string") return;
    if (!msg.isSelf && !config.zalo.acceptFromOthers) return;
    const m = msg.data.content.match(NOTE_PREFIX);
    if (!m) return;
    try {
      const { task, auto } = await tasks.add(ownerChatId, m[1].trim(), "zalo");
      await tg.sendMessage(ownerChatId, `📝 ${formatTask(task)}${auto ? "\n<i>🤖 Tự xếp vào khung trống.</i>" : ""}`, {
        parse_mode: "HTML",
        reply_markup: taskKeyboard(task.id),
      });
    } catch (err) {
      console.error("[zalo] xử lý note lỗi:", err);
    }
  });
  api.listener.on("error", (err) => console.error("[zalo] listener lỗi:", err));
  api.listener.on("closed", (code, reason) => console.warn(`[zalo] mất kết nối (${code}) ${reason}`));
  api.listener.start({ retryOnClose: true });
  await tg.sendMessage(ownerChatId, "🔗 Bridge Zalo đã kết nối. Nhắn <code>#note ...</code> trên Zalo để ghi việc.", {
    parse_mode: "HTML",
  });
}
