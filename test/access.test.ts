import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TELEGRAM_BOT_TOKEN ??= "test";
process.env.OWNER_CHAT_ID = "1";
process.env.ALLOWED_CHAT_IDS = "2";
const { openDb } = await import("../src/db.ts");
const { accessMiddleware } = await import("../src/access.ts");

type Sent = { to: number | "reply"; text: string };

// Context giả, chỉ đủ những gì middleware dùng
function fakeCtx(chatId: number, sent: Sent[]) {
  return {
    chat: { id: chatId, type: "private", first_name: "Lan", username: "lan" },
    message: { text: "mai 9h họp" },
    reply: async (text: string) => void sent.push({ to: "reply", text }),
    api: { sendMessage: async (to: number, text: string) => void sent.push({ to, text }) },
  } as never;
}

async function run(db: ReturnType<typeof openDb>, chatId: number) {
  const sent: Sent[] = [];
  let passed = false;
  await accessMiddleware(db)(fakeCtx(chatId, sent), async () => {
    passed = true;
  });
  return { passed, sent };
}

test("host và ALLOWED_CHAT_IDS luôn qua", async () => {
  const db = openDb(":memory:");
  assert.equal((await run(db, 1)).passed, true);
  assert.equal((await run(db, 2)).passed, true);
});

test("người mới → chờ duyệt, host nhận yêu cầu", async () => {
  const db = openDb(":memory:");
  const r = await run(db, 99);
  assert.equal(r.passed, false);
  assert.equal(db.getUser(99)?.status, "pending");
  assert.equal(db.getUser(99)?.name, "Lan (@lan)");
  assert.ok(r.sent.some((s) => s.to === 1 && s.text.includes("muốn dùng bot")));
  assert.ok(r.sent.some((s) => s.to === "reply"));
});

test("nhắn lại khi đang chờ → không gửi thêm yêu cầu cho host", async () => {
  const db = openDb(":memory:");
  await run(db, 99);
  const r = await run(db, 99);
  assert.equal(r.passed, false);
  assert.deepEqual(r.sent.map((s) => s.to), ["reply"]);
});

test("đã duyệt → qua; bị từ chối → im lặng", async () => {
  const db = openDb(":memory:");
  db.setUser(50, "A", "approved");
  db.setUser(60, "B", "rejected");
  assert.equal((await run(db, 50)).passed, true);
  const rejected = await run(db, 60);
  assert.equal(rejected.passed, false);
  assert.equal(rejected.sent.length, 0);
});
