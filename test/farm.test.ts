import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TELEGRAM_BOT_TOKEN ??= "test";

const { openDb } = await import("../src/db.ts");
const { createFarmService, renderFarmDashboard, renderGardenView, renderPondView, renderShopView, PLANTS, FISHES } =
  await import("../src/farm.ts");

const CHAT = 999;

test("người chơi mới bắt đầu với 100 xu, 5 nước, 5 mồi và 3 ô đất trống", () => {
  const db = openDb(":memory:");
  const farm = createFarmService(db);

  const user = farm.getUser(CHAT);
  assert.equal(user.coins, 100);
  assert.equal(user.water, 5);
  assert.equal(user.food, 5);
  assert.equal(user.exp, 0);

  const plots = farm.getPlots(CHAT);
  assert.equal(plots.length, 3);
  assert.equal(plots[0].plant_type, null);
  assert.equal(plots[1].plant_type, null);
  assert.equal(plots[2].plant_type, null);

  const fishes = farm.getFishes(CHAT);
  assert.equal(fishes.length, 0);
});

test("điểm danh hàng ngày nhận 50 xu, 3 nước, 3 mồi (mỗi 24h một lần)", () => {
  const db = openDb(":memory:");
  const farm = createFarmService(db);

  const res1 = farm.claimDaily(CHAT, Date.now());
  assert.equal(res1.ok, true);
  assert.equal(res1.coinsAdded, 50);

  const user = farm.getUser(CHAT);
  assert.equal(user.coins, 150);
  assert.equal(user.water, 8);
  assert.equal(user.food, 8);

  // Điểm danh lần 2 ngay lập tức phải báo đã nhận
  const res2 = farm.claimDaily(CHAT, Date.now() + 1000);
  assert.equal(res2.ok, false);
});

test("gieo hạt, tưới nước và thu hoạch hoa màu", () => {
  const db = openDb(":memory:");
  const farm = createFarmService(db);
  const now = 1000_000_000;

  // 1. Gieo lúa mì (giá 10 xu, thu hoạch 20 xu)
  const plantRes = farm.plant(CHAT, 0, "wheat", now);
  assert.equal(plantRes.ok, true);
  assert.equal(farm.getUser(CHAT).coins, 90);

  let plots = farm.getPlots(CHAT);
  assert.equal(plots[0].plant_type, "wheat");
  assert.equal(plots[0].watered, 0);

  // Không thể gieo tiếp vào ô đang có cây
  const plantAgain = farm.plant(CHAT, 0, "wheat", now);
  assert.equal(plantAgain.ok, false);

  // 2. Tưới nước (giảm 30% thời gian lớn)
  const oldHarvestAt = plots[0].harvest_at!;
  const waterRes = farm.water(CHAT, 0, now);
  assert.equal(waterRes.ok, true);
  assert.equal(farm.getUser(CHAT).water, 4);

  plots = farm.getPlots(CHAT);
  assert.equal(plots[0].watered, 1);
  assert.ok(plots[0].harvest_at! < oldHarvestAt);

  // Chưa tới giờ thu hoạch
  const harvestEarly = farm.harvest(CHAT, 0, now + 5000);
  assert.equal(harvestEarly.ok, false);

  // 3. Tới giờ thu hoạch
  const harvestDone = farm.harvest(CHAT, 0, plots[0].harvest_at! + 1000);
  assert.equal(harvestDone.ok, true);
  assert.equal(harvestDone.earnedCoins, 20);

  // Số dư: 90 + 20 = 110 xu
  assert.equal(farm.getUser(CHAT).coins, 110);
  assert.ok(farm.getUser(CHAT).exp > 0);

  // Ô đất trở về trống
  plots = farm.getPlots(CHAT);
  assert.equal(plots[0].plant_type, null);
});

test("nuôi cá, cho cá ăn và bán cá trưởng thành", () => {
  const db = openDb(":memory:");
  const farm = createFarmService(db);
  const now = Date.now();

  // 1. Mua cá vàng (20 xu)
  const buyRes = farm.buyFish(CHAT, "goldfish", now);
  assert.equal(buyRes.ok, true);
  assert.equal(farm.getUser(CHAT).coins, 80);

  let fishes = farm.getFishes(CHAT);
  assert.equal(fishes.length, 1);
  const fishId = fishes[0].id;
  assert.equal(fishes[0].fed_count, 0);

  // 2. Cho cá ăn (cần ăn 2 lần)
  const feed1 = farm.feedFish(CHAT, fishId, now);
  assert.equal(feed1.ok, true);
  assert.equal(farm.getUser(CHAT).food, 4);

  // Cho ăn lần 2 để cá lớn hoàn toàn
  const feed2 = farm.feedFish(CHAT, fishId, now + 1000);
  assert.equal(feed2.ok, true);

  fishes = farm.getFishes(CHAT);
  assert.equal(fishes[0].fed_count, 2);
  assert.equal(fishes[0].isMature, true);

  // 3. Bán cá trưởng thành (giá 50 xu)
  const sellRes = farm.sellFish(CHAT, fishId);
  assert.equal(sellRes.ok, true);
  assert.equal(sellRes.earnedCoins, 50);

  // Số dư: 80 + 50 = 130 xu
  assert.equal(farm.getUser(CHAT).coins, 130);
  assert.equal(farm.getFishes(CHAT).length, 0);
});

test("giao diện Emoji hiển thị sinh động và trực quan", () => {
  const db = openDb(":memory:");
  const farm = createFarmService(db);

  const dash = renderFarmDashboard(farm.getUser(CHAT), farm.getPlots(CHAT), farm.getFishes(CHAT));
  assert.match(dash, /NÔNG TRẠI VUI VẺ/);
  assert.match(dash, /🪙 Xu:/);

  const garden = renderGardenView(farm.getUser(CHAT), farm.getPlots(CHAT), Date.now());
  assert.match(garden, /KHU VƯỜN/);

  const pond = renderPondView(farm.getUser(CHAT), farm.getFishes(CHAT));
  assert.match(pond, /HỒ CÁ/);

  const shop = renderShopView(farm.getUser(CHAT));
  assert.match(shop, /CỬA HÀNG/);
});
