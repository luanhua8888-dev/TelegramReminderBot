import { InlineKeyboard } from "grammy";

export interface WeatherData {
  locationName: string;
  locationKey: string;
  temperature: number;
  apparentTemperature: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  conditionText: string;
  conditionIcon: string;
  rainProbability: number;
  uvIndexMax: number;
  precipitationSum: number;
  updatedAt: Date;
  advice: string;
}

interface PresetLocation {
  name: string;
  key: string;
  lat: number;
  lon: number;
}

const PRESET_LOCATIONS: Record<string, PresetLocation> = {
  "binh thanh": { name: "Bình Thạnh, TP.HCM", key: "binh_thanh", lat: 10.8106, lon: 106.7091 },
  "bình thạnh": { name: "Bình Thạnh, TP.HCM", key: "binh_thanh", lat: 10.8106, lon: 106.7091 },
  "quan 1": { name: "Quận 1, TP.HCM", key: "quan_1", lat: 10.7756, lon: 106.7004 },
  "quận 1": { name: "Quận 1, TP.HCM", key: "quan_1", lat: 10.7756, lon: 106.7004 },
  "q1": { name: "Quận 1, TP.HCM", key: "quan_1", lat: 10.7756, lon: 106.7004 },
  "quan 7": { name: "Quận 7, TP.HCM", key: "quan_7", lat: 10.7327, lon: 106.7262 },
  "quận 7": { name: "Quận 7, TP.HCM", key: "quan_7", lat: 10.7327, lon: 106.7262 },
  "q7": { name: "Quận 7, TP.HCM", key: "quan_7", lat: 10.7327, lon: 106.7262 },
  "quan 2": { name: "Quận 2, TP.HCM", key: "quan_2", lat: 10.7872, lon: 106.7498 },
  "quận 2": { name: "Quận 2, TP.HCM", key: "quan_2", lat: 10.7872, lon: 106.7498 },
  "thu duc": { name: "TP. Thủ Đức, TP.HCM", key: "thu_duc", lat: 10.8494, lon: 106.7537 },
  "thủ đức": { name: "TP. Thủ Đức, TP.HCM", key: "thu_duc", lat: 10.8494, lon: 106.7537 },
  "go vap": { name: "Gò Vấp, TP.HCM", key: "go_vap", lat: 10.8388, lon: 106.6653 },
  "gò vấp": { name: "Gò Vấp, TP.HCM", key: "go_vap", lat: 10.8388, lon: 106.6653 },
  "tan binh": { name: "Tân Bình, TP.HCM", key: "tan_binh", lat: 10.8015, lon: 106.6526 },
  "tân bình": { name: "Tân Bình, TP.HCM", key: "tan_binh", lat: 10.8015, lon: 106.6526 },
  "phu nhuan": { name: "Phú Nhuận, TP.HCM", key: "phu_nhuan", lat: 10.7992, lon: 106.6803 },
  "phú nhuận": { name: "Phú Nhuận, TP.HCM", key: "phu_nhuan", lat: 10.7992, lon: 106.6803 },
  "tphcm": { name: "TP. Hồ Chí Minh", key: "tphcm", lat: 10.8231, lon: 106.6297 },
  "tp hcm": { name: "TP. Hồ Chí Minh", key: "tphcm", lat: 10.8231, lon: 106.6297 },
  "tp.hcm": { name: "TP. Hồ Chí Minh", key: "tphcm", lat: 10.8231, lon: 106.6297 },
  "sai gon": { name: "TP. Hồ Chí Minh", key: "tphcm", lat: 10.8231, lon: 106.6297 },
  "sài gòn": { name: "TP. Hồ Chí Minh", key: "tphcm", lat: 10.8231, lon: 106.6297 },
  "ho chi minh": { name: "TP. Hồ Chí Minh", key: "tphcm", lat: 10.8231, lon: 106.6297 },
  "hồ chí minh": { name: "TP. Hồ Chí Minh", key: "tphcm", lat: 10.8231, lon: 106.6297 },
  "ha noi": { name: "Hà Nội", key: "ha_noi", lat: 21.0285, lon: 105.8542 },
  "hà nội": { name: "Hà Nội", key: "ha_noi", lat: 21.0285, lon: 105.8542 },
  "da nang": { name: "Đà Nẵng", key: "da_nang", lat: 16.0544, lon: 108.2022 },
  "đà nẵng": { name: "Đà Nẵng", key: "da_nang", lat: 16.0544, lon: 108.2022 },
  "da lat": { name: "Đà Lạt, Lâm Đồng", key: "da_lat", lat: 11.9404, lon: 108.4583 },
  "đà lạt": { name: "Đà Lạt, Lâm Đồng", key: "da_lat", lat: 11.9404, lon: 108.4583 },
  "nha trang": { name: "Nha Trang, Khánh Hòa", key: "nha_trang", lat: 12.2388, lon: 109.1967 },
  "can tho": { name: "Cần Thơ", key: "can_tho", lat: 10.0452, lon: 105.7469 },
  "cần thơ": { name: "Cần Thơ", key: "can_tho", lat: 10.0452, lon: 105.7469 },
  "hai phong": { name: "Hải Phòng", key: "hai_phong", lat: 20.8449, lon: 106.6881 },
  "hải phòng": { name: "Hải Phòng", key: "hai_phong", lat: 20.8449, lon: 106.6881 },
  "vung tau": { name: "Vũng Tàu", key: "vung_tau", lat: 10.3460, lon: 107.0843 },
  "vũng tàu": { name: "Vũng Tàu", key: "vung_tau", lat: 10.3460, lon: 107.0843 },
  "hue": { name: "Thừa Thiên Huế", key: "hue", lat: 16.4637, lon: 107.5909 },
  "huế": { name: "Thừa Thiên Huế", key: "hue", lat: 16.4637, lon: 107.5909 },
  "ha long": { name: "Hạ Long, Quảng Ninh", key: "ha_long", lat: 20.9505, lon: 107.0734 },
  "hạ long": { name: "Hạ Long, Quảng Ninh", key: "ha_long", lat: 20.9505, lon: 107.0734 },
  "quang ninh": { name: "Hạ Long, Quảng Ninh", key: "ha_long", lat: 20.9505, lon: 107.0734 },
  "quảng ninh": { name: "Hạ Long, Quảng Ninh", key: "ha_long", lat: 20.9505, lon: 107.0734 },
  "binh duong": { name: "Bình Dương", key: "binh_duong", lat: 11.1667, lon: 106.6667 },
  "bình dương": { name: "Bình Dương", key: "binh_duong", lat: 11.1667, lon: 106.6667 },
  "dong nai": { name: "Biên Hòa, Đồng Nai", key: "dong_nai", lat: 10.9574, lon: 106.8427 },
  "đồng nai": { name: "Biên Hòa, Đồng Nai", key: "dong_nai", lat: 10.9574, lon: 106.8427 },
  "bien hoa": { name: "Biên Hòa, Đồng Nai", key: "dong_nai", lat: 10.9574, lon: 106.8427 },
  "biên hòa": { name: "Biên Hòa, Đồng Nai", key: "dong_nai", lat: 10.9574, lon: 106.8427 },
};

