import { InlineKeyboard } from "grammy";

export interface AugmentInfo {
  name: string;
  winRate: string;
}

export interface BuildInfo {
  name: string;
  winRate?: string;
  pickRate?: string;
  items: string[];
}

export interface PlaystyleCombo {
  title: string;
  desc: string;
}

export interface AramChampionData {
  slug: string;
  championName: string;
  tier?: string;
  prismaticAugments: AugmentInfo[];
  goldAugments: AugmentInfo[];
  silverAugments: AugmentInfo[];
  builds: BuildInfo[];
  combos: PlaystyleCombo[];
  boots?: string[];
  spells?: string[];
  url: string;
}

const COMMON_CHAMPION_MAP: Record<string, string> = {
  yasuo: "yasuo",
  yone: "yone",
  leesin: "leesin",
  "lee sin": "leesin",
  "thay tu": "leesin",
  "thầy tu": "leesin",
  masteryi: "masteryi",
  "master yi": "masteryi",
  yi: "masteryi",
  samira: "samira",
  zed: "zed",
  aatrox: "aatrox",
  katarina: "katarina",
  kata: "katarina",
  vayne: "vayne",
  jinx: "jinx",
  darius: "darius",
  akali: "akali",
  lux: "lux",
  kaisa: "kaisa",
  "kai'sa": "kaisa",
  "kai sa": "kaisa",
  khazix: "khazix",
  "kha'zix": "khazix",
  "kha zix": "khazix",
  chogath: "chogath",
  "cho'gath": "chogath",
  velkoz: "velkoz",
  "vel'koz": "velkoz",
  reksai: "reksai",
  "rek'sai": "reksai",
  monkeyking: "monkeyking",
  wukong: "monkeyking",
  "ngộ không": "monkeyking",
  "ngo khong": "monkeyking",
  blitzcrank: "blitzcrank",
  blitz: "blitzcrank",
  missfortune: "missfortune",
  "miss fortune": "missfortune",
  mf: "missfortune",
  twistedfate: "twistedfate",
  "twisted fate": "twistedfate",
  tf: "twistedfate",
  jarvaniv: "jarvaniv",
  "jarvan iv": "jarvaniv",
  jarvan: "jarvaniv",
  j4: "jarvaniv",
  tahmkench: "tahmkench",
  "tahm kench": "tahmkench",
  tahm: "tahmkench",
  aurelionsol: "aurelionsol",
  "aurelion sol": "aurelionsol",
  asol: "aurelionsol",
  xinzhao: "xinzhao",
  "xin zhao": "xinzhao",
  drmundo: "drmundo",
  "dr. mundo": "drmundo",
  "dr mundo": "drmundo",
  mundo: "drmundo",
};

/** Chuẩn hóa tên tướng sang slug URL của PlayARAM.gg */
export function normalizeChampionSlug(input: string): string {
  let cleaned = input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’\-_]/g, "");

  if (COMMON_CHAMPION_MAP[cleaned]) {
    return COMMON_CHAMPION_MAP[cleaned];
  }

  // Bỏ khoảng trắng nếu có
  cleaned = cleaned.replace(/\s+/g, "");
  return cleaned || "yasuo";
}

const SUMMONER_SPELLS = new Set([
  "Tốc Biến",
  "Đánh Dấu",
  "Thanh Tẩy",
  "Kiệt Sức",
  "Tốc Hành",
  "Hồi Máu",
  "Lá Chắn",
  "Thiêu Đốt",
  "Trừng Phạt",
  "Minh Mẫn",
]);

