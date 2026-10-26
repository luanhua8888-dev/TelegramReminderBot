// Mọi tính toán ngày giờ theo "giờ địa phương" (mặc định UTC+7).
// Mẹo: dịch epoch đi offset rồi dùng các hàm getUTC*, tránh phụ thuộc timezone của máy chạy bot.

const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export type LocalParts = { y: number; mo: number; d: number; h: number; mi: number; dow: number };

export function toLocal(epoch: number, offsetMin: number): LocalParts {
  const t = new Date(epoch + offsetMin * MIN);
  return {
    y: t.getUTCFullYear(),
    mo: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    h: t.getUTCHours(),
    mi: t.getUTCMinutes(),
    dow: t.getUTCDay(), // 0 = Chủ nhật
  };
}

export function fromLocal(y: number, mo: number, d: number, h: number, mi: number, offsetMin: number): number {
  return Date.UTC(y, mo - 1, d, h, mi) - offsetMin * MIN;
}

/** Epoch của 00:00 ngày (địa phương) chứa `epoch`. */
export function startOfLocalDay(epoch: number, offsetMin: number): number {
  const p = toLocal(epoch, offsetMin);
  return fromLocal(p.y, p.mo, p.d, 0, 0, offsetMin);
}

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const pad = (n: number) => String(n).padStart(2, "0");

export function formatLocal(epoch: number, offsetMin: number, now = Date.now()): string {
  const p = toLocal(epoch, offsetMin);
  const hm = `${pad(p.h)}:${pad(p.mi)}`;
  const dayDiff = Math.round((startOfLocalDay(epoch, offsetMin) - startOfLocalDay(now, offsetMin)) / DAY);
  if (dayDiff === 0) return `${hm} hôm nay`;
  if (dayDiff === 1) return `${hm} mai`;
  return `${hm} ${DOW[p.dow]} ${pad(p.d)}/${pad(p.mo)}`;
}

/** "YYYY-MM-DD HH:mm" theo giờ địa phương, dùng để trao đổi với LLM. */
export function toLocalIso(epoch: number, offsetMin: number): string {
  const p = toLocal(epoch, offsetMin);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`;
}

export function parseLocalIso(s: string, offsetMin: number): number | null {
  const m = s.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return fromLocal(y, mo, d, h, mi, offsetMin);
}

export function weekdayName(dow: number): string {
  return ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"][dow];
}
