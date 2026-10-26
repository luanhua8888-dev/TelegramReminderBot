// Tính năng theo dõi kết quả Manchester United F.C:
// Khi nào MU thắng thì "RA HANG" 🦁🔥, MU thua thì "VÔ HANG" 🛖😭, hòa thì "LẤP LÓ" 👀.

import { InlineKeyboard } from "grammy";
import { formatLocal, toLocal } from "./time.ts";

export type CaveStatus = "ra_hang" | "vo_hang" | "lap_lo";

export type MuMatch = {
  id: string;
  date: string;
  name: string;
  competition: string;
  isHome: boolean;
  muScore: number;
  opponentName: string;
  opponentScore: number;
  winner: boolean | null; // true = thắng, false = thua, null = hòa
  caveStatus: CaveStatus;
};

export type MuNextMatch = {
  id: string;
  date: string;
  name: string;
  opponent: string;
  isHome: boolean;
  competition: string;
  kickoffEpoch: number;
};

export type MuStatusResult = {
  lastMatch: MuMatch | null;
  nextMatch: MuNextMatch | null;
  currentCaveStatus: CaveStatus;
};

const MU_TEAM_ID = "360";
const SCHEDULE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/360/schedule";
const TEAM_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/360";

/** Kiểm tra xem tin nhắn có phải câu hỏi/truy vấn về MU hoặc Hang hay không */
export function isMuQuery(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const norm = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();

  // Nhận diện chuẩn: "mu", "man utd", "manchester united", "ra hang", "vo hang", "vao hang", "hang mu"...
  const patterns = [
    /^\s*mu\s*$/i,
    /\bmu\b/i,
    /man(?:chester)?\s*(?:utd|united)/i,
    /(?:ra|vo|vao)\s*hang/i,
    /hang\s*mu/i,
    /tinh\s*hinh\s*mu/i,
    /mu\s*(?:da|thang|thua|hoa)/i,
  ];

  // Tránh nhầm với từ bắt đầu bằng mu: mua, mục, mượn, mưa...
  // Vì \bmu\b đã có word boundary, "mua" sẽ không khớp \bmu\b.
  return patterns.some((p) => p.test(norm));
}

/** Phân tích JSON từ API ESPN */
export function parseMuData(scheduleJson: any, teamJson: any): MuStatusResult {
  const events: any[] = scheduleJson?.events ?? [];
  const completed = events.filter((e) => e.competitions?.[0]?.status?.type?.completed);
  const latestEvent = completed[0]; // ESPN trả về sự kiện xếp giảm dần theo thời gian

  let lastMatch: MuMatch | null = null;
  let currentCaveStatus: CaveStatus = "vo_hang";

  if (latestEvent) {
    const comp = latestEvent.competitions?.[0];
    const competitors: any[] = comp?.competitors ?? [];
    const muComp = competitors.find((c) => String(c.team?.id) === MU_TEAM_ID);
    const oppComp = competitors.find((c) => String(c.team?.id) !== MU_TEAM_ID);

    const muScore = Number(muComp?.score?.displayValue ?? 0);
    const oppScore = Number(oppComp?.score?.displayValue ?? 0);
    const isHome = muComp?.homeAway === "home";

    let winner: boolean | null = null;
    if (muScore > oppScore) {
      winner = true;
      currentCaveStatus = "ra_hang";
    } else if (muScore < oppScore) {
      winner = false;
      currentCaveStatus = "vo_hang";
    } else {
      winner = null;
      currentCaveStatus = "lap_lo";
    }

    lastMatch = {
      id: String(latestEvent.id),
      date: latestEvent.date,
      name: latestEvent.name,
      competition: latestEvent.seasonType?.name ?? latestEvent.league?.name ?? "Ngoại Hạng Anh",
      isHome,
      muScore,
      opponentName: oppComp?.team?.displayName ?? "Đối thủ",
      opponentScore: oppScore,
      winner,
      caveStatus: currentCaveStatus,
    };
  }

  let nextMatch: MuNextMatch | null = null;
  const nextEvent = teamJson?.team?.nextEvent?.[0];
  if (nextEvent) {
    const comp = nextEvent.competitions?.[0];
    const competitors: any[] = comp?.competitors ?? [];
    const muComp = competitors.find((c) => String(c.team?.id) === MU_TEAM_ID);
    const oppComp = competitors.find((c) => String(c.team?.id) !== MU_TEAM_ID);

    nextMatch = {
      id: String(nextEvent.id),
      date: nextEvent.date,
      name: nextEvent.name,
      opponent: oppComp?.team?.displayName ?? "Đối thủ",
      isHome: muComp?.homeAway === "home",
      competition: nextEvent.league?.name ?? "Ngoại Hạng Anh",
      kickoffEpoch: new Date(nextEvent.date).getTime(),
    };
  }

  return {
    lastMatch,
    nextMatch,
    currentCaveStatus,
  };
}