/** Bóc tách HTML từ PlayARAM.gg thành cấu trúc dữ liệu ARAM Mayhem */
export function parsePlayAramHtml(html: string, slug: string): AramChampionData {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
  let championName = slug.charAt(0).toUpperCase() + slug.slice(1);

  if (titleMatch) {
    const rawH1 = titleMatch[1].replace(/<[^>]*>/g, "").trim();
    // Ví dụ: "Build Yasuo ARAM Hỗn Loạn: Lõi và trang bị mạnh nhất"
    const nameMatch = rawH1.match(/(?:Build\s+)?([A-Za-z0-9\s'\.\&]+?)(?:\s+ARAM|\s+–|\s*:)/i);
    if (nameMatch) {
      championName = nameMatch[1].trim();
    }
  }

  // 1. Tách danh sách Lõi theo độ hiếm
  const extractAugments = (headingName: string): AugmentInfo[] => {
    const regex = new RegExp(`(?:<h[23][^>]*>\\s*${headingName}\\s*<\\/h[23]>)([\\s\\S]*?)(?=<h[23]|$)`, "i");
    const m = html.match(regex);
    if (!m) return [];

    const text = m[1].replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const matches = [...text.matchAll(/([A-ZÀ-Ỹa-zà-ỹ0-9\s\-\:\'\+]+?)\s+(\d{1,2}(?:\.\d{1,2})?%)\s+(\d{1,2}(?:\.\d{1,2})?%)?/g)];
    const results: AugmentInfo[] = [];

    for (const match of matches) {
      const name = match[1].trim().replace(/^(?:Tỉ lệ thắng|Tỉ lệ chọn)\s*/i, "");
      const winRate = match[2];
      if (name && name.length > 2 && !name.toLowerCase().includes("tỉ lệ") && results.length < 4) {
        results.push({ name, winRate });
      }
    }
    return results;
  };

  const prismaticAugments = extractAugments("Lõi Kim Cương");
  const goldAugments = extractAugments("Lõi Vàng");
  const silverAugments = extractAugments("Lõi Bạc");

  // 2. Tách bộ trang bị (Build panel 0 & 1)
  const builds: BuildInfo[] = [];
  const panelBoots: string[] = [];
  const panelSpells: string[] = [];
  const buildPanels = [...html.matchAll(/id="build-panel-\d+"[^>]*>([\s\S]*?)(?=<div[^>]*id="build-panel|\s*<\/section>|\s*<section|$)/g)];

  for (const panelMatch of buildPanels.slice(0, 2)) {
    const pContent = panelMatch[1];
    const bNameMatch = pContent.match(/<h3 class="bt-panel__name">([\s\S]*?)<\/h3>/i);
    const wrMatch = pContent.match(/class="sp-stat bt-kpi bt-kpi--wr">([\s\S]*?)<\/span>/i);
    const pickMatch = pContent.match(/class="sp-stat bt-kpi">([\s\S]*?)<\/span>/i);
    const rawSlots = [...pContent.matchAll(/<span class="bt-slot__name">([\s\S]*?)<\/span>/g)].map((im) => im[1].trim());

    const items: string[] = [];
    for (const s of rawSlots) {
      if (s.startsWith("Giày ")) {
        if (!panelBoots.includes(s)) panelBoots.push(s);
      } else if (SUMMONER_SPELLS.has(s)) {
        if (!panelSpells.includes(s)) panelSpells.push(s);
      } else {
        items.push(s);
      }
    }

    if (bNameMatch && items.length > 0) {
      builds.push({
        name: bNameMatch[1].replace(/<[^>]*>/g, "").trim(),
        winRate: wrMatch ? wrMatch[1].trim() : undefined,
        pickRate: pickMatch ? pickMatch[1].trim() : undefined,
        items,
      });
    }
  }

  // 3. Tách lối chơi / combo đặc trưng (Playstyle panel 0)
  const combos: PlaystyleCombo[] = [];
  const playstylePanels = [...html.matchAll(/id="playstyle-panel-\d+"[^>]*>([\s\S]*?)(?=<div[^>]*id="playstyle-panel|\s*<\/section>|\s*<section|$)/g)];

  for (const pMatch of playstylePanels.slice(0, 2)) {
    const pContent = pMatch[1];
    const cTitleMatch = pContent.match(/<h3 class="bt-panel__name">([\s\S]*?)<\/h3>/i);
    const cDescMatch = pContent.match(/<div class="bt-panel__sub"><p>([\s\S]*?)<\/p>/i);

    if (cTitleMatch) {
      const title = cTitleMatch[1].replace(/<[^>]*>/g, "").trim();
      const desc = cDescMatch ? cDescMatch[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
      combos.push({ title, desc });
    }
  }

  // 4. Giày & Phép bổ trợ
  const boots = panelBoots;
  const spells = panelSpells;

  return {
    slug,
    championName,
    prismaticAugments,
    goldAugments,
    silverAugments,
    builds,
    combos,
    boots,
    spells,
    url: `https://playaram.gg/tuong/${slug}`,
  };
}

/** Tải dữ liệu tướng từ PlayARAM.gg */
export async function fetchAramChampion(query: string): Promise<AramChampionData> {
  const slug = normalizeChampionSlug(query);
  const url = `https://playaram.gg/tuong/${slug}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "vi,en;q=0.9",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Không tìm thấy dữ liệu cho tướng "${query}" trên PlayARAM.gg (HTTP ${res.status})`);
  }

  const html = await res.text();
  return parsePlayAramHtml(html, slug);
}

/** Định dạng dữ liệu ARAM thành tin nhắn Telegram HTML sinh động */
export function formatAramMessage(d: AramChampionData): string {
  const lines: string[] = [
    `⚔️ <b>ARAM HỖN LOẠN – ${escapeHtml(d.championName.toUpperCase())}</b>`,
    `<i>Dữ liệu meta chuẩn theo PlayARAM.gg</i>`,
    "",
  ];

  // Lõi nâng cấp
  lines.push("🌟 <b>LÕI NÂNG CẤP TỐI ƯU NHẤT:</b>");
  if (d.prismaticAugments.length > 0) {
    const list = d.prismaticAugments.map((a) => `• <b>${escapeHtml(a.name)}</b> <i>(${a.winRate} win)</i>`).join("\n");
    lines.push(`💎 <b>Lõi Kim Cương:</b>\n${list}`);
  }
  if (d.goldAugments.length > 0) {
    const list = d.goldAugments.map((a) => `• <b>${escapeHtml(a.name)}</b> <i>(${a.winRate} win)</i>`).join("\n");
    lines.push(`🥇 <b>Lõi Vàng:</b>\n${list}`);
  }
  if (d.silverAugments.length > 0) {
    const list = d.silverAugments.map((a) => `• <b>${escapeHtml(a.name)}</b> <i>(${a.winRate} win)</i>`).join("\n");
    lines.push(`🥈 <b>Lõi Bạc:</b>\n${list}`);
  }

  // Lối chơi & combo bá đạo
  if (d.combos.length > 0) {
    lines.push("");
    lines.push("🔥 <b>LỐI CHƠI ĐỘC BẢN & COMBO LÕI:</b>");
    for (const c of d.combos.slice(0, 1)) {
      lines.push(`<blockquote><b>${escapeHtml(c.title)}</b>\n${escapeHtml(c.desc)}</blockquote>`);
    }
  }

  // Bộ trang bị
  if (d.builds.length > 0) {
    lines.push("");
    lines.push("🛡 <b>BUILD TRANG BỊ ĐỀ XUẤT:</b>");
    const b = d.builds[0];
    const wrBadge = b.winRate ? ` <i>(Thắng: ${b.winRate})</i>` : "";
    lines.push(`<b>${escapeHtml(b.name)}</b>${wrBadge}`);
    if (b.items.length >= 2) {
      lines.push(`• Cốt lõi: <b>${escapeHtml(b.items[0])}</b> + <b>${escapeHtml(b.items[1])}</b>`);
      const rest = b.items.slice(2);
      if (rest.length > 0) {
        lines.push(`• Các món tiếp theo: ${rest.map((i) => `<b>${escapeHtml(i)}</b>`).join(", ")}`);
      }
    } else if (b.items.length > 0) {
      lines.push(`• Trang bị: ${b.items.map((i) => `<b>${escapeHtml(i)}</b>`).join(", ")}`);
    }
  }

  // Giày & Phép bổ trợ
  if (d.boots && d.boots.length > 0) {
    lines.push(`• Giày ưu tiên: ${d.boots.map((b) => `<b>${escapeHtml(b)}</b>`).join(" / ")}`);
  }
  if (d.spells && d.spells.length > 0) {
    lines.push(`• Phép bổ trợ: ${d.spells.map((s) => `<b>${escapeHtml(s)}</b>`).join(" | ")}`);
  }

  lines.push("");
  lines.push(`🔗 <a href="${d.url}"><b>Bấm đây để xem chi tiết biểu đồ trên PlayARAM.gg</b></a>`);

  return lines.join("\n");
}

/** Tạo bàn phím Inline cho lệnh ARAM */
export function aramKeyboard(currentSlug = "yasuo"): InlineKeyboard {
  return new InlineKeyboard()
    .url("🌐 Xem trên PlayARAM.gg", `https://playaram.gg/tuong/${currentSlug}`)
    .row()
    .text("🌪 Yasuo", "aram:yasuo")
    .text("⚔️ Yone", "aram:yone")
    .text("🥊 Lee Sin", "aram:leesin")
    .row()
    .text("🗡️ Master Yi", "aram:masteryi")
    .text("🔫 Samira", "aram:samira")
    .text("🔄 Làm mới", `aram:${currentSlug}`);
}

/** Nhận diện câu hỏi liên quan đến ARAM Mayhem / Lõi nâng cấp */
export function isAramQuery(text: string): boolean {
  const norm = text.trim().toLowerCase();
  if (norm.startsWith("/")) return false;

  // Bắt các mẫu hỏi về aram
  if (/\b(?:aram|playaram)\b/i.test(norm)) return true;
  if (/lõi\s+(?:cho|nâng\s*cấp\s*cho)?\s+[a-zà-ỹ0-9]+/i.test(norm)) return true;
  if (/build\s+[a-zà-ỹ0-9]+\s+aram/i.test(norm)) return true;

  return false;
}

/** Trích xuất tên tướng từ câu hỏi tự nhiên */
export function extractChampionFromQuery(text: string): string {
  // 1. Nếu có "/aram <tướng>" ở bất kỳ vị trí nào
  const slashMatch = text.match(/\/aram\s+([a-zA-Z0-9\s'’\-]+)/i);
  if (slashMatch) {
    const raw = slashMatch[1].trim().split(/\s+/)[0];
    return raw.replace(/[?!.,;:~\\\/]/g, "");
  }

  // 2. Kiểm tra xem có tên tướng nào trong COMMON_CHAMPION_MAP xuất hiện không
  const lower = text.toLowerCase();
  for (const key of Object.keys(COMMON_CHAMPION_MAP)) {
    const regex = new RegExp(`\\b${key}\\b`, "i");
    if (regex.test(lower)) {
      return COMMON_CHAMPION_MAP[key];
    }
  }

  // 3. Làm sạch từ khóa phụ
  let cleaned = text.trim();
  cleaned = cleaned
    .replace(/https?:\/\/[^\s]+/gi, " ")
    .replace(/aram\s*hỗn\s*loạn|aram\s*hon\s*loan|aram/gi, " ")
    .replace(/c[óo]\s+th[ểe]\s+g[ợo]i\s+[ýy]|g[ợo]i\s+[ýy]|xem/gi, " ")
    .replace(/m[ấa]y\s+n[âa]ng\s+c[ấa]p|n[âa]ng\s+c[ấa]p|c[áa]c\s+l[õo]i|l[õo]i\s+cho|l[õo]i/gi, " ")
    .replace(/ph[ùu]\s+h[ợo]p\s+nh[ấa]t|ph[ùu]\s+h[ợo]p|m[ạa]nh\s+nh[ấa]t/gi, " ")
    .replace(/t[ưu][ớo]ng|cho|\bđược\s+không\b|\bduoc\s+khong\b/gi, " ")
    .replace(/c[ũu]ng\s+nh[ưu]|item\s+đ[ồo]|item|trang\s+b[ịi]|đ[ồo]|build/gi, " ")
    .replace(/[?!.,;:~\\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "yasuo";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
