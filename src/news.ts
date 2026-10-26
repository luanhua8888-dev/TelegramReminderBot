import { InlineKeyboard } from "grammy";

export interface NewsItem {
  title: string;
  summary: string;
  link: string;
  pubDate: string;
  timeAgo: string;
}

export type NewsCategory = "hot" | "thoisu" | "kinhdoanh" | "congnghe" | "thethao";

export interface CategoryInfo {
  key: NewsCategory;
  name: string;
  emoji: string;
  rssUrl: string;
}

export const NEWS_CATEGORIES: Record<NewsCategory, CategoryInfo> = {
  hot: {
    key: "hot",
    name: "Nổi bật",
    emoji: "🔥",
    rssUrl: "https://vnexpress.net/rss/tin-moi-nhat.rss",
  },
  thoisu: {
    key: "thoisu",
    name: "Thời sự",
    emoji: "📰",
    rssUrl: "https://vnexpress.net/rss/thoi-su.rss",
  },
  kinhdoanh: {
    key: "kinhdoanh",
    name: "Kinh doanh",
    emoji: "💼",
    rssUrl: "https://vnexpress.net/rss/kinh-doanh.rss",
  },
  congnghe: {
    key: "congnghe",
    name: "Công nghệ",
    emoji: "💻",
    rssUrl: "https://vnexpress.net/rss/so-hoa.rss",
  },
  thethao: {
    key: "thethao",
    name: "Thể thao",
    emoji: "⚽",
    rssUrl: "https://vnexpress.net/rss/the-thao.rss",
  },
};

/** Giúp giải mã các thực thể HTML/XML cơ bản */
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/** Bóc tách text thuần từ HTML description của VnExpress */
export function cleanDescription(raw: string): string {
  // VnExpress RSS description thường có dạng: <a href="..."><img ...></a></br>Nội dung mô tả...
  const withoutTags = raw.replace(/<[^>]*>/g, " ");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

/** Tính khoảng thời gian tương đối: '10 phút trước', '2 giờ trước' */
export function formatTimeAgo(dateStr: string, nowMs = Date.now()): string {
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return "";
  const diffSec = Math.max(0, Math.floor((nowMs - parsed) / 1000));
  if (diffSec < 60) return "vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

/** Phân tích XML RSS của VnExpress thành danh sách NewsItem */
export function parseVnExpressRss(xmlText: string, limit = 5, nowMs = Date.now()): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/gi) || [];

  for (const block of itemMatches) {
    if (items.length >= limit) break;

    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) ||
      block.match(/<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i);
    const descMatch = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    const dateMatch = block.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i);

    const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : "";
    const link = linkMatch ? linkMatch[1].trim() : "";
    const rawDesc = descMatch ? descMatch[1].trim() : "";
    const summary = cleanDescription(rawDesc);
    const pubDate = dateMatch ? dateMatch[1].trim() : "";

    if (title && link) {
      items.push({
        title,
        summary,
        link,
        pubDate,
        timeAgo: formatTimeAgo(pubDate, nowMs),
      });
    }
  }

  return items;
}

/** Lấy tin tức mới nhất từ chuyên mục */
export async function fetchTopNews(category: NewsCategory = "hot", limit = 5): Promise<NewsItem[]> {
  const cat = NEWS_CATEGORIES[category] || NEWS_CATEGORIES.hot;
  const res = await fetch(cat.rssUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} khi tải RSS từ ${cat.rssUrl}`);
  }

  const xml = await res.text();
  return parseVnExpressRss(xml, limit);
}

/** Định dạng tin tức thành tin nhắn HTML gửi Telegram */
export function formatNewsMessage(items: NewsItem[], category: NewsCategory = "hot", updatedAt = new Date()): string {
  const cat = NEWS_CATEGORIES[category] || NEWS_CATEGORIES.hot;
  const timeStr = updatedAt.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  if (items.length === 0) {
    return `📰 <b>TIN TỨC ${cat.name.toUpperCase()}</b> · <i>${timeStr}</i>\n\nChưa có tin tức mới trong mục này. Bạn thử lại sau nhé!`;
  }

  const lines: string[] = [
    `📰 <b>TIN TỨC HÔM NAY</b> · <i>Cập nhật lúc ${timeStr}</i>`,
    `Chuyên mục: ${cat.emoji} <b>${cat.name}</b>`,
    "",
  ];

  items.forEach((item, idx) => {
    const timeBadge = item.timeAgo ? ` <i>(${item.timeAgo})</i>` : "";
    lines.push(
      `<b>${idx + 1}.</b> <a href="${item.link}"><b>${escapeHtml(item.title)}</b></a>${timeBadge}`,
    );
    if (item.summary) {
      // Giới hạn độ dài tóm tắt vừa vặn trong Telegram card
      const shortDesc = item.summary.length > 160 ? `${item.summary.slice(0, 157)}...` : item.summary;
      lines.push(`<blockquote>${escapeHtml(shortDesc)}</blockquote>`);
    }
    lines.push("");
  });

  lines.push("💡 <i>Bấm chuyên mục bên dưới để xem thêm hoặc bấm 🔄 Cập nhật</i>");
  return lines.join("\n");
}

/** Bàn phím Inline cho tin tức */
export function newsKeyboard(activeCategory: NewsCategory = "hot"): InlineKeyboard {
  const kb = new InlineKeyboard();

  const btnText = (key: NewsCategory) => {
    const cat = NEWS_CATEGORIES[key];
    return activeCategory === key ? `• ${cat.emoji} ${cat.name} •` : `${cat.emoji} ${cat.name}`;
  };

  kb.text(btnText("hot"), "news:hot")
    .text(btnText("thoisu"), "news:thoisu")
    .text(btnText("kinhdoanh"), "news:kinhdoanh")
    .row()
    .text(btnText("congnghe"), "news:congnghe")
    .text(btnText("thethao"), "news:thethao")
    .text("🔄 Cập nhật", `news:refresh:${activeCategory}`);

  return kb;
}

/** Nhận diện câu hỏi liên quan đến tin tức */
export function isNewsQuery(text: string): boolean {
  const norm = text.trim().toLowerCase();
  if (norm === "news" || norm === "tin" || norm === "tin tuc" || norm === "tin tức") return true;

  // Tránh bắt nhầm các việc note như "nhắc tin nhắn", "gửi tin nhắn", "nhắn tin cho A"
  if (/nh[ắaá]n\s+tin|g[ửu]i\s+tin\s+nh[ắa]n|tr[ảa]\s+l[ờo]i\s+tin/i.test(norm)) {
    return false;
  }

  // Khớp các câu hỏi đọc tin
  const newsPattern = /(?:^|\s)(?:tin\s*(?:tức|tuc|hot|nóng|nong|mới|moi|nhanh)|đọc\s*báo|doc\s*bao|báo\s*mới|bao\s*moi|điểm\s*tin|diem\s*tin)(?:\s|$|[?!.,])/i;
  if (newsPattern.test(norm)) return true;

  // "có tin gì mới không", "hôm nay có tin gì", "tin tức hôm nay thế nào"
  if (/c[óo]\s+tin\s+g[ìi]|tin\s+(?:g[ìi]|t[ứu]c).*(?:h[ôo]m\s+nay|m[ớo]i)/i.test(norm)) {
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
