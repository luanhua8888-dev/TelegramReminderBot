import { InlineKeyboard } from "grammy";
import sharp from "sharp";

export interface AugmentInfo {
  name: string;
  winRate: string;
  imgUrl?: string;
  visualDesc?: string;
}

export interface BuildItem {
  name: string;
  imgUrl?: string;
  enName?: string;
  nick?: string;
  visual?: string;
}

export interface BuildInfo {
  name: string;
  winRate?: string;
  pickRate?: string;
  items: BuildItem[];
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
  boots?: BuildItem[];
  spells?: string[];
  url: string;
}

export const ITEM_VISUAL_MAP: Record<string, { en: string; nick: string; visual: string }> = {
  "nghi thuc suy vong": { en: "Decaying Rite", nick: "Món mới ARAM", visual: "Trượng tím Mayhem" },
  "guom suy vong": { en: "BotRK", nick: "Gươm Vô Danh", visual: "Kiếm xanh lá cong" },
  "vo cuc kiem": { en: "Infinity Edge (IE)", nick: "Vô Cực", visual: "Đại kiếm vàng sáng" },
  "mui ten yun tal": { en: "Yun Tal Wildarrows", nick: "Yun Tal", visual: "Cung tên lông chim" },
  "vu dieu tu than": { en: "Death's Dance (DD)", nick: "Vũ Điệu", visual: "Rìu hai lưỡi đỏ" },
  "ma vu song kiem": { en: "Phantom Dancer (PD)", nick: "Ma Vũ", visual: "Song kiếm xanh lá" },
  "no tu thu": { en: "Immortal Shieldbow", nick: "Nỏ Tử Thủ", visual: "Cung đỏ tím tạo giáp" },
  "huyet kiem": { en: "Bloodthirster (BT)", nick: "Huyết Kiếm", visual: "Kiếm đỏ hút máu" },
  "dao chop navori": { en: "Navori Flickerblade", nick: "Navori", visual: "Đao tím hồi chiêu" },
  "chuy hap huyet": { en: "Goredrinker", nick: "Chùy Hấp Huyết", visual: "Chùy sắt đỏ gai" },
  "giap tam linh": { en: "Spirit Visage", nick: "Giáp Tâm Linh", visual: "Giáp ngực xanh lục" },
  "jak'sho": { en: "Jak'Sho", nick: "Jak'Sho", visual: "Giáp tím sinh học" },
  "jak'sho vo boc thich nghi": { en: "Jak'Sho", nick: "Jak'Sho", visual: "Giáp tím sinh học" },
  "giay cuong no": { en: "Berserker's Greaves", nick: "Giày Tốc Đánh", visual: "Giày sắt viền vàng" },
  "giay pham an": { en: "Gluttonous Greaves", nick: "Giày Hút Máu", visual: "Giày da đỏ thẫm" },
  "giay thuy ngan": { en: "Mercury's Treads", nick: "Giày Kháng Phép", visual: "Giày xanh có cánh" },
  "giay thep gai": { en: "Plated Steelcaps", nick: "Giày Ninja", visual: "Giày sắt xám" },
  "tam hop kiem": { en: "Trinity Force", nick: "Tam Hợp Kiếm", visual: "Kiếm vàng ba mũi" },
  "sung dai bac lien thanh": { en: "Rapid Firecannon", nick: "Đại Bác Liên Thanh", visual: "Cặp súng vàng đỏ" },
  "loi phong": { en: "Stormrazor", nick: "Phong Kiếm", visual: "Kiếm xanh có sét" },
  "loi nhac tu vong": { en: "Mortal Reminder", nick: "Lời Nhắc", visual: "Nỏ vàng bắn vết thương sâu" },
  "no dominik": { en: "Lord Dominik", nick: "LDR", visual: "Nỏ xanh dương diệt tank" },
  "riu den": { en: "Black Cleaver", nick: "Rìu Đen", visual: "Rìu hai lưỡi đá đen" },
  "riu mang xa gia tang": { en: "Ravenous Hydra", nick: "Rìu Mãng Xà", visual: "Rìu đỏ liềm lan sát thương" },
  "nguyet dao": { en: "Eclipse", nick: "Nguyệt Đao", visual: "Lưỡi liềm đen tím" },
  "ngon giao shojin": { en: "Spear of Shojin", nick: "Shojin", visual: "Giáo rồng xanh ngọc" },
  "gang tay bang gia": { en: "Iceborn Gauntlet", nick: "Găng Băng", visual: "Găng tay băng xanh" },
  "dong ho cat zhonya": { en: "Zhonya's Hourglass", nick: "Đồng Hồ Cát", visual: "Đồng hồ cát vàng" },
  "mu phu thuy rabadon": { en: "Rabadon's Deathcap", nick: "Mũ Phù Thủy", visual: "Mũ chóp nhọn đỏ tím" },
  "duoc lua den": { en: "Blackfire Torch", nick: "Đuốc Lửa Đen", visual: "Đuốc đen lửa tím" },
  "mat na doa day liandry": { en: "Liandry's Torment", nick: "Mặt Nạ Liandry", visual: "Mặt nạ khóc chảy nước mắt" },
  "hoa khuan": { en: "Malignance", nick: "Hỏa Khuẩn", visual: "Viên ngọc tròn tím có gai" },
  "ngon lua hac hoa": { en: "Shadowflame", nick: "Ngọn Lửa Hắc Hóa", visual: "Mũi tên lửa xám tím" },
  "giay phap su": { en: "Sorcerer's Shoes", nick: "Giày Pháp Sư", visual: "Giày vải màu tím lam" },
  "truong hu vo": { en: "Void Staff", nick: "Trượng Hư Vô", visual: "Gậy tím pha lê" },
  "kinh hoa lupen": { en: "Luden's Companion", nick: "Vọng Âm Luden", visual: "Gậy ma thuật phát nổ" },
  "trai tim khong than": { en: "Heartsteel", nick: "Trái Tim Khổng Thần", visual: "Trái tim thép xám đỏ" },
  "bang giap vinh cuu": { en: "Fimbulwinter", nick: "Băng Giáp", visual: "Giáp ngực băng xanh" },
  "giap gai": { en: "Thornmail", nick: "Giáp Gai", visual: "Áo giáp gai nhọn" },
  "ao choang diet vong": { en: "Sunfire Aegis", nick: "Áo Choàng Lửa", visual: "Áo choàng đỏ bốc lửa" },
  "giap mau warmog": { en: "Warmog's Armor", nick: "Giáp Máu Warmog", visual: "Giáp xanh ngọc dày" },
};

