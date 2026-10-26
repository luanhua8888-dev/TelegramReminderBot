import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TELEGRAM_BOT_TOKEN ??= "test";

const { parseMuData, formatMuMessage, formatMuAlert, isMuQuery } = await import("../src/mu.ts");

test("parseMuData xác định đúng VÔ HANG khi MU thua", () => {
  const mockSchedule = {
    events: [
      {
        id: "101",
        date: "2026-10-25T14:00Z",
        name: "AFC Bournemouth at Manchester United",
        competitions: [
          {
            status: { type: { completed: true, detail: "FT" } },
            competitors: [
              { team: { id: "360", displayName: "Manchester United", shortDisplayName: "Man Utd" }, score: { displayValue: "0" } },
              { team: { id: "123", displayName: "AFC Bournemouth", shortDisplayName: "Bournemouth" }, score: { displayValue: "3" } },
            ],
          },
        ],
      },
    ],
  };

  const mockTeam = {
    team: {
      nextEvent: [
        {
          id: "102",
          date: "2026-10-31T12:30Z",
          name: "Manchester United at Chelsea",
          competitions: [
            {
              competitors: [
                { homeAway: "away", team: { id: "360", displayName: "Manchester United" } },
                { homeAway: "home", team: { id: "363", displayName: "Chelsea" } },
              ],
            },
          ],
        },
      ],
    },
  };

  const res = parseMuData(mockSchedule, mockTeam);
  assert.ok(res.lastMatch);
  assert.equal(res.currentCaveStatus, "vo_hang");
  assert.equal(res.lastMatch.muScore, 0);
  assert.equal(res.lastMatch.opponentScore, 3);
  assert.equal(res.lastMatch.opponentName, "AFC Bournemouth");
  assert.ok(res.nextMatch);
  assert.equal(res.nextMatch.opponent, "Chelsea");

  const formatted = formatMuMessage(res);
  assert.match(formatted, /VÔ HANG/);
  assert.match(formatted, /Bournemouth/);
  assert.match(formatted, /Chelsea/);
  assert.match(formatted, /Giải đấu:/);
  assert.match(formatted, /Khởi tranh:/);
  assert.match(formatted, /Thứ Bảy/);
});

test("parseMuData xác định đúng RA HANG khi MU thắng", () => {
  const mockSchedule = {
    events: [
      {
        id: "201",
        date: "2026-08-30T15:30Z",
        name: "Ipswich Town at Manchester United",
        competitions: [
          {
            status: { type: { completed: true, detail: "FT" } },
            competitors: [
              { team: { id: "360", displayName: "Manchester United", shortDisplayName: "Man Utd" }, score: { displayValue: "5" } },
              { team: { id: "999", displayName: "Ipswich Town", shortDisplayName: "Ipswich" }, score: { displayValue: "2" } },
            ],
          },
        ],
      },
    ],
  };

  const res = parseMuData(mockSchedule, null);
  assert.ok(res.lastMatch);
  assert.equal(res.currentCaveStatus, "ra_hang");
  assert.equal(res.lastMatch.muScore, 5);
  assert.equal(res.lastMatch.opponentScore, 2);

  const formatted = formatMuMessage(res);
  assert.match(formatted, /RA HANG/);
  assert.match(formatted, /GÁY/);

  const alertMsg = formatMuAlert(res);
  assert.match(alertMsg, /CHIẾN THẮNG/);
  assert.match(alertMsg, /RA HANG/);
});

test("parseMuData xác định đúng LẤP LÓ CỬA HANG khi hòa", () => {
  const mockSchedule = {
    events: [
      {
        id: "301",
        date: "2026-10-18T13:00Z",
        name: "Manchester United at Leeds United",
        competitions: [
          {
            status: { type: { completed: true, detail: "FT" } },
            competitors: [
              { team: { id: "360", displayName: "Manchester United" }, score: { displayValue: "1" } },
              { team: { id: "888", displayName: "Leeds United" }, score: { displayValue: "1" } },
            ],
          },
        ],
      },
    ],
  };

  const res = parseMuData(mockSchedule, null);
  assert.ok(res.lastMatch);
  assert.equal(res.currentCaveStatus, "lap_lo");

  const formatted = formatMuMessage(res);
  assert.match(formatted, /LẤP LÓ/);
});

test("isMuQuery nhận diện chuẩn các câu hỏi về MU và không match nhầm", () => {
  assert.equal(isMuQuery("MU"), true);
  assert.equal(isMuQuery("mu"), true);
  assert.equal(isMuQuery("manchester united"), true);
  assert.equal(isMuQuery("ra hang"), true);
  assert.equal(isMuQuery("vô hang"), true);
  assert.equal(isMuQuery("vào hang"), true);
  assert.equal(isMuQuery("tình hình mu"), true);
  assert.equal(isMuQuery("mu đá thế nào"), true);

  // Không match nhầm các câu nhắc việc thông thường
  assert.equal(isMuQuery("mua sữa"), false);
  assert.equal(isMuQuery("mượn sách thư viện"), false);
  assert.equal(isMuQuery("mục tiêu tuần này"), false);
  assert.equal(isMuQuery("họp lúc 9h"), false);
});
