// Parser tiếng Việt dựa trên luật, dùng khi chưa cấu hình LLM hoặc LLM lỗi.
// Hiểu được: "9h", "9h30", "15:30", "9h rưỡi", "3h chiều", "tối nay", "mai", "mốt", "thứ 2", "t6",
// "chủ nhật", "25/12", "30p nữa", "sau 2 tiếng", "mỗi ngày", "hàng tuần", "tuần sau".

import { DAY, HOUR, fromLocal, toLocal } from "./time.ts";

export type Recurring = "daily" | "weekly" | null;
export type Parsed = { text: string; dueAt: number | null; recurring: Recurring };
export type ParseOptions = { now: number; tzOffsetMin: number; defaultHour: number };

// \b của JS không hiểu chữ có dấu, nên tự định nghĩa ranh giới từ
function word(src: string): RegExp {
  return new RegExp(`(?<=^|[\\s,.;:!?(])(?:${src})(?=$|[\\s,.;:!?)])`, "u");
}

const RE = {
  recurring: word("(?:mỗi|moi|hàng|hang|hằng)\\s*(ngày|ngay|sáng|sang|tối|toi|tuần|tuan)"),
  relative: word("(?:(sau|trong)\\s+)?(\\d+)\\s*(phút|phut|ph|p|m|tiếng|tieng|giờ|gio|h|ngày|ngay)(?:\\s*(nữa|nua))?"),
  date: word("(?:ngày\\s*)?(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?"),
  endOfWeek: word("cuối\\s*tuần(?:\\s*(này))?(?:\\s*(sau|tới))?"),
  monthEdge: word("(đầu|cuối)\\s*tháng(?:\\s*(này|sau|tới))?"),
  nextWeek: word("(?:đầu\\s*)?(?:tuần\\s*(?:sau|tới|toi)|tuan\\s*(?:sau|toi))"),
  weekday: word("(?:thứ|thu)\\s*(2|3|4|5|6|7|hai|ba|tư|tu|bốn|năm|sáu|bảy|bay)|t([2-7])|(chủ\\s*nhật|chu\\s*nhat|cn)"),
  // "chị Mai", "anh Mai"... là tên người, không phải "ngày mai"
  dayWord: word(
    "(?:ngày\\s*)?(?<!(?:chị|anh|em|cô|chú|bác|bạn|ông|bà|bé|dì|cậu|mợ|thím|sếp|c|a|e)\\s)(mai|mốt)|ngày\\s*(kia)|(?:hôm\\s*)?(nay)",
  ),
  // không nhận "sang", "toi", "dem" không dấu vì trùng "sang", "tôi", "đem"
  timeOfDay: word("(sáng|trưa|trua|chiều|chieu|tối|đêm)"),
  time: word("(?:lúc\\s*)?(\\d{1,2})\\s*(?:h|g|giờ|gio|:)\\s*(\\d{1,2}|rưỡi|ruoi)?\\s*(am|pm)?|lúc\\s*(\\d{1,2})"),
  filler: /^(?:nhắc|nhac|nhớ|nho)(?:\s+(?:tôi|toi|mình|minh|tui|tao|em|anh|chị|chi))?(?:\s+(?:là|la))?\s+/u,
};

const WEEKDAY_WORDS: Record<string, number> = { hai: 1, ba: 2, tư: 3, tu: 3, bốn: 3, năm: 4, sáu: 5, bảy: 6, bay: 6 };
const TOD_HOUR: Record<string, number> = { sáng: 8, trưa: 12, chiều: 15, tối: 20, đêm: 22 };
const TOD_ALIAS: Record<string, string> = { sang: "sáng", trua: "trưa", chieu: "chiều", toi: "tối" };

/** Giữ song song bản gốc và bản lowercase; match trên bản lowercase rồi xoá cùng vị trí ở cả hai. */
class Cursor {
  orig: string;
  lower: string;
  constructor(text: string) {
    this.orig = text.normalize("NFC");
    this.lower = this.orig.toLowerCase();
  }
  take(re: RegExp): RegExpMatchArray | null {
    const m = this.lower.match(re);
    if (m) this.erase(m);
    return m;
  }
  erase(m: RegExpMatchArray): void {
    const start = m.index!;
    const blank = " ".repeat(m[0].length);
    const cut = (s: string) => s.slice(0, start) + blank + s.slice(start + m[0].length);
    this.orig = cut(this.orig);
    this.lower = cut(this.lower);
  }
}

function cleanText(s: string, fallback: string): string {
  let t = s
    .replace(/(?<=^|\s)(?:vào\s+lúc|lúc|vào\s+ngày)(?=\s|$)/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,.;:\-–\s]+|[,;:\-–\s]+$/g, "")
    .trim();
  t = t.replace(RE.filler, "").replace(/(?:\s+(?:vào|lúc|ngày))+$/iu, "").trim();
  return t || fallback.trim();
}

