// Nghiệp vụ dùng chung cho Telegram, Zalo và scheduler.

import { InlineKeyboard } from "grammy";
import { config, llmEnabled } from "./config.ts";
import type { Db, Task } from "./db.ts";
import { llmParse } from "./llm.ts";
import { parseVietnamese, type Parsed } from "./parser.ts";
import { DAY, formatLocal, fromLocal, startOfLocalDay, toLocal } from "./time.ts";

export type AddResult = { task: Task; auto: boolean; via: "llm" | "rules" };

export function createTaskService(db: Db) {
  async function parse(input: string, chatId: number, now: number): Promise<{ parsed: Parsed; auto: boolean; via: "llm" | "rules" }> {
    if (llmEnabled) {
      try {
        const busy = db
          .pendingTasks(chatId)
          .filter((t) => t.due_at !== null && t.due_at > now)
          .slice(0, 40)
          .map((t) => ({ text: t.text, dueAt: t.due_at! }));
        const r = await llmParse(input, now, busy);
        if (r) return { parsed: r, auto: r.auto, via: "llm" };
      } catch (err) {
        console.warn("[llm] lỗi, dùng parser luật:", (err as Error).message);
      }
    }
    const parsed = parseVietnamese(input, { now, tzOffsetMin: config.tzOffsetMin, defaultHour: config.defaultHour });
    return { parsed, auto: false, via: "rules" };
  }

  return {
    async add(chatId: number, input: string, source: string): Promise<AddResult> {
      const { parsed, auto, via } = await parse(input, chatId, Date.now());
      const task = db.addTask(chatId, parsed.text, parsed.dueAt, parsed.recurring, source);
      return { task, auto, via };
    },

    /** Việc lặp lại → dời sang lần kế tiếp; việc thường → đánh dấu xong. */
    complete(id: number, chatId: number): { task: Task; nextDue: number | null } | null {
      const task = db.getTask(id, chatId);
      if (!task || task.status !== "pending") return null;
      if (task.recurring && task.due_at !== null) {
        const step = task.recurring === "daily" ? DAY : 7 * DAY;
        let next = task.due_at + step;
        while (next <= Date.now()) next += step;
        db.reschedule(id, chatId, next);
        return { task, nextDue: next };
      }
      db.setStatus(id, chatId, "done");
      return { task, nextDue: null };
    },

    remove(id: number, chatId: number): boolean {
      return db.setStatus(id, chatId, "deleted");
    },

    snooze(id: number, chatId: number, ms: number): number | null {
      const at = Date.now() + ms;
      return db.reschedule(id, chatId, at) ? at : null;
    },

    /** Dời sang ngày mai, giữ nguyên giờ cũ (không có giờ thì dùng giờ mặc định). */
    toTomorrow(id: number, chatId: number): number | null {
      const task = db.getTask(id, chatId);
      if (!task) return null;
      const off = config.tzOffsetMin;
      const tmr = toLocal(startOfLocalDay(Date.now(), off) + DAY, off);
      const old = task.due_at !== null ? toLocal(task.due_at, off) : { h: config.defaultHour, mi: 0 };
      const at = fromLocal(tmr.y, tmr.mo, tmr.d, old.h, old.mi, off);
      return db.reschedule(id, chatId, at) ? at : null;
    },

    reschedule(id: number, chatId: number, input: string): number | null {
      const r = parseVietnamese(input, { now: Date.now(), tzOffsetMin: config.tzOffsetMin, defaultHour: config.defaultHour });
      if (r.dueAt === null) return null;
      return db.reschedule(id, chatId, r.dueAt) ? r.dueAt : null;
    },
  };
}

export type TaskService = ReturnType<typeof createTaskService>;

// ---------- hiển thị ----------

const RECUR_LABEL = { daily: "🔁 hằng ngày", weekly: "🔁 hằng tuần" } as const;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function when(epoch: number | null): string {
  return epoch === null ? "chưa có giờ" : formatLocal(epoch, config.tzOffsetMin);
}

export function formatTask(t: Task): string {
  const parts = [`<b>#${t.id}</b> ${escapeHtml(t.text)}`, `⏰ ${when(t.due_at)}`];
  if (t.recurring) parts.push(RECUR_LABEL[t.recurring]);
  if (t.source !== "telegram") parts.push(`📥 ${t.source}`);
  return parts.join(" · ");
}

export function taskKeyboard(id: number): InlineKeyboard {
  return new InlineKeyboard().text("✅ Xong", `done:${id}`).text("📅 Mai", `tmr:${id}`).text("🗑 Xoá", `del:${id}`);
}

export function reminderKeyboard(id: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Xong", `done:${id}`)
    .text("⏰ +15p", `snz:${id}:15`)
    .text("⏰ +1h", `snz:${id}:60`)
    .row()
    .text("🌙 Tối nay", `snz:${id}:tonight`)
    .text("📅 Mai", `tmr:${id}`);
}
