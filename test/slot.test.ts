import { test } from "node:test";
import assert from "node:assert/strict";
import { findFreeSlot } from "../src/slot.ts";
import { fromLocal, toLocalIso } from "../src/time.ts";

const OFF = 420;
const at = (d: number, h: number, mi = 0) => fromLocal(2026, 10, d, h, mi, OFF);
const slot = (now: number, busy: number[] = []) =>
  toLocalIso(findFreeSlot({ now, busy, tzOffsetMin: OFF, workStartHour: 8, workEndHour: 21 }), OFF);

test("lịch trống → 30 phút sau, làm tròn mốc 15 phút", () => {
  assert.equal(slot(at(26, 10, 7)), "2026-10-26 10:45");
});

test("tránh việc đã có ±30 phút", () => {
  assert.equal(slot(at(26, 10, 0), [at(26, 10, 30), at(26, 11, 0)]), "2026-10-26 11:30");
});

test("sau giờ làm → sáng hôm sau", () => {
  assert.equal(slot(at(26, 20, 50)), "2026-10-27 08:00");
});

test("trước giờ làm → đúng giờ bắt đầu", () => {
  assert.equal(slot(at(26, 5, 0)), "2026-10-26 08:00");
});
