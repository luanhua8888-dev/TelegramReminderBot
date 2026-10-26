// Tự xếp giờ cho việc không có giờ: khung trống sớm nhất trong giờ làm việc,
// cách các việc đã có ít nhất `gapMin` phút. Tính bằng code, không cần AI.

import { fromLocal, toLocal } from "./time.ts";

export type SlotOptions = {
  now: number;
  busy: number[]; // due_at của các việc đã có lịch
  tzOffsetMin: number;
  workStartHour: number;
  workEndHour: number;
  leadMin?: number; // xếp sớm nhất sau bao nhiêu phút kể từ bây giờ
  gapMin?: number;
};

const STEP = 15 * 60_000;

export function findFreeSlot(o: SlotOptions): number {
  const lead = (o.leadMin ?? 30) * 60_000;
  const gap = (o.gapMin ?? 30) * 60_000;
  // Làm tròn lên mốc 15 phút cho giờ đẹp
  let t = Math.ceil((o.now + lead) / STEP) * STEP;
  const limit = o.now + 14 * 24 * 3_600_000;
  for (; t < limit; t += STEP) {
    const p = toLocal(t, o.tzOffsetMin);
    if (p.h < o.workStartHour) {
      t = fromLocal(p.y, p.mo, p.d, o.workStartHour, 0, o.tzOffsetMin) - STEP;
      continue;
    }
    if (p.h >= o.workEndHour) {
      t = fromLocal(p.y, p.mo, p.d, 23, 45, o.tzOffsetMin); // vòng lặp cộng thêm 15p → 00:00 hôm sau
      continue;
    }
    if (o.busy.every((b) => Math.abs(b - t) >= gap)) return t;
  }
  return Math.ceil((o.now + lead) / STEP) * STEP;
}
