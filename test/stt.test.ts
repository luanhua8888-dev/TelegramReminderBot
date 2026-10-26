import test from "node:test";
import assert from "node:assert/strict";

process.env.TELEGRAM_BOT_TOKEN ??= "test";
const { parseSttResponse } = await import("../src/stt.ts");

test("parseSttResponse trích xuất đúng chuỗi transcription từ JSON", () => {
  assert.equal(parseSttResponse({ text: "  mai 9h họp phòng kinh doanh  " }), "mai 9h họp phòng kinh doanh");
  assert.equal(parseSttResponse({}), "");
  assert.equal(parseSttResponse(null), "");
  assert.equal(parseSttResponse({ text: 123 }), "");
});