export function parseVietnamese(input: string, opts: ParseOptions): Parsed {
  const { now, tzOffsetMin: off } = opts;
  const c = new Cursor(input);

  let recurring: Recurring = null;
  let tod: string | null = null;
  const rec = c.take(RE.recurring);
  if (rec) {
    const unit = rec[1];
    if (unit.startsWith("tu")) recurring = "weekly";
    else {
      recurring = "daily";
      if (!unit.startsWith("ng")) tod = TOD_ALIAS[unit] ?? unit;
    }
  }

  // "30p nữa", "sau 2 tiếng" → tính từ bây giờ, không cần xét ngày giờ khác
  // phải có "sau/trong" hoặc "nữa", nếu không "9h" sẽ bị hiểu là "9 tiếng"
  const relMatch = [...c.lower.matchAll(new RegExp(RE.relative.source, "gu"))].find((m) => m[1] || m[4]);
  if (relMatch) {
    c.erase(relMatch);
    const n = Number(relMatch[2]);
    const unit = relMatch[3];
    const ms = /^(ph|p|m)/.test(unit) ? n * 60_000 : /^ng/.test(unit) ? n * DAY : n * HOUR;
    return { text: cleanText(c.orig, input), dueAt: now + ms, recurring };
  }

  const today = toLocal(now, off);
  let y = today.y;
  let mo = today.mo;
  let d = today.d;
  let hasDay = false;
  let explicitYear = false;
  let weekday: number | null = null;

  const date = c.take(RE.date);
  if (date) {
    d = Number(date[1]);
    mo = Number(date[2]);
    if (date[3]) {
      y = Number(date[3]);
      if (y < 100) y += 2000;
      explicitYear = true;
    }
    hasDay = true;
  }

  // "đầu tháng sau" → ngày 1 tháng sau; "cuối tháng" → ngày cuối tháng này
  const me = c.take(RE.monthEdge);
  if (me && !hasDay) {
    const nextMonth = me[2] === "sau" || me[2] === "tới" || (me[1] === "đầu" && !me[2]);
    if (nextMonth) mo += 1;
    if (mo > 12) {
      mo = 1;
      y += 1;
    }
    d = me[1] === "đầu" ? 1 : new Date(Date.UTC(y, mo, 0)).getUTCDate();
    hasDay = true;
    explicitYear = true;
  }

  // "cuối tuần" = thứ 7; "cuối tuần sau" = thứ 7 tuần sau
  const eow = c.take(RE.endOfWeek);
  let nextWeek = Boolean(eow?.[2]);
  nextWeek = Boolean(c.take(RE.nextWeek)) || nextWeek;

  const wd = eow ? null : c.take(RE.weekday);
  if (eow) weekday = 6;
  if (wd) {
    if (wd[3]) weekday = 0;
    else if (wd[2]) weekday = Number(wd[2]) - 1;
    else weekday = /^\d$/.test(wd[1]) ? Number(wd[1]) - 1 : WEEKDAY_WORDS[wd[1]];
  }

  let dayOffset: number | null = null;
  const tdMatch = c.take(RE.timeOfDay);
  if (tdMatch) tod = TOD_ALIAS[tdMatch[1]] ?? tdMatch[1];

  const dw = c.take(RE.dayWord);
  if (dw) dayOffset = dw[3] ? 0 : dw[1] === "mai" ? 1 : 2;

  let hour: number | null = null;
  let minute = 0;
  const tm = c.take(RE.time);
  if (tm) {
    hour = Number(tm[1] ?? tm[4]);
    const minPart = tm[2];
    if (minPart) minute = /^\d/.test(minPart) ? Number(minPart) : 30;
    const pm = tm[3] === "pm" || tod === "chiều" || tod === "tối" || (tod === "đêm" && hour >= 6);
    if (pm && hour < 12) hour += 12;
    else if (!tod && !tm[3] && hour >= 1 && hour <= 5) hour += 12; // "3h" gần như luôn là 3h chiều
    if (hour > 23 || minute > 59) hour = null;
  }

  const hasTime = hour !== null || tod !== null;
  if (!hasDay && dayOffset === null && weekday === null && !hasTime && !nextWeek && !recurring) {
    return { text: cleanText(c.orig, input), dueAt: null, recurring: null };
  }

  const h = hour ?? (tod ? TOD_HOUR[tod] : opts.defaultHour);
  let due = fromLocal(y, mo, d, h, minute, off);

  if (dayOffset !== null) {
    due += dayOffset * DAY;
  } else if (weekday !== null) {
    let diff = (weekday - today.dow + 7) % 7;
    if (diff === 0 && due <= now) diff = 7;
    due += diff * DAY;
  } else if (hasDay) {
    if (!explicitYear && due < now - DAY) due = fromLocal(y + 1, mo, d, h, minute, off);
  } else if (due <= now) {
    // chỉ nói giờ mà giờ đó đã qua → hiểu là ngày mai
    due += DAY;
  }
  if (nextWeek && dayOffset === null && !hasDay) {
    // "tuần sau" → thứ 2 tuần sau; "thứ 6 tuần sau" → thứ 6 của tuần sau (tuần bắt đầu từ thứ 2)
    const toMonday = (1 - today.dow + 7) % 7 || 7;
    const fromMonday = weekday === null ? 0 : (weekday + 6) % 7;
    due = fromLocal(y, mo, d, h, minute, off) + (toMonday + fromMonday) * DAY;
  }

  return { text: cleanText(c.orig, input), dueAt: due, recurring };
}
