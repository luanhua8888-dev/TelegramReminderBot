import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeChampionSlug,
  parsePlayAramHtml,
  formatAramMessage,
  isAramQuery,
  extractChampionFromQuery,
  aramKeyboard,
  type AramChampionData,
} from "../src/aram.ts";

const SAMPLE_ARAM_HTML = `<!doctype html>
<html>
  <head>
    <title>Yasuo ARAM Hỗn Loạn – Lõi và trang bị mạnh nhất</title>
  </head>
  <body>
    <h1>Build Yasuo ARAM Hỗn Loạn: Lõi và trang bị mạnh nhất</h1>
    <section>
      <h2>Lõi Kim Cương</h2>
      <div>Cú Đấm Thần Bí 64.48% 15.8% Bác Học Điên 61.76% 8.2%</div>
      <h2>Lõi Vàng</h2>
      <div>Nốt Trầm Bùng Nổ 67.26% 7.4% Khổng Nhân Can Đảm 62.55% 10.1%</div>
      <h2>Lõi Bạc</h2>
      <div>Chuyển Hoá SMPT-SMCK 63.35% 5.0% Chiến Hoặc Chuồn 61.57% 4.2%</div>
    </section>

    <div id="build-panel-0">
      <h3 class="bt-panel__name">Chí mạng · Nghi Thức Suy Vong</h3>
      <span class="sp-stat bt-kpi bt-kpi--wr">60.58%</span>
      <span class="sp-stat bt-kpi">21.6%</span>
      <ul>
        <li><span class="bt-slot__name">Nghi Thức Suy Vong</span></li>
        <li><span class="bt-slot__name">Gươm Suy Vong</span></li>
        <li><span class="bt-slot__name">Vô Cực Kiếm</span></li>
      </ul>
    </div>

    <div id="playstyle-panel-0">
      <h3 class="bt-panel__name">Yasuo Cú Đấm Thần Bí: Q không hồi chiêu</h3>
      <div class="bt-panel__sub"><p>Bão Kiếm Q kích hoạt hiệu ứng đòn đánh lên mục tiêu đầu tiên, nên với Cú Đấm Thần Bí mỗi nhát Q trúng tự rút hồi chiêu của chính nó: Q gần như không hồi chiêu, hất tung liên tục.</p></div>
    </div>

    <h3>Giày tốt nhất</h3>
    <div>Giày Cuồng Nộ 58.03%</div>
    <h3>Phép bổ trợ tốt nhất</h3>
    <div>Tốc Biến + Đánh Dấu 58.40%</div>
  </body>
</html>`;

test("normalizeChampionSlug chuẩn hoá chính xác tên tướng và bí danh", () => {
  assert.equal(normalizeChampionSlug("yasuo"), "yasuo");
  assert.equal(normalizeChampionSlug("Yasuo"), "yasuo");
  assert.equal(normalizeChampionSlug("lee sin"), "leesin");
  assert.equal(normalizeChampionSlug("thầy tu"), "leesin");
  assert.equal(normalizeChampionSlug("master yi"), "masteryi");
  assert.equal(normalizeChampionSlug("yi"), "masteryi");
  assert.equal(normalizeChampionSlug("ngộ không"), "monkeyking");
  assert.equal(normalizeChampionSlug("kai'sa"), "kaisa");
});

test("parsePlayAramHtml bóc tách chuẩn xác lõi, trang bị và combo", () => {
  const data = parsePlayAramHtml(SAMPLE_ARAM_HTML, "yasuo");
  assert.equal(data.championName, "Yasuo");

  assert.ok(data.prismaticAugments.some((a) => a.name.includes("Cú Đấm Thần Bí")));
  assert.ok(data.goldAugments.some((a) => a.name.includes("Khổng Nhân Can Đảm")));
  assert.ok(data.silverAugments.some((a) => a.name.includes("Chuyển Hoá SMPT-SMCK")));

  assert.equal(data.builds.length, 1);
  assert.equal(data.builds[0].name, "Chí mạng · Nghi Thức Suy Vong");
  assert.deepEqual(
    data.builds[0].items.map((i) => i.name),
    ["Nghi Thức Suy Vong", "Gươm Suy Vong", "Vô Cực Kiếm"],
  );

  assert.equal(data.combos.length, 1);
  assert.ok(data.combos[0].title.includes("Q không hồi chiêu"));
  assert.ok(data.combos[0].desc.includes("hất tung liên tục"));
});

test("formatAramMessage định dạng HTML với emoji và blockquote", () => {
  const data = parsePlayAramHtml(SAMPLE_ARAM_HTML, "yasuo");
  const msg = formatAramMessage(data);

  assert.ok(msg.includes("ARAM HỖN LOẠN – YASUO"));
  assert.ok(msg.includes("Lõi Kim Cương"));
  assert.ok(msg.includes("Cú Đấm Thần Bí"));
  assert.ok(msg.includes("<blockquote>"));
  assert.ok(msg.includes("Nghi Thức Suy Vong"));
  assert.ok(msg.includes("PlayARAM.gg"));
});

test("isAramQuery nhận diện đúng câu hỏi liên quan đến ARAM", () => {
  assert.equal(isAramQuery("aram yasuo"), true);
  assert.equal(isAramQuery("lõi cho yasuo"), true);
  assert.equal(isAramQuery("build yasuo aram"), true);
  assert.equal(isAramQuery("https://playaram.gg/ có thể gợi ý mấy nâng cấp cho tướng aram hỗn loạn được không"), true);

  assert.equal(isAramQuery("/aram yasuo"), false); // lệnh bot
  assert.equal(isAramQuery("mai 9h họp"), false);
});

test("extractChampionFromQuery trích xuất đúng tên tướng", () => {
  assert.equal(extractChampionFromQuery("/aram yasuo"), "yasuo");
  assert.equal(extractChampionFromQuery("aram lee sin"), "leesin");
  assert.equal(extractChampionFromQuery("https://playaram.gg/ có thể gợi ý mấy nâng cấp cho tướng aram hỗn loạn được không /aram yasuo các lõi phù hợp nhất, cũng như item đồ"), "yasuo");
  assert.equal(extractChampionFromQuery("lõi cho yone"), "yone");
});

test("aramKeyboard tạo nút link web và các nút tướng nhanh", () => {
  const kb = aramKeyboard("yasuo");
  assert.ok(kb.inline_keyboard.length >= 3);
  const flat = kb.inline_keyboard.flat();
  assert.ok(flat.some((b) => "url" in b && b.url.includes("playaram.gg/tuong/yasuo")));
  assert.ok(flat.some((b) => "callback_data" in b && b.callback_data === "aram:yone"));
});