/** Diễn giải mã thời tiết WMO sang tiếng Việt và Icon sinh động */
export function getWeatherDesc(code: number): { text: string; icon: string } {
  switch (code) {
    case 0:
      return { text: "Trời quang, nắng đẹp", icon: "☀️" };
    case 1:
      return { text: "Ít mây, trời trong", icon: "🌤" };
    case 2:
      return { text: "Mây rải rác", icon: "⛅" };
    case 3:
      return { text: "Nhiều mây, âm u", icon: "☁️" };
    case 45:
    case 48:
      return { text: "Có sương mù", icon: "🌫" };
    case 51:
    case 53:
    case 55:
      return { text: "Mưa phùn nhẹ", icon: "🌦" };
    case 61:
    case 63:
    case 65:
      return { text: "Mưa rào / Mưa", icon: "🌧" };
    case 80:
    case 81:
    case 82:
      return { text: "Mưa rào nặng hạt", icon: "🌧🌧" };
    case 95:
    case 96:
    case 99:
      return { text: "Dông sét, giông bão", icon: "⛈" };
    default:
      return { text: "Có mây", icon: "🌤" };
  }
}

/** Đưa ra lời khuyên thiết thực theo tình hình thời tiết */
export function generateWeatherAdvice(
  rainProb: number,
  uvMax: number,
  temp: number,
  tempMax: number,
  weatherCode: number,
): string {
  const advices: string[] = [];

  // Mưa / Giông bão
  if (weatherCode >= 95) {
    advices.push("⛈ Có nguy cơ giông sét, sấm chớp, hạn chế đứng dưới gốc cây to hoặc ra ngoài khi mưa to!");
  } else if (rainProb >= 60) {
    advices.push(`☔ Khả năng mưa cao (${rainProb}%), bạn nhớ mang theo áo mưa hoặc dù khi ra ngoài nhé!`);
  } else if (rainProb >= 35) {
    advices.push(`🌂 Có thể có mưa rải rác (${rainProb}%), bạn nên chuẩn bị sẵn ô/dù.`);
  }

  // Tia UV
  if (uvMax >= 8) {
    advices.push(`🧴 Chỉ số UV cực đại rất cao (${uvMax}), tránh ra nắng gắt buổi trưa (11h-14h) và nhớ bôi kem chống nắng.`);
  } else if (uvMax >= 6) {
    advices.push(`🕶 Chỉ số UV ở mức cao (${uvMax}), nên đội mũ và mang kính mát khi ra đường.`);
  }

  // Nhiệt độ
  if (temp >= 35 || tempMax >= 36) {
    advices.push("🔥 Thời tiết khá oi bức, nhớ uống nhiều nước để tránh mất nước.");
  } else if (temp <= 18) {
    advices.push("🧣 Trời se lạnh, bạn nhớ mặc ấm khi ra ngoài vào sáng sớm hoặc đêm muộn.");
  }

  if (advices.length === 0) {
    advices.push("🌤 Thời tiết khá dễ chịu, rất thích hợp cho công việc và các hoạt động ngoài trời!");
  }

  return advices.join("\n");
}