let cachedStatus: { data: MuStatusResult; timestamp: number } | null = null;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "application/json",
};

/** Lấy thông tin MU mới nhất từ ESPN (có cache 5 phút để tránh spam API) */
export async function fetchMuStatus(forceRefresh = false): Promise<MuStatusResult> {
  const now = Date.now();
  if (!forceRefresh && cachedStatus && now - cachedStatus.timestamp < 300_000) {
    return cachedStatus.data;
  }

  try {
    const [schedRes, teamRes] = await Promise.all([
      fetch(SCHEDULE_URL, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10_000) }),
      fetch(TEAM_URL, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10_000) }),
    ]);

    if (!schedRes.ok) throw new Error(`ESPN schedule status ${schedRes.status}`);
    const schedJson = await schedRes.json();
    const teamJson = teamRes.ok ? await teamRes.json() : null;

    const result = parseMuData(schedJson, teamJson);
    cachedStatus = { data: result, timestamp: now };
    return result;
  } catch (err) {
    console.warn("[mu] fetch error:", (err as Error).message);
    if (cachedStatus) return cachedStatus.data;
    throw err;
  }
}

const DOW = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** Định dạng ngày giờ chuẩn hiển thị (giờ Việt Nam UTC+7) */
function formatMatchTime(isoStr: string): string {
  try {
    const date = new Date(isoStr);
    const vnTime = toLocal(date.getTime(), 420); // UTC+7
    const day = String(vnTime.d).padStart(2, "0");
    const month = String(vnTime.mo).padStart(2, "0");
    const hour = String(vnTime.h).padStart(2, "0");
    const minute = String(vnTime.mi).padStart(2, "0");
    const dow = DOW[vnTime.dow];
    return `${hour}:${minute} ${dow}, ${day}/${month}`;
  } catch {
    return isoStr;
  }
}

/** Đếm ngược thời gian tới trận */
function formatCountdown(kickoffEpoch: number): string {
  const diffMs = kickoffEpoch - Date.now();
  if (diffMs <= 0) return "đang diễn ra hoặc đã kết thúc";
  const diffDays = Math.floor(diffMs / (24 * 3600_000));
  const diffHours = Math.floor((diffMs % (24 * 3600_000)) / 3600_000);
  if (diffDays > 0) {
    return `còn ${diffDays} ngày ${diffHours} giờ nữa`;
  }
  return `còn ${diffHours} giờ nữa`;
}

