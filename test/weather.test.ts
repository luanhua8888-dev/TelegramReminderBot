import test from "node:test";
import assert from "node:assert/strict";
import {
  getWeatherDesc,
  generateWeatherAdvice,
  resolveLocation,
  formatWeatherMessage,
  extractWeatherLocation,
  isWeatherQuery,
  weatherKeyboard,
  type WeatherData,
} from "../src/weather.ts";

test("getWeatherDesc trả về đúng mô tả và icon cho mã WMO", () => {
  assert.deepEqual(getWeatherDesc(0), { text: "Trời quang, nắng đẹp", icon: "☀️" });
  assert.deepEqual(getWeatherDesc(3), { text: "Nhiều mây, âm u", icon: "☁️" });
  assert.deepEqual(getWeatherDesc(61), { text: "Mưa rào / Mưa", icon: "🌧" });
  assert.deepEqual(getWeatherDesc(95), { text: "Dông sét, giông bão", icon: "⛈" });
});

test("generateWeatherAdvice đưa ra cảnh báo mưa và UV chính xác", () => {
  // Khi có nguy cơ mưa cao và UV cao
  const advice1 = generateWeatherAdvice(75, 8.5, 32, 33, 61);
  assert.ok(advice1.includes("mang theo áo mưa hoặc dù"));
  assert.ok(advice1.includes("Chỉ số UV cực đại rất cao"));

  // Khi trời đẹp, mát mẻ
  const advice2 = generateWeatherAdvice(10, 4.0, 26, 28, 1);
  assert.ok(advice2.includes("Thời tiết khá dễ chịu"));
});

test("resolveLocation nhận diện đúng các địa điểm định sẵn", async () => {
  const bt = await resolveLocation("bình thạnh");
  assert.equal(bt.name, "Bình Thạnh, TP.HCM");
  assert.equal(bt.lat, 10.8106);

  const q1 = await resolveLocation("quan 1");
  assert.equal(q1.name, "Quận 1, TP.HCM");

  const hn = await resolveLocation("Hà Nội");
  assert.equal(hn.name, "Hà Nội");
  assert.equal(hn.lat, 21.0285);
});

test("extractWeatherLocation trích xuất chuẩn tên địa điểm từ câu hỏi tự nhiên", () => {
  assert.equal(extractWeatherLocation("thời tiết bình thạnh hôm nay như nào?"), "bình thạnh");
  assert.equal(extractWeatherLocation("thời tiết hôm nay thế nào"), "bình thạnh"); // fallback mặc định
  assert.equal(extractWeatherLocation("dự báo thời tiết quận 1"), "quận 1");
  assert.equal(extractWeatherLocation("thời tiết đà lạt hôm nay"), "đà lạt");
  assert.equal(extractWeatherLocation("/tt hà nội"), "hà nội");
});

test("isWeatherQuery nhận diện chính xác câu hỏi thời tiết và không nhầm việc note", () => {
  assert.equal(isWeatherQuery("thời tiết bình thạnh hôm nay như nào?"), true);
  assert.equal(isWeatherQuery("thời tiết hôm nay"), true);
  assert.equal(isWeatherQuery("thoi tiet quan 1"), true);
  assert.equal(isWeatherQuery("hôm nay có mưa không"), true);
  assert.equal(isWeatherQuery("trời hôm nay mưa không"), true);

  // Không bắt nhầm lệnh hoặc note thông thường
  assert.equal(isWeatherQuery("/tt"), false);
  assert.equal(isWeatherQuery("mai 9h họp"), false);
  assert.equal(isWeatherQuery("mua sữa"), false);
});

test("formatWeatherMessage tạo thẻ HTML trực quan", () => {
  const mockData: WeatherData = {
    locationName: "Bình Thạnh, TP.HCM",
    locationKey: "binh_thanh",
    temperature: 31,
    apparentTemperature: 35,
    tempMin: 25,
    tempMax: 33,
    humidity: 65,
    windSpeed: 12,
    weatherCode: 2,
    conditionText: "Mây rải rác",
    conditionIcon: "⛅",
    rainProbability: 25,
    uvIndexMax: 8.2,
    precipitationSum: 0,
    updatedAt: new Date("2026-10-26T15:30:00+07:00"),
    advice: "🧴 Chỉ số UV cực đại rất cao (8.2), tránh ra nắng gắt buổi trưa.",
  };

  const html = formatWeatherMessage(mockData);
  assert.ok(html.includes("DỰ BÁO THỜI TIẾT HÔM NAY"));
  assert.ok(html.includes("Bình Thạnh, TP.HCM"));
  assert.ok(html.includes("31°C"));
  assert.ok(html.includes("Mây rải rác ⛅"));
  assert.ok(html.includes("Chỉ số UV cực đại: <b>8.2</b>"));
  assert.ok(html.includes("Lời khuyên hôm nay:"));
});

test("weatherKeyboard có đủ nút cập nhật và các địa điểm nhanh", () => {
  const kb = weatherKeyboard("binh_thanh");
  assert.ok(kb.inline_keyboard.length >= 3);
  const flat = kb.inline_keyboard.flat();
  assert.ok(flat.some((b) => "callback_data" in b && b.callback_data === "weather:refresh:binh_thanh"));
  assert.ok(flat.some((b) => "callback_data" in b && b.callback_data === "weather:loc:binh_thanh"));
  assert.ok(flat.some((b) => "callback_data" in b && b.callback_data === "weather:loc:ha_noi"));
});