/** Tìm tọa độ địa điểm theo preset hoặc gọi Geocoding API */
export async function resolveLocation(query: string): Promise<{ name: string; key: string; lat: number; lon: number }> {
  const norm = query.trim().toLowerCase();

  // 1. Kiểm tra preset trực tiếp
  if (PRESET_LOCATIONS[norm]) {
    return PRESET_LOCATIONS[norm];
  }

  // Kiểm tra từng từ khóa preset trong query
  for (const [key, preset] of Object.entries(PRESET_LOCATIONS)) {
    if (norm.includes(key)) {
      return preset;
    }
  }

  // Mặc định nếu rỗng
  if (!norm) {
    return PRESET_LOCATIONS["binh thanh"];
  }

  // 2. Tra cứu Geocoding API của Open-Meteo
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(norm)}&count=1&language=vi&format=json`;
    const res = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = (await res.json()) as { results?: Array<{ name: string; latitude: number; longitude: number; country?: string; admin1?: string }> };
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        const display = [item.name, item.admin1, item.country].filter(Boolean).join(", ");
        return {
          name: display,
          key: norm.replace(/[^a-z0-9]/gi, "_"),
          lat: item.latitude,
          lon: item.longitude,
        };
      }
    }
  } catch {
    // geocoding fallback
  }

  // Fallback về Bình Thạnh, TP.HCM
  return PRESET_LOCATIONS["binh thanh"];
}

/** Tải dữ liệu thời tiết thực tế từ Open-Meteo */
export async function fetchWeather(locationQuery = "bình thạnh"): Promise<WeatherData> {
  const loc = await resolveLocation(locationQuery);

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max,precipitation_sum&timezone=Asia%2FHo_Chi_Minh`;

  const res = await fetch(weatherUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TelegramReminderBot",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }

  const d = await res.json() as {
    current: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      weather_code: number;
      precipitation: number;
    };
    daily: {
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      uv_index_max: number[];
      precipitation_probability_max: number[];
      precipitation_sum?: number[];
      weather_code: number[];
    };
  };

  const current = d.current;
  const daily = d.daily;

  const code = current.weather_code ?? daily.weather_code?.[0] ?? 0;
  const condition = getWeatherDesc(code);
  const rainProb = daily.precipitation_probability_max?.[0] ?? 0;
  const uvMax = daily.uv_index_max?.[0] ?? 0;
  const tempMax = Math.round(daily.temperature_2m_max?.[0] ?? current.temperature_2m);
  const tempMin = Math.round(daily.temperature_2m_min?.[0] ?? current.temperature_2m);
  const precipSum = daily.precipitation_sum?.[0] ?? current.precipitation ?? 0;

  const advice = generateWeatherAdvice(rainProb, uvMax, current.temperature_2m, tempMax, code);

  return {
    locationName: loc.name,
    locationKey: loc.key,
    temperature: Math.round(current.temperature_2m),
    apparentTemperature: Math.round(current.apparent_temperature),
    tempMin,
    tempMax,
    humidity: current.relative_humidity_2m,
    windSpeed: Math.round(current.wind_speed_10m),
    weatherCode: code,
    conditionText: condition.text,
    conditionIcon: condition.icon,
    rainProbability: rainProb,
    uvIndexMax: Number(uvMax.toFixed(1)),
    precipitationSum: precipSum,
    updatedAt: new Date(),
    advice,
  };
}