/** Soạn thông điệp Telegram vui nhộn và chi tiết về tình trạng Hang của MU */
export function formatMuMessage(status: MuStatusResult): string {
  const { lastMatch, nextMatch, currentCaveStatus } = status;

  let headerBanner = "";
  if (currentCaveStatus === "ra_hang") {
    headerBanner = `🦁🔥 <b>TOÀN DÂN RA HANG! GÁY LÊN ANH EM!</b> 🔥🦁\n<i>Cửa hang mở toang! Quỷ Đỏ ngẩng cao đầu đón ánh nắng mặt trời rực rỡ!</i>`;
  } else if (currentCaveStatus === "vo_hang") {
    headerBanner = `🛖🚪🔒 <b>VÔ HANG GẤP! ĐÓNG CỬA HANG!</b> 🔒🚪🛖\n<i>Bật quạt số 3, trùm chăn kỹ càng, nhường lại mặt đất cho đội bạn. Hẹn ngày phục thù!</i>`;
  } else {
    headerBanner = `👀🪨 <b>LẤP LÓ CỬA HANG</b> 🪨👀\n<i>Thò một chân ra ngoài ngó nghiêng rồi thụt vào, một điểm hú vía!</i>`;
  }

  const lines: string[] = [
    `⚽ <b>MANCHESTER UNITED F.C · TÌNH TRẠNG HANG</b>\n`,
    headerBanner,
    "\n──────────────────",
  ];

  if (lastMatch) {
    const scoreStr = lastMatch.isHome
      ? `Manchester United <b>${lastMatch.muScore} - ${lastMatch.opponentScore}</b> ${lastMatch.opponentName}`
      : `${lastMatch.opponentName} <b>${lastMatch.opponentScore} - ${lastMatch.muScore}</b> Manchester United`;

    const icon = lastMatch.winner === true
      ? "✅ THẮNG 🟢 (RA HANG)"
      : lastMatch.winner === false
      ? "❌ THUA 🔴 (VÔ HANG)"
      : "🤝 HÒA 🟡 (LẤP LÓ)";

    lines.push(`<b>Trận vừa kết thúc:</b>`);
    lines.push(`🏟 Tỉ số: ${scoreStr}`);
    lines.push(`📊 Kết quả: <b>${icon}</b>`);
    lines.push(`🏆 Giải đấu: <b>${lastMatch.competition}</b>`);
    lines.push(`🕒 Lúc: <i>${formatMatchTime(lastMatch.date)}</i>`);
  }

  if (nextMatch) {
    const location = nextMatch.isHome ? "Sân nhà Old Trafford" : `Sân khách (${nextMatch.opponent})`;
    const countdown = formatCountdown(nextMatch.kickoffEpoch);
    lines.push(`\n<b>Trận sắp tới:</b>`);
    lines.push(`⚔️ Cặp đấu: <b>MU vs ${nextMatch.opponent}</b> (${location})`);
    lines.push(`🏆 Giải đấu: <b>${nextMatch.competition}</b>`);
    lines.push(`⏰ Khởi tranh: <b>${formatMatchTime(nextMatch.date)}</b> (giờ VN)`);
    lines.push(`⏳ Đếm ngược: <i>${countdown}</i>`);
  }

  return lines.join("\n");
}

/** Bàn phím điều khiển Hang MU */
export function muKeyboard(nextKickoffEpoch?: number): InlineKeyboard {
  const kb = new InlineKeyboard().text("🔄 Cập nhật tình hình", "mu:refresh");
  if (nextKickoffEpoch && nextKickoffEpoch > Date.now()) {
    kb.row().text("⏰ Đặt lịch nhắc trận tới", `mu:remind:${nextKickoffEpoch}`);
  }
  return kb;
}

/** Thông báo khẩn khi có kết quả trận đấu mới nhất của MU */
export function formatMuAlert(status: MuStatusResult): string {
  const { lastMatch, currentCaveStatus } = status;
  let title = "";
  if (currentCaveStatus === "ra_hang") {
    title = "🎉🦁🔥 <b>KẾT QUẢ: MANCHESTER UNITED CHIẾN THẮNG!</b> 🔥🦁🎉\n\n<b>TOÀN THỂ ANH EM RA HANG GÁY LÊN!</b> Cửa hang đã mở toang!";
  } else if (currentCaveStatus === "vo_hang") {
    title = "😭🛖🔒 <b>KẾT QUẢ: MANCHESTER UNITED THẤT BẠI!</b> 🔒🛖😭\n\n<b>VÔ HANG GẤP! ĐÓNG CỬA HANG!</b> Giữ ấm bản thân, hẹn ngày phục thù!";
  } else {
    title = "⚖️👀🪨 <b>KẾT QUẢ: MANCHESTER UNITED HÒA TRẬN!</b> 🪨👀⚖️\n\n<b>LẤP LÓ CỬA HANG!</b> Một điểm hú vía, thò chân ra ngó rồi lại thụt vào!";
  }

  const scoreStr = lastMatch
    ? (lastMatch.isHome
        ? `Manchester United <b>${lastMatch.muScore} - ${lastMatch.opponentScore}</b> ${lastMatch.opponentName}`
        : `${lastMatch.opponentName} <b>${lastMatch.opponentScore} - ${lastMatch.muScore}</b> Manchester United`)
    : "";

  return `${title}\n\n🏟 Tỉ số: ${scoreStr}\n🏆 ${lastMatch?.competition ?? "Ngoại Hạng Anh"}`;
}
