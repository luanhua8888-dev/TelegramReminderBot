import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVietnamese } from "../src/parser.ts";
import { fromLocal, toLocalIso } from "../src/time.ts";

const OFF = 420;
// Thứ 2, 26/10/2026, 10:00 giờ VN
const NOW = fromLocal(2026, 10, 26, 10, 0, OFF);
const opts = { now: NOW, tzOffsetMin: OFF, defaultHour: 9 };

function p(input: string) {
  const r = parseVietnamese(input, opts);
  return { text: r.text, due: r.dueAt === null ? null : toLocalIso(r.dueAt, OFF), recurring: r.recurring };
}

const cases: [string, string, string | null, string | null][] = [
  // input, text mong đợi, giờ mong đợi, lặp lại
  ["mua sữa", "mua sữa", null, null],
  ["mai 9h gọi khách A", "gọi khách A", "2026-10-27 09:00", null],
  ["gọi khách A lúc 15:30", "gọi khách A", "2026-10-26 15:30", null],
  ["họp 9h30", "họp", "2026-10-27 09:30", null], // 9h30 hôm nay đã qua → mai
  ["3h chiều nộp báo cáo", "nộp báo cáo", "2026-10-26 15:00", null],
  ["nộp báo cáo 3h", "nộp báo cáo", "2026-10-26 15:00", null],
  ["tối nay đọc sách", "đọc sách", "2026-10-26 20:00", null],
  ["8h tối nay xem phim", "xem phim", "2026-10-26 20:00", null],
  ["30p nữa uống thuốc", "uống thuốc", "2026-10-26 10:30", null],
  ["sau 2 tiếng gọi lại", "gọi lại", "2026-10-26 12:00", null],
  ["thứ 6 đóng tiền nhà", "đóng tiền nhà", "2026-10-30 09:00", null],
  ["t4 10h họp team", "họp team", "2026-10-28 10:00", null],
  ["chủ nhật đi chợ", "đi chợ", "2026-11-01 09:00", null],
  ["thứ hai tuần sau review", "review", "2026-11-02 09:00", null],
  ["25/12 mua quà", "mua quà", "2026-12-25 09:00", null],
  ["mỗi ngày 7h tập thể dục", "tập thể dục", "2026-10-27 07:00", "daily"],
  ["hàng tuần t2 9h họp giao ban", "họp giao ban", "2026-11-02 09:00", "weekly"],
  ["nhắc tôi mốt 9h rưỡi đi khám", "đi khám", "2026-10-28 09:30", null],
  ["nhắc mình ngày kia trả sách", "trả sách", "2026-10-28 09:00", null],
  ["11h đêm tắt máy", "tắt máy", "2026-10-26 23:00", null],
];

for (const [input, text, due, recurring] of cases) {
  test(input, () => {
    assert.deepEqual(p(input), { text, due, recurring });
  });
}