/** Định dạng tin nhắn thời tiết sang HTML */
export function formatWeatherMessage(w: WeatherData): string {
  const timeStr = w.updatedAt.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  const uvBadge = w.uvIndexMax >= 8 ? " <i>(Rất cao ⚠️)</i>" : w.uvIndexMax >= 6 ? " <i>(Cao ⚠️)</i>" : " <i>(Trung bình)</i>";
  const rainBadge = w.rainProbability >= 60 ? " <i>(Khả năng cao ☔)</i>" : w.rainProbability >= 30 ? " <i>(Có thể có mưa 🌂)</i>" : "";

  return [
    `🌦 <b>DỰ BÁO THỜI TIẾT HÔM NAY</b> · <i>${timeStr}</i>`,
    `📍 Khu vực: <b>${escapeHtml(w.locationName)}</b>`,
    "",
    `• Tình trạng: <b>${w.conditionText} ${w.conditionIcon}</b>`,
    `• Nhiệt độ: <b>${w.temperature}°C</b> <i>(cảm giác như: ${w.apparentTemperature}°C)</i>`,
    `• Dao động ngày: <b>${w.tempMin}°C – ${w.tempMax}°C</b>`,
    `• Độ ẩm: <b>${w.humidity}%</b> · Gió: <b>${w.windSpeed} km/h</b>`,
    `• Khả năng mưa hôm nay: <b>${w.rainProbability}%</b>${rainBadge}`,
    `• Chỉ số UV cực đại: <b>${w.uvIndexMax}</b>${uvBadge}`,
    "",
    `💡 <b>Lời khuyên hôm nay:</b>`,
    `<i>${escapeHtml(w.advice)}</i>`,
  ].join("\n");
}

/** Tạo Inline Keyboard cho thời tiết */
export function weatherKeyboard(currentLocKey = "binh_thanh"): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Cập nhật", `weather:refresh:${currentLocKey}`)
    .row()
    .text("📍 Bình Thạnh", "weather:loc:binh_thanh")
    .text("📍 Quận 1", "weather:loc:quan_1")
    .row()
    .text("📍 Hà Nội", "weather:loc:ha_noi")
    .text("📍 Đà Nẵng", "weather:loc:da_nang");
}

/** Tách địa điểm ra khỏi câu hỏi tự nhiên của người dùng */
export function extractWeatherLocation(text: string): string {
  let cleaned = text.trim();

  // Bỏ tiền tố lệnh /tt, /thoitiet, /weather
  cleaned = cleaned.replace(/^\/(?:tt|thoitiet|weather)\s*/i, "");

  // Bỏ các từ để hỏi hoặc từ đệm thời tiết
  cleaned = cleaned
    .replace(/(?:dự\s*báo\s*)?thời\s*tiết|thoi\s*tiet/gi, " ")
    .replace(/hôm\s*nay|hom\s*nay|hiện\s*tại|hien\s*tai|bây\s*giờ|bay\s*gio/gi, " ")
    .replace(/như\s*nào|nhu\s*nao|thế\s*nào|the\s*nao|ra\s*sao|như\s*thế\s*nào|nhu\s*the\s*nao/gi, " ")
    .replace(/có\s*mưa\s*không|co\s*mua\s*khong|mưa\s*không|mua\s*khong|có\s*nắng\s*không|co\s*nang\s*khong/gi, " ")
    .replace(/\b(?:ở|o|tại|tai|khu\s*vực|khu\s*vuc)\b/gi, " ")
    .replace(/[?!.,;:~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "bình thạnh";
}

/** Nhận diện người dùng đang hỏi thời tiết */
export function isWeatherQuery(text: string): boolean {
  const norm = text.trim().toLowerCase();

  // /tt xử lý qua bot.command
  if (norm.startsWith("/")) return false;

  // Bắt các mẫu hỏi thời tiết phổ biến
  if (/(?:thời\s*tiết|thoi\s*tiet)/i.test(norm)) {
    return true;
  }

  // Hỏi mưa nắng: "hôm nay có mưa không", "bình thạnh có mưa ko", "hôm nay trời nắng không"
  if (/(?:hôm\s*nay|trời).*(?:mưa|mắt|nắng|nhiệt\s*độ).*(?:không|ko|hông|sao|như\s*nào)/i.test(norm)) {
    return true;
  }

  return false;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