export const AUGMENT_VISUAL_MAP: Record<string, string> = {
  "cu dam than bi": "👊 Nắm đấm xanh ngọc phát sáng",
  "khong nhan can dam": "🛡️ Khiên xanh lá chiến binh",
  "bac hoc dien": "🧪 Bình thuốc độc xanh lá",
  "not tram bung no": "💥 Biểu tượng nốt nhạc nổ tung",
  "va cham thiet giap": "🛡️ Giáp sắt nặng có tia sét",
  "chuyen hoa smpt-smck": "⚡ Mũi tên đảo ngược xanh-đỏ",
  "chien hoac chuon": "🏃 Đôi cánh / người chạy nhanh",
  "hoc thuat lam he": "🎭 Mặt nạ hề phân thân",
  "diet khong lo": "🗡️ Kiếm đâm bàn tay khổng lồ",
  "de quy vo han": "🔄 Biểu tượng vô cực xoay vòng",
  "y chi than su": "🪽 Đôi cánh thiên thần ánh sáng",
  "xoi mon": "💧 Giọt nước ăn mòn kháng phép",
};

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
  maokai: "maokai",
  "cây": "maokai",
  "cay": "maokai",
};

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

  cleaned = cleaned.replace(/\s+/g, "");
  return cleaned || "yasuo";
}

