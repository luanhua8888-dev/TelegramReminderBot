// Nghiệp vụ dùng chung cho Telegram, Zalo và scheduler.

import { InlineKeyboard } from "grammy";
import { config, llmEnabled } from "./config.ts";
import type { Db, Task } from "./db.ts";
import { llmParse } from "./llm.ts";
import { parseVietnamese, type Parsed } from "./parser.ts";
import { assertSafeContent } from "./security.ts";
import { findFreeSlot } from "./slot.ts";
import { DAY, formatLocal, fromLocal, startOfLocalDay, toLocal } from "./time.ts";

export type AddResult = { task: Task; auto: boolean };

export function createTaskService(db: Db) {
  // Thứ tự: parser luật (chính xác, có test) → LLM cho cách nói luật không hiểu → tự xếp khung trống
  async function parse(input: string, chatId: number, now: number): Promise<{ parsed: Parsed; auto: boolean }> {
    const rules = parseVietnamese(input, { now, tzOffsetMin: config.tzOffsetMin, defaultHour: config.defaultHour });
    if (rules.dueAt !== null) return { parsed: rules, auto: false };

    if (llmEnabled) {
      try {
        const r = await llmParse(input, now);
        if (r?.dueAt != null) return { parsed: r, auto: false };
      } catch (err) {
        console.warn("[llm] lỗi, bỏ qua:", (err as Error).message);
      }
    }

    if (!config.autoSchedule) return { parsed: rules, auto: false };
    const busy = db
      .pendingTasks(chatId)
      .map((t) => t.due_at)
      .filter((d): d is number => d !== null && d > now);
    const dueAt = findFreeSlot({
      now,
      busy,
      tzOffsetMin: config.tzOffsetMin,
      workStartHour: config.workStartHour,
      workEndHour: config.workEndHour,
    });
    return { parsed: { ...rules, dueAt }, auto: true };
  }

  return {
    async add(chatId: number, input: string, source: string): Promise<AddResult> {
      assertSafeContent(input);
      const { parsed, auto } = await parse(input, chatId, Date.now());
      const task = db.addTask(chatId, parsed.text, parsed.dueAt, parsed.recurring, source);
      return { task, auto };
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

/** Vẽ thanh tiến độ trực quan, ví dụ [▓▓▓▓░░░░░░] 40% */
export function renderProgressBar(done: number, total: number, size = 10): string {
  if (total <= 0) return `[${"░".repeat(size)}] 0%`;
  const ratio = Math.max(0, Math.min(1, done / total));
  const filled = Math.round(ratio * size);
  const empty = Math.max(0, size - filled);
  const percent = Math.round(ratio * 100);
  return `[${"▓".repeat(filled)}${"░".repeat(empty)}] ${percent}%`;
}

/** Định dạng task dạng Card UI đẹp mắt với HTML blockquote */
export function formatTaskCard(t: Task, index?: number): string {
  const prefix = index != null ? `<b>${index}.</b> ` : "";
  const timeStr = t.due_at !== null ? `⏰ <code>${when(t.due_at)}</code>` : "📥 <i>(chưa có giờ)</i>";
  const badges: string[] = [timeStr];
  if (t.recurring) badges.push(RECUR_LABEL[t.recurring]);
  if (t.source !== "telegram") badges.push(`📥 ${t.source}`);

  return `${prefix}<b>#${t.id}</b> · ${badges.join(" · ")}\n<blockquote>${escapeHtml(t.text)}</blockquote>`;
}

export function taskKeyboard(id: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Xong", `done:${id}`)
    .text("📅 Mai", `tmr:${id}`)
    .text("✍️ Giờ khác", `mv:${id}`)
    .text("🗑 Xoá", `del:${id}`);
}

export function reminderKeyboard(id: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Xong", `done:${id}`)
    .text("⏰ +15p", `snz:${id}:15`)
    .text("⏰ +1h", `snz:${id}:60`)
    .row()
    .text("🌙 Tối nay", `snz:${id}:tonight`)
    .text("📅 Mai", `tmr:${id}`)
    .text("✍️ Giờ khác", `mv:${id}`);
}


/**
 * Phân tích mã ID công việc từ chuỗi người dùng nhập (hỗ trợ '#2', '# 2', '2').
 * Trả về number hợp lệ hoặc null nếu không hợp lệ.
 */
export function parseTaskId(input: string): number | null {
  if (!input || typeof input !== "string") return null;
  const raw = input.trim().replace(/^#\s*/, "");
  const id = Number(raw);
  return !raw || isNaN(id) || id <= 0 ? null : id;
}

/** Định dạng nội dung tin nhắn nhắc việc khi tới giờ */
export function formatReminder(task: Task, maxRepeats = 3): string {
  const isRepeat = task.remind_count > 0;
  const last = task.remind_count + 1 >= maxRepeats;
  const header = isRepeat
    ? `🔔 <b>[Việc #${task.id}] · Nhắc lại (lần ${task.remind_count + 1}/${maxRepeats})</b>`
    : `🔔 <b>[Việc #${task.id}] · Đến giờ rồi!</b>`;

  const details: string[] = [];
  if (task.due_at !== null) {
    details.push(`⏰ Hẹn lúc: <b>${when(task.due_at)}</b>`);
  }
  if (task.created_at) {
    details.push(`📝 Đặt lúc: <i>${when(task.created_at)}</i>`);
  }
  const meta = details.length ? `\n${details.join(" · ")}` : "";
  const footer = last ? "\n\n<i>⚠️ Đây là lần nhắc cuối, bấm 📅 hoặc ✍️ để dời nếu chưa làm.</i>" : "";

  return `${header}${meta}\n\n<blockquote>${escapeHtml(task.text)}</blockquote>${footer}`;
}

/** Phân nhóm danh sách việc trực quan: Quá hạn, Hôm nay, Tương lai, Hộp thư */
export function formatGroupedTasks(
  tasks: Task[],
  options?: { now?: number; tzOffsetMin?: number },
): string {
  if (!tasks.length) return "🎉 <i>Không còn việc nào đang chờ.</i>";

  const now = options?.now ?? Date.now();
  const offset = options?.tzOffsetMin ?? config.tzOffsetMin;
  const endOfDay = startOfLocalDay(now, offset) + DAY;

  // 1. Quá hạn: có giờ và nhỏ hơn now - 1 phút
  const overdue = tasks.filter((t) => t.due_at !== null && t.due_at < now - 60_000);
  // 2. Hôm nay (sắp tới): từ now - 1 phút đến hết ngày hôm nay
  const upcomingToday = tasks.filter(
    (t) => t.due_at !== null && t.due_at >= now - 60_000 && t.due_at < endOfDay,
  );
  // 3. Ngày mai / tương lai xa hơn
  const future = tasks.filter((t) => t.due_at !== null && t.due_at >= endOfDay);
  // 4. Hộp thư (chưa xếp giờ)
  const inbox = tasks.filter((t) => t.due_at === null);

  const sections: string[] = [];

  if (overdue.length) {
    sections.push(
      `🔴 <b>QUÁ HẠN (${overdue.length})</b>\n` +
        overdue.map((t, idx) => formatTaskCard(t, idx + 1)).join("\n\n"),
    );
  }

  if (upcomingToday.length) {
    sections.push(
      `🟡 <b>HÔM NAY (${upcomingToday.length})</b>\n` +
        upcomingToday.map((t, idx) => formatTaskCard(t, idx + 1)).join("\n\n"),
    );
  }

  if (future.length) {
    sections.push(
      `📅 <b>SẮP TỚI (${future.length})</b>\n` +
        future.map((t, idx) => formatTaskCard(t, idx + 1)).join("\n\n"),
    );
  }

  if (inbox.length) {
    sections.push(
      `📥 <b>HỘP THƯ CHƯA XẾP GIỜ (${inbox.length})</b>\n` +
        inbox.map((t, idx) => formatTaskCard(t, idx + 1)).join("\n\n"),
    );
  }

  return sections.join("\n\n───────────────\n\n");
}
