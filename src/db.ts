import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Recurring } from "./parser.ts";

export type TaskStatus = "pending" | "done" | "deleted";
export type Task = {
  id: number;
  chat_id: number;
  text: string;
  due_at: number | null; // epoch ms, null = chưa có giờ (nằm trong inbox)
  next_remind_at: number | null;
  remind_count: number;
  recurring: Recurring;
  status: TaskStatus;
  source: string;
  created_at: number;
};

// Người dùng ngoài host: xin quyền → host duyệt hoặc từ chối
export type UserStatus = "pending" | "approved" | "rejected";
export type User = { chat_id: number; name: string; status: UserStatus; updated_at: number };

export function openDb(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      due_at INTEGER,
      next_remind_at INTEGER,
      remind_count INTEGER NOT NULL DEFAULT 0,
      recurring TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'telegram',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_remind ON tasks(status, next_remind_at);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      chat_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const q = {
    insert: db.prepare(
      `INSERT INTO tasks (chat_id, text, due_at, next_remind_at, recurring, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    ),
    get: db.prepare(`SELECT * FROM tasks WHERE id = ? AND chat_id = ?`),
    pending: db.prepare(
      `SELECT * FROM tasks WHERE chat_id = ? AND status = 'pending'
       ORDER BY due_at IS NULL, due_at, id`,
    ),
    dueForReminder: db.prepare(
      `SELECT * FROM tasks WHERE status = 'pending' AND next_remind_at IS NOT NULL AND next_remind_at <= ?
       ORDER BY next_remind_at`,
    ),
    setStatus: db.prepare(`UPDATE tasks SET status = ?, next_remind_at = NULL WHERE id = ? AND chat_id = ?`),
    reschedule: db.prepare(
      `UPDATE tasks SET due_at = ?, next_remind_at = ?, remind_count = 0, status = 'pending' WHERE id = ? AND chat_id = ?`,
    ),
    markReminded: db.prepare(`UPDATE tasks SET remind_count = remind_count + 1, next_remind_at = ? WHERE id = ?`),
    chats: db.prepare(`SELECT DISTINCT chat_id FROM tasks WHERE status = 'pending'`),
    getMeta: db.prepare(`SELECT value FROM meta WHERE key = ?`),
    setMeta: db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`),
    countPending: db.prepare(`SELECT count(*) AS n FROM tasks WHERE chat_id = ? AND status = 'pending'`),
    getUser: db.prepare(`SELECT * FROM users WHERE chat_id = ?`),
    setUser: db.prepare(
      `INSERT INTO users (chat_id, name, status, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET name = excluded.name, status = excluded.status, updated_at = excluded.updated_at`,
    ),
    listUsers: db.prepare(`SELECT * FROM users ORDER BY status, updated_at DESC`),
  };

  return {
    addTask(chatId: number, text: string, dueAt: number | null, recurring: Recurring, source: string): Task {
      return q.insert.get(chatId, text, dueAt, dueAt, recurring, source, Date.now()) as Task;
    },
    getTask(id: number, chatId: number): Task | undefined {
      return q.get.get(id, chatId) as Task | undefined;
    },
    pendingTasks(chatId: number): Task[] {
      return q.pending.all(chatId) as Task[];
    },
    tasksToRemind(now: number): Task[] {
      return q.dueForReminder.all(now) as Task[];
    },
    setStatus(id: number, chatId: number, status: TaskStatus): boolean {
      return q.setStatus.run(status, id, chatId).changes > 0;
    },
    reschedule(id: number, chatId: number, dueAt: number): boolean {
      return q.reschedule.run(dueAt, dueAt, id, chatId).changes > 0;
    },
    /** Ghi nhận đã nhắc; `next` = lần nhắc lại tiếp theo, null = thôi không nhắc nữa. */
    markReminded(id: number, next: number | null): void {
      q.markReminded.run(next, id);
    },
    activeChats(): number[] {
      return (q.chats.all() as { chat_id: number }[]).map((r) => r.chat_id);
    },
    getMeta(key: string): string | undefined {
      return (q.getMeta.get(key) as { value: string } | undefined)?.value;
    },
    setMeta(key: string, value: string): void {
      q.setMeta.run(key, value);
    },
    countPending(chatId: number): number {
      return (q.countPending.get(chatId) as { n: number }).n;
    },
    getUser(chatId: number): User | undefined {
      return q.getUser.get(chatId) as User | undefined;
    },
    setUser(chatId: number, name: string, status: UserStatus): void {
      q.setUser.run(chatId, name, status, Date.now());
    },
    listUsers(): User[] {
      return q.listUsers.all() as User[];
    },
  };
}

export type Db = ReturnType<typeof openDb>;