function resolveItemMeta(rawName: string, rawImg?: string): BuildItem {
  const norm = rawName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .trim();

  const meta = ITEM_VISUAL_MAP[norm];

  let cleanUrl = rawImg ? rawImg.replace(/\/cdn-cgi\/image\/[^/]+\//, "/") : undefined;
  if (cleanUrl && !cleanUrl.startsWith("http")) {
    cleanUrl = `https://playaram.gg${cleanUrl}`;
  }

  return {
    name: rawName,
    imgUrl: cleanUrl,
    enName: meta?.en,
    nick: meta?.nick,
    visual: meta?.visual,
  };
}

/** Bóc tách HTML từ PlayARAM.gg thành cấu trúc dữ liệu ARAM Mayhem */
export function parsePlayAramHtml(html: string, slug: string): AramChampionData {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
  let championName = slug.charAt(0).toUpperCase() + slug.slice(1);

  if (titleMatch) {
    const rawH1 = titleMatch[1].replace(/<[^>]*>/g, "").trim();
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
        const normAug = name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "d")
          .trim();
        const visualDesc = AUGMENT_VISUAL_MAP[normAug];
        results.push({ name, winRate, visualDesc });
      }
    }
    return results;
  };

  const prismaticAugments = extractAugments("Lõi Kim Cương");
  const goldAugments = extractAugments("Lõi Vàng");
  const silverAugments = extractAugments("Lõi Bạc");

  // 2. Tách bộ trang bị (Tất cả các panels build)
  const builds: BuildInfo[] = [];
  const panelBoots: BuildItem[] = [];
  const panelSpells: string[] = [];
  const buildPanels = [...html.matchAll(/id="build-panel-\d+"[^>]*>([\s\S]*?)(?=<div[^>]*id="build-panel|\s*<\/section>|\s*<section|$)/g)];

  for (const panelMatch of buildPanels.slice(0, 3)) {
    const pContent = panelMatch[1];
    const bNameMatch = pContent.match(/<h3 class="bt-panel__name">([\s\S]*?)<\/h3>/i);
    const wrMatch = pContent.match(/class="sp-stat bt-kpi bt-kpi--wr">([\s\S]*?)<\/span>/i);
    const pickMatch = pContent.match(/class="sp-stat bt-kpi">([\s\S]*?)<\/span>/i);

    // Bóc tách toàn bộ 6 items (bao gồm cả giày của build đó, chỉ loại bỏ phép bổ trợ)
    const slotMatches = [...pContent.matchAll(/<li[^>]*>(?:[\s\S]*?<img[^>]*src="([^"]*)")?[\s\S]*?<span class="bt-slot__name">([\s\S]*?)<\/span>/g)];

    const items: BuildItem[] = [];
    for (const sm of slotMatches) {
      const rawImg = sm[1];
      const sName = sm[2].trim();

      if (SUMMONER_SPELLS.has(sName)) {
        if (!panelSpells.includes(sName)) panelSpells.push(sName);
      } else {
        const metaItem = resolveItemMeta(sName, rawImg);
        items.push(metaItem);
        if (sName.startsWith("Giày ") && !panelBoots.some((b) => b.name === sName)) {
          panelBoots.push(metaItem);
        }
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

  return {
    slug,
    championName,
    prismaticAugments,
    goldAugments,
    silverAugments,
    builds,
    combos,
    boots: panelBoots,
    spells: panelSpells,
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

// In-memory cache cho ảnh ghép trang bị
const BANNER_CACHE = new Map<string, Buffer>();

/** Ghép các icon trang bị thành 1 ảnh ngang (Build Banner) */
export async function generateBuildBanner(itemUrls: string[]): Promise<Buffer | null> {
  const validUrls = itemUrls.filter((u) => u && u.startsWith("http"));
  if (validUrls.length === 0) return null;

  const cacheKey = validUrls.join("|");
  if (BANNER_CACHE.has(cacheKey)) {
    return BANNER_CACHE.get(cacheKey)!;
  }

  try {
    const iconSize = 72;
    const gap = 12;
    const paddingX = 16;
    const paddingY = 16;
    const totalWidth = paddingX * 2 + validUrls.length * iconSize + (validUrls.length - 1) * gap;
    const totalHeight = paddingY * 2 + iconSize;

    const composites: Array<{ input: Buffer; left: number; top: number }> = [];

    // Tải song song tất cả các icon
    const buffers = await Promise.all(
      validUrls.map(async (url) => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (!res.ok) return null;
          return Buffer.from(await res.arrayBuffer());
        } catch {
          return null;
        }
      }),
    );

    for (let i = 0; i < validUrls.length; i++) {
      const rawBuf = buffers[i];
      if (!rawBuf) continue;
      const resized = await sharp(rawBuf).resize(iconSize, iconSize).toBuffer();
      const left = paddingX + i * (iconSize + gap);
      const top = paddingY;
      composites.push({ input: resized, left, top });
    }

    if (composites.length === 0) return null;

    const base = sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 15, g: 23, b: 36, alpha: 1 },
      },
    });

    const finalBuffer = await base.composite(composites).png().toBuffer();
    if (BANNER_CACHE.size > 50) BANNER_CACHE.clear();
    BANNER_CACHE.set(cacheKey, finalBuffer);
    return finalBuffer;
  } catch (err) {
    console.error("[aram-banner]", err);
    return null;
  }
}

/** Định dạng nội dung tối giản hiển thị kèm ẢNH (không liệt kê tên dài dòng theo yêu cầu người dùng) */
export function formatAramCaption(d: AramChampionData, activeBuildIdx = 0): string {
  const b = d.builds[activeBuildIdx] || d.builds[0];
  const lines: string[] = [
    `⚔️ <b>ARAM HỖN LOẠN – ${escapeHtml(d.championName.toUpperCase())}</b>`,
    `📌 <b>${escapeHtml(b ? b.name : "Tiêu Chuẩn")}</b>${b?.winRate ? ` <i>(Thắng: ${b.winRate})</i>` : ""}`,
    "",
  ];

  // Lõi tối ưu ngắn gọn
  lines.push("🌟 <b>Lõi khuyên dùng:</b>");
  if (d.prismaticAugments[0]) {
    lines.push(`💎 Lõi Kim Cương: <b>${escapeHtml(d.prismaticAugments[0].name)}</b> <i>(${d.prismaticAugments[0].winRate})</i>`);
  }
  if (d.goldAugments[0]) {
    lines.push(`🥇 Lõi Vàng: <b>${escapeHtml(d.goldAugments[0].name)}</b> <i>(${d.goldAugments[0].winRate})</i>`);
  }
  if (d.silverAugments[0]) {
    lines.push(`🥈 Lõi Bạc: <b>${escapeHtml(d.silverAugments[0].name)}</b> <i>(${d.silverAugments[0].winRate})</i>`);
  }

  if (d.spells && d.spells.length > 0) {
    lines.push(`⚡ <b>Phép:</b> ${d.spells.map((s) => `<b>${escapeHtml(s)}</b>`).join(" | ")}`);
  }

  if (d.combos.length > 0) {
    lines.push("");
    const combo = d.combos[0];
    const shortDesc = combo.desc.length > 150 ? `${combo.desc.slice(0, 147)}...` : combo.desc;
    lines.push(`<blockquote><b>${escapeHtml(combo.title)}</b>\n<i>${escapeHtml(shortDesc)}</i></blockquote>`);
  }

  lines.push("");
  lines.push("💡 <i>Nhìn dải ảnh trên để lên đúng 6 món; bấm các nút dưới để đổi hướng build khác</i>");
  lines.push("🌐 <i>Nguồn: PlayARAM.gg</i>");

  return lines.join("\n");
}

/** Định dạng dữ liệu ARAM đầy đủ dạng văn bản */
export function formatAramMessage(d: AramChampionData): string {
  return formatAramCaption(d, 0);
}

/** Tạo bàn phím Inline cho lệnh ARAM, có các nút chuyển giữa các hướng build */
export function aramKeyboard(
  currentSlug = "yasuo",
  builds: BuildInfo[] = [],
  activeBuildIdx = 0,
): InlineKeyboard {
  const kb = new InlineKeyboard();

  // Nút chuyển hướng Build (nếu tướng có từ 2 hướng build trở lên)
  if (builds.length > 1) {
    builds.slice(0, 3).forEach((b, idx) => {
      const shortName = b.name.split("·")[0]?.trim() || b.name.slice(0, 12);
      let emoji = "⚔️";
      const lower = b.name.toLowerCase();
      if (lower.includes("đỡ đòn") || lower.includes("tank") || lower.includes("băng giáp")) emoji = "🛡️";
      else if (lower.includes("phép") || lower.includes("đuốc") || lower.includes("đốt")) emoji = "🔥";
      else if (lower.includes("chí mạng")) emoji = "🎯";
      else if (lower.includes("sát lực")) emoji = "🗡️";

      const label = idx === activeBuildIdx ? `• ${emoji} ${shortName} •` : `${emoji} ${shortName}`;
      kb.text(label, `aram:build:${currentSlug}:${idx}`);
    });
    kb.row();
  }

  kb.text("🌪 Yasuo", "aram:yasuo")
    .text("⚔️ Yone", "aram:yone")
    .text("🥊 Lee Sin", "aram:leesin")
    .row()
    .text("🌲 Maokai", "aram:maokai")
    .text("🗡️ Master Yi", "aram:masteryi")
    .text("🔫 Samira", "aram:samira")
    .row()
    .url("🌐 Mở chi tiết trên PlayARAM.gg", `https://playaram.gg/tuong/${currentSlug}`);

  return kb;
}

/** Phân tích câu truy vấn để tách riêng tên tướng và hướng build mong muốn (AP, Tank, AD...) */
export function parseAramQuery(input: string): { champion: string; preference?: string } {
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^\/aram\s*/i, "").trim();

  let preference: string | undefined = undefined;
  const lower = cleaned.toLowerCase();

  if (/\b(?:ap|phep|phép)\b/i.test(lower)) {
    preference = "ap";
  } else if (/\b(?:tank|do\s*don|đỡ\s*đòn|giap|giáp)\b/i.test(lower)) {
    preference = "tank";
  } else if (/\b(?:ad|sat\s*thuong|dame|stvl)\b/i.test(lower)) {
    preference = "ad";
  } else if (/\b(?:crit|chi\s*mang|chí\s*mạng)\b/i.test(lower)) {
    preference = "crit";
  } else if (/\b(?:sat\s*luc|sát\s*lực|lethality)\b/i.test(lower)) {
    preference = "lethality";
  }

  // Tách tên tướng (bỏ các từ khóa preference ra khỏi input)
  const champRaw = cleaned
    .replace(/\b(?:ap|phep|phép|tank|do\s*don|đỡ\s*đòn|ad|crit|chi\s*mang|chí\s*mạng|sat\s*luc|sát\s*lực|lethality)\b/gi, " ")
    .replace(/https?:\/\/[^\s]+/gi, " ")
    .replace(/aram\s*hỗn\s*loạn|aram\s*hon\s*loan|aram/gi, " ")
    .replace(/hướng|huong|danh|đánh|len\s*do|lên\s*đồ|build/gi, " ")
    .replace(/[?!.,;:~\\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const champion = extractChampionFromQuery(champRaw);

  return { champion, preference };
}

/** Tìm vị trí hướng build phù hợp với sở thích của người dùng */
export function findBuildIndex(builds: BuildInfo[], preference?: string): number {
  if (!preference || builds.length === 0) return 0;

  const pref = preference.toLowerCase();
  const idx = builds.findIndex((b) => {
    const name = b.name.toLowerCase();
    if (pref === "ap") return name.includes("phép") || name.includes("đuốc") || name.includes("đốt") || name.includes("ap");
    if (pref === "tank") return name.includes("đỡ đòn") || name.includes("giáp") || name.includes("áo choàng") || name.includes("tank");
    if (pref === "crit") return name.includes("chí mạng") || name.includes("vô cực") || name.includes("crit");
    if (pref === "lethality") return name.includes("sát lực") || name.includes("kiếm ma") || name.includes("nguyệt đao");
    if (pref === "ad") return name.includes("sát thương") || name.includes("tốc đánh") || name.includes("đòn đánh") || name.includes("đấu sĩ");
    return false;
  });

  return idx !== -1 ? idx : 0;
}

/** Nhận diện câu hỏi liên quan đến ARAM Mayhem / Lõi nâng cấp */
export function isAramQuery(text: string): boolean {
  const norm = text.trim().toLowerCase();
  if (norm.startsWith("/")) return false;

  if (/\b(?:aram|playaram)\b/i.test(norm)) return true;
  if (/lõi\s+(?:cho|nâng\s*cấp\s*cho)?\s+[a-zà-ỹ0-9]+/i.test(norm)) return true;
  if (/build\s+[a-zà-ỹ0-9]+\s+aram/i.test(norm)) return true;
  if (/(?:hướng|danh|đánh)\s+(?:ap|tank|ad)\s+[a-zà-ỹ0-9]+/i.test(norm)) return true;

  return false;
}

/** Trích xuất tên tướng từ câu hỏi tự nhiên */
export function extractChampionFromQuery(text: string): string {
  const slashMatch = text.match(/\/aram\s+([a-zA-Z0-9\s'’\-]+)/i);
  if (slashMatch) {
    const raw = slashMatch[1].trim().split(/\s+/)[0];
    return raw.replace(/[?!.,;:~\\\/]/g, "");
  }

  const lower = text.toLowerCase();
  for (const key of Object.keys(COMMON_CHAMPION_MAP)) {
    const regex = new RegExp(`\\b${key}\\b`, "i");
    if (regex.test(lower)) {
      return COMMON_CHAMPION_MAP[key];
    }
  }

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
