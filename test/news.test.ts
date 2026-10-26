import test from "node:test";
import assert from "node:assert/strict";
import {
  parseVnExpressRss,
  formatTimeAgo,
  cleanDescription,
  formatNewsMessage,
  isNewsQuery,
  newsKeyboard,
} from "../src/news.ts";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tin mới nhất - VnExpress RSS</title>
    <item>
      <title>Thuốc sinh học trị vảy nến đắt đỏ, đề xuất BHYT tăng mức chi trả</title>
      <description><![CDATA[<a href="https://vnexpress.net/thuoc-1.html"><img src="https://i1.vnecdn.net/1.jpg"></a></br>Bệnh viện Da liễu kiến nghị bảo hiểm y tế nâng tỷ lệ thanh toán thuốc sinh học từ 50% lên 70%.]]></description>
      <pubDate>Mon, 26 Oct 2026 15:00:00 +0700</pubDate>
      <link>https://vnexpress.net/thuoc-1.html</link>
      <guid>https://vnexpress.net/thuoc-1.html</guid>
    </item>
    <item>
      <title><![CDATA[Giá vàng hôm nay tiếp tục tăng mạnh]]></title>
      <description><![CDATA[<a href="https://vnexpress.net/vang-2.html"><img src="https://i1.vnecdn.net/2.jpg"></a></br>Thị trường vàng trong nước &amp; thế giới lập kỷ lục mới.]]></description>
      <pubDate>Mon, 26 Oct 2026 14:30:00 +0700</pubDate>
      <link>https://vnexpress.net/vang-2.html</link>
    </item>
  </channel>
</rss>`;

test("parseVnExpressRss bóc tách đúng thông tin bài viết", () => {
  const items = parseVnExpressRss(SAMPLE_RSS, 5);
  assert.equal(items.length, 2);

  assert.equal(items[0].title, "Thuốc sinh học trị vảy nến đắt đỏ, đề xuất BHYT tăng mức chi trả");
  assert.equal(items[0].link, "https://vnexpress.net/thuoc-1.html");
  assert.equal(items[0].summary, "Bệnh viện Da liễu kiến nghị bảo hiểm y tế nâng tỷ lệ thanh toán thuốc sinh học từ 50% lên 70%.");

  assert.equal(items[1].title, "Giá vàng hôm nay tiếp tục tăng mạnh");
  assert.equal(items[1].link, "https://vnexpress.net/vang-2.html");
  assert.equal(items[1].summary, "Thị trường vàng trong nước & thế giới lập kỷ lục mới.");
});

test("cleanDescription loại bỏ thẻ HTML và giải mã entity", () => {
  const raw = '<a href="https://abc.com"><img src="a.jpg"></a></br>Tin tức &amp; sự kiện &#39;nóng&#39; &quot;hôm nay&quot;';
  const cleaned = cleanDescription(raw);
  assert.equal(cleaned, "Tin tức & sự kiện 'nóng' \"hôm nay\"");
});

test("formatTimeAgo tính chính xác khoảng thời gian", () => {
  const now = new Date("2026-10-26T15:30:00+07:00").getTime();
  const date10mAgo = new Date(now - 10 * 60 * 1000).toUTCString();
  const date2hAgo = new Date(now - 2 * 3600 * 1000).toUTCString();
  const date3dAgo = new Date(now - 3 * 24 * 3600 * 1000).toUTCString();

  assert.equal(formatTimeAgo(date10mAgo, now), "10 phút trước");
  assert.equal(formatTimeAgo(date2hAgo, now), "2 giờ trước");
  assert.equal(formatTimeAgo(date3dAgo, now), "3 ngày trước");
});

test("formatNewsMessage định dạng HTML với link và blockquote tóm tắt", () => {
  const items = parseVnExpressRss(SAMPLE_RSS, 5);
  const msg = formatNewsMessage(items, "hot", new Date("2026-10-26T15:30:00+07:00"));

  assert.ok(msg.includes("TIN TỨC HÔM NAY"));
  assert.ok(msg.includes("Chuyên mục: 🔥 <b>Nổi bật</b>"));
  assert.ok(msg.includes('<a href="https://vnexpress.net/thuoc-1.html"><b>Thuốc sinh học trị vảy nến'));
  assert.ok(msg.includes("<blockquote>"));
});

test("isNewsQuery nhận diện đúng câu hỏi tin tức và không nhầm việc khác", () => {
  assert.equal(isNewsQuery("/news"), false); // /news xử lý qua bot.command
  assert.equal(isNewsQuery("news"), true);
  assert.equal(isNewsQuery("tin tức"), true);
  assert.equal(isNewsQuery("tin tức hôm nay"), true);
  assert.equal(isNewsQuery("tin hot hôm nay"), true);
  assert.equal(isNewsQuery("hôm nay có tin gì mới không"), true);
  assert.equal(isNewsQuery("đọc báo hôm nay"), true);
  assert.equal(isNewsQuery("báo mới"), true);

  // Không bắt nhầm các tác vụ bình thường
  assert.equal(isNewsQuery("nhắn tin cho mẹ"), false);
  assert.equal(isNewsQuery("gửi tin nhắn cho khách"), false);
  assert.equal(isNewsQuery("mai 9h họp"), false);
});

test("newsKeyboard tạo các nút chuyển chuyên mục và nút refresh", () => {
  const kb = newsKeyboard("hot");
  assert.ok(kb.inline_keyboard.length >= 2);
  const flatButtons = kb.inline_keyboard.flat();
  assert.ok(flatButtons.some((b) => "callback_data" in b && b.callback_data === "news:hot"));
  assert.ok(flatButtons.some((b) => "callback_data" in b && b.callback_data === "news:thoisu"));
  assert.ok(flatButtons.some((b) => "callback_data" in b && b.callback_data === "news:refresh:hot"));
});
