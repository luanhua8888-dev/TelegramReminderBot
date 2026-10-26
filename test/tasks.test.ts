import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TELEGRAM_BOT_TOKEN ??= "test";
process.env.LLM_MODEL = ""; // luôn dùng parser luật trong test
process.env.AUTO_SCHEDULE = "0"; // tự xếp lịch được test riêng trong slot.test.ts
const { openDb } = await import("../src/db.ts");
const { createTaskService, renderProgressBar, formatTaskCard, formatReminder, parseTaskId } = await import("../src/tasks.ts");
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

test("db.getDailyStats đếm đúng task hoàn thành và tồn đọng hôm nay", () => {
  const db = openDb(":memory:");
  const now = Date.now();
  const t1 = db.addTask(100, "Việc 1", now + 1000, null, "telegram");
  const t2 = db.addTask(100, "Việc 2", now + 2000, null, "telegram");
  const t3 = db.addTask(100, "Việc inbox", null, null, "telegram");
  db.setStatus(t1.id, 100, "done");

  const stats = db.getDailyStats(100, now - 10000, now + 10000);
  assert.equal(stats.doneToday, 1);
  assert.equal(stats.pendingToday, 1);
  assert.equal(stats.inbox, 1);
});

test("db.getDailyStats đếm cả task quá hạn vào pendingToday", () => {
  const db = openDb(":memory:");
  const now = Date.now();
  // Task quá hạn từ hôm qua
  db.addTask(100, "Việc hôm qua", now - 50000, null, "telegram");
  // Task hôm nay
  db.addTask(100, "Việc hôm nay", now + 5000, null, "telegram");

  const stats = db.getDailyStats(100, now - 10000, now + 10000);
  assert.equal(stats.pendingToday, 2);
});


test("formatReminder hiển thị rõ thời gian hẹn và thời gian đặt việc", () => {
  const task = {
    id: 42,
    chat_id: 123,
    text: "Uống thuốc đau đầu",
    due_at: 1774843200000,
    next_remind_at: 1774843200000,
    remind_count: 0,
    recurring: null,
    status: "pending" as const,
    source: "telegram",
    created_at: 1774800000000,
  };
  const msg = formatReminder(task, 6);
  assert.match(msg, /\[Việc #42\] · Đến giờ rồi!/);
  assert.match(msg, /Hẹn lúc:/);
  assert.match(msg, /Đặt lúc:/);
  assert.match(msg, /<blockquote>Uống thuốc đau đầu<\/blockquote>/);
});


test("reminderKeyboard có nút '✍️ Giờ khác' (mv:id)", async () => {
  const { reminderKeyboard } = await import("../src/tasks.ts");
  const rKb = reminderKeyboard(123);
  const allButtons = rKb.inline_keyboard.flat();
  const mvBtn = allButtons.find((b) => "callback_data" in b && b.callback_data === "mv:123");
  assert.ok(mvBtn, "Phải có nút callback_data mv:123");
  assert.equal(mvBtn.text, "✍️ Giờ khác");
});


test("formatGroupedTasks phân nhóm rõ ràng Quá hạn và Sắp tới", async () => {
  const { formatGroupedTasks } = await import("../src/tasks.ts");
  const now = Date.now();
  const tasks = [
    {
      id: 1,
      chat_id: 123,
      text: "Việc trễ",
      due_at: now - 3600_000,
      next_remind_at: now - 3600_000,
      remind_count: 0,
      recurring: null,
      status: "pending" as const,
      source: "telegram",
      created_at: now - 7200_000,
    },
    {
      id: 2,
      chat_id: 123,
      text: "Việc chiều nay",
      due_at: now + 3600_000,
      next_remind_at: now + 3600_000,
      remind_count: 0,
      recurring: null,
      status: "pending" as const,
      source: "telegram",
      created_at: now,
    },
  ];
  const formatted = formatGroupedTasks(tasks, { now, tzOffsetMin: 420 });
  assert.match(formatted, /QUÁ HẠN/);
  assert.match(formatted, /Việc trễ/);
  assert.match(formatted, /HÔM NAY/);
  assert.match(formatted, /Việc chiều nay/);
});

test("parseTaskId phân tích chính xác #2, # 2, 2 và từ chối chuỗi không hợp lệ", () => {
  assert.equal(parseTaskId("#2"), 2);
  assert.equal(parseTaskId("# 2"), 2);
  assert.equal(parseTaskId("2"), 2);
  assert.equal(parseTaskId("  #42  "), 42);
  assert.equal(parseTaskId(""), null);
  assert.equal(parseTaskId("#"), null);
  assert.equal(parseTaskId("abc"), null);
  assert.equal(parseTaskId("-1"), null);
  assert.equal(parseTaskId("0"), null);
});

test("formatReminder với maxRepeats = 3 hiển thị đúng tiến độ nhắc lại và cảnh báo lần cuối", () => {
  const task = {
    id: 2,
    chat_id: 123,
    text: "Họp phòng ban",
    due_at: Date.now(),
    next_remind_at: Date.now(),
    remind_count: 1, // Lần nhắc lại thứ 2
    recurring: null,
    status: "pending" as const,
    source: "telegram",
    created_at: Date.now() - 3600_000,
  };
  const msg2 = formatReminder(task, 3);
  assert.match(msg2, /Nhắc lại \(lần 2\/3\)/);
  assert.doesNotMatch(msg2, /lần nhắc cuối/);

  // Lần nhắc thứ 3 (cuối cùng)
  task.remind_count = 2;
  const msg3 = formatReminder(task, 3);
  assert.match(msg3, /Nhắc lại \(lần 3\/3\)/);
  assert.match(msg3, /lần nhắc cuối/);
});

test("xóa việc thành công khi dùng mã ID có tiền tố # (ví dụ /del #2)", async () => {
  const db = openDb(":memory:");
  const tasks = createTaskService(db);
  const { task } = await tasks.add(CHAT, "mua hoa quả", "telegram");
  assert.equal(task.id, 1);

  // Parse id từ "#1"
  const parsedId = parseTaskId("#1");
  assert.equal(parsedId, 1);

  const deleted = tasks.remove(parsedId!, CHAT);
  assert.equal(deleted, true);
  assert.equal(db.pendingTasks(CHAT).length, 0);
});
