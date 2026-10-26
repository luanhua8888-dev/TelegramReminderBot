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
  last_msg_id?: number | null;
};

// Người dùng ngoài host: xin quyền → host duyệt hoặc từ chối
export type UserStatus = "pending" | "approved" | "rejected";
export type User = { chat_id: number; name: string; status: UserStatus; updated_at: number };
export type DailyStats = { doneToday: number; pendingToday: number; inbox: number };

export type FarmUser = {
  chat_id: number;
  coins: number;
  water: number;
  food: number;
  exp: number;
  last_daily: number;
  updated_at: number;
};

export type FarmPlot = {
  id: number;
  chat_id: number;
  slot_index: number;
  plant_type: string | null;
  planted_at: number | null;
  harvest_at: number | null;
  watered: number;
};

export type FarmFish = {
  id: number;
  chat_id: number;
  fish_type: string;
  fed_count: number;
  max_fed: number;
  bought_at: number;
  last_fed_at: number;
};

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
    CREATE TABLE IF NOT EXISTS farm_users (
      chat_id INTEGER PRIMARY KEY,
      coins INTEGER NOT NULL DEFAULT 100,
      water INTEGER NOT NULL DEFAULT 5,
      food INTEGER NOT NULL DEFAULT 5,
      exp INTEGER NOT NULL DEFAULT 0,
      last_daily INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS farm_plots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      slot_index INTEGER NOT NULL,
      plant_type TEXT,
      planted_at INTEGER,
      harvest_at INTEGER,
      watered INTEGER NOT NULL DEFAULT 0,
      UNIQUE(chat_id, slot_index)
    );
    CREATE TABLE IF NOT EXISTS farm_fishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      fish_type TEXT NOT NULL,
      fed_count INTEGER NOT NULL DEFAULT 0,
      max_fed INTEGER NOT NULL DEFAULT 3,
      bought_at INTEGER NOT NULL,
      last_fed_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  try {
    db.exec("ALTER TABLE tasks ADD COLUMN last_msg_id INTEGER");
  } catch {
    // Column already exists
  }

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
    setLastMsgId: db.prepare(`UPDATE tasks SET last_msg_id = ? WHERE id = ?`),
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
    dailyStats: db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'done' AND due_at IS NOT NULL AND due_at >= ? AND due_at < ? THEN 1 ELSE 0 END), 0) AS doneToday,
        COALESCE(SUM(CASE WHEN status = 'pending' AND due_at IS NOT NULL AND due_at < ? THEN 1 ELSE 0 END), 0) AS pendingToday,
        COALESCE(SUM(CASE WHEN status = 'pending' AND due_at IS NULL THEN 1 ELSE 0 END), 0) AS inbox
      FROM tasks WHERE chat_id = ?
    `),
    getFarmUser: db.prepare(`SELECT * FROM farm_users WHERE chat_id = ?`),
    initFarmUser: db.prepare(
      `INSERT INTO farm_users (chat_id, coins, water, food, exp, last_daily, updated_at)
       VALUES (?, 100, 5, 5, 0, 0, ?) ON CONFLICT(chat_id) DO NOTHING`,
    ),
    updateFarmUser: db.prepare(
      `UPDATE farm_users SET coins = ?, water = ?, food = ?, exp = ?, last_daily = ?, updated_at = ? WHERE chat_id = ?`,
    ),
    getFarmPlots: db.prepare(`SELECT * FROM farm_plots WHERE chat_id = ? ORDER BY slot_index ASC`),
    initFarmPlot: db.prepare(
      `INSERT INTO farm_plots (chat_id, slot_index, plant_type, planted_at, harvest_at, watered)
       VALUES (?, ?, null, null, null, 0) ON CONFLICT(chat_id, slot_index) DO NOTHING`,
    ),
    updateFarmPlot: db.prepare(
      `UPDATE farm_plots SET plant_type = ?, planted_at = ?, harvest_at = ?, watered = ?
       WHERE chat_id = ? AND slot_index = ?`,
    ),
    getFarmFishes: db.prepare(`SELECT * FROM farm_fishes WHERE chat_id = ? ORDER BY id ASC`),
    addFarmFish: db.prepare(
      `INSERT INTO farm_fishes (chat_id, fish_type, fed_count, max_fed, bought_at, last_fed_at)
       VALUES (?, ?, 0, ?, ?, 0) RETURNING id`,
    ),
    feedFarmFish: db.prepare(
      `UPDATE farm_fishes SET fed_count = fed_count + 1, last_fed_at = ? WHERE id = ? AND chat_id = ?`,
    ),
    deleteFarmFish: db.prepare(`DELETE FROM farm_fishes WHERE id = ? AND chat_id = ?`),
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
    setLastMsgId(id: number, msgId: number | null): void {
      q.setLastMsgId.run(msgId, id);
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
    getDailyStats(chatId: number, startOfDay: number, endOfDay: number): DailyStats {
      const row = q.dailyStats.get(startOfDay, endOfDay, endOfDay, chatId) as
        | { doneToday: number; pendingToday: number; inbox: number }
        | undefined;
      return {
        doneToday: Number(row?.doneToday ?? 0),
        pendingToday: Number(row?.pendingToday ?? 0),
        inbox: Number(row?.inbox ?? 0),
      };
    },
    getOrCreateFarmUser(chatId: number): FarmUser {
      let user = q.getFarmUser.get(chatId) as FarmUser | undefined;
      if (!user) {
        q.initFarmUser.run(chatId, Date.now());
        q.initFarmPlot.run(chatId, 0);
        q.initFarmPlot.run(chatId, 1);
        q.initFarmPlot.run(chatId, 2);
        user = q.getFarmUser.get(chatId) as FarmUser;
      }
      return user;
    },
    saveFarmUser(user: FarmUser): void {
      q.updateFarmUser.run(user.coins, user.water, user.food, user.exp, user.last_daily, Date.now(), user.chat_id);
    },
    getFarmPlots(chatId: number): FarmPlot[] {
      this.getOrCreateFarmUser(chatId);
      return q.getFarmPlots.all(chatId) as FarmPlot[];
    },
    saveFarmPlot(
      chatId: number,
      slotIndex: number,
      plantType: string | null,
      plantedAt: number | null,
      harvestAt: number | null,
      watered: number,
    ): void {
      q.updateFarmPlot.run(plantType, plantedAt, harvestAt, watered, chatId, slotIndex);
    },
    getFarmFishes(chatId: number): FarmFish[] {
      return q.getFarmFishes.all(chatId) as FarmFish[];
    },
    addFarmFish(chatId: number, fishType: string, maxFed: number): number {
      const res = q.addFarmFish.get(chatId, fishType, maxFed, Date.now()) as { id: number };
      return res.id;
    },
    feedFarmFish(fishId: number, chatId: number): boolean {
      return q.feedFarmFish.run(Date.now(), fishId, chatId).changes > 0;
    },
    deleteFarmFish(fishId: number, chatId: number): boolean {
      return q.deleteFarmFish.run(fishId, chatId).changes > 0;
    },
  };
}

export type Db = ReturnType<typeof openDb>;
