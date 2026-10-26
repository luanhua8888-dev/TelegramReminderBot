import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TELEGRAM_BOT_TOKEN ??= "test";
process.env.LLM_MODEL = ""; // luôn dùng parser luật trong test
process.env.AUTO_SCHEDULE = "0"; // tự xếp lịch được test riêng trong slot.test.ts
const { openDb } = await import("../src/db.ts");
const { createTaskService, renderProgressBar, formatTaskCard } = await import("../src/tasks.ts");
const { DAY } = await import("../src/time.ts");

const CHAT = 1;

test("thêm việc có giờ → tới giờ thì vào danh sách cần nhắc", async () => {
  const db = openDb(":memory:");
  const tasks = createTaskService(db);
  const { task } = await tasks.add(CHAT, "30p nữa uống thuốc", "telegram");
  assert.equal(task.text, "uống thuốc");
  assert.equal(db.tasksToRemind(Date.now()).length, 0);
  assert.equal(db.tasksToRemind(Date.now() + 31 * 60_000).length, 1);
});

test("việc không có giờ nằm trong inbox, không bị nhắc", async () => {
  const db = openDb(":memory:");
  const { task } = await createTaskService(db).add(CHAT, "mua sữa", "telegram");
  assert.equal(task.due_at, null);
  assert.equal(db.tasksToRemind(Date.now() + 365 * DAY).length, 0);
  assert.equal(db.pendingTasks(CHAT).length, 1);
});

test("nhắc lại tới khi bấm xong", async () => {
  const db = openDb(":memory:");
  const tasks = createTaskService(db);
  const { task } = await tasks.add(CHAT, "30p nữa họp", "telegram");
  const later = Date.now() + 31 * 60_000;
  db.markReminded(task.id, later + 15 * 60_000);
  assert.equal(db.tasksToRemind(later).length, 0);
  assert.equal(db.tasksToRemind(later + 15 * 60_000).length, 1);
  assert.ok(tasks.complete(task.id, CHAT));
  assert.equal(db.tasksToRemind(later + DAY).length, 0);
  assert.equal(db.pendingTasks(CHAT).length, 0);
});

test("việc lặp lại: bấm xong thì dời sang lần kế tiếp", async () => {
  const db = openDb(":memory:");
  const tasks = createTaskService(db);
  const { task } = await tasks.add(CHAT, "mỗi ngày 7h tập thể dục", "telegram");
  const r = tasks.complete(task.id, CHAT)!;
  assert.equal(r.nextDue, task.due_at! + DAY);
  assert.equal(db.getTask(task.id, CHAT)!.status, "pending");
});

test("snooze và chat khác không đụng được việc của nhau", async () => {
  const db = openDb(":memory:");
  const tasks = createTaskService(db);
  const { task } = await tasks.add(CHAT, "mai 9h gọi khách", "telegram");
  assert.equal(tasks.snooze(task.id, 999, 60_000), null);
  assert.equal(tasks.complete(task.id, 999), null);
  const at = tasks.snooze(task.id, CHAT, 60_000)!;
  assert.equal(db.getTask(task.id, CHAT)!.next_remind_at, at);
});

test("renderProgressBar hiển thị đúng tỷ lệ", () => {
  assert.equal(renderProgressBar(0, 0), "[░░░░░░░░░░] 0%");
  assert.equal(renderProgressBar(5, 10, 10), "[▓▓▓▓▓░░░░░] 50%");
  assert.equal(renderProgressBar(10, 10, 10), "[▓▓▓▓▓▓▓▓▓▓] 100%");
});

test("formatTaskCard định dạng HTML blockquote và emoji", () => {
  const task = {
    id: 1,
    chat_id: 123,
    text: "Mua sữa tươi",
    due_at: 1774843200000,
    next_remind_at: 1774843200000,
    remind_count: 0,
    recurring: null,
    status: "pending" as const,
    source: "telegram",
    created_at: 1774800000000,
  };
  const card = formatTaskCard(task);
  assert.match(card, /<b>#1<\/b>/);
  assert.match(card, /<blockquote>Mua sữa tươi<\/blockquote>/);
});
