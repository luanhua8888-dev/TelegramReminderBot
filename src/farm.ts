// Game mini Nông trại vui vẻ (Trồng cây & Nuôi cá) độc lập qua lệnh /farm

import { InlineKeyboard } from "grammy";
import type { Db, FarmFish, FarmPlot, FarmUser } from "./db.ts";

export type PlantDef = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  growthMs: number;
  rewardCoins: number;
  rewardExp: number;
};

export const PLANTS: Record<string, PlantDef> = {
  wheat: {
    id: "wheat",
    name: "Lúa mì",
    emoji: "🌾",
    cost: 10,
    growthMs: 60_000, // 1 phút
    rewardCoins: 20,
    rewardExp: 10,
  },
  strawberry: {
    id: "strawberry",
    name: "Dâu tây",
    emoji: "🍓",
    cost: 30,
    growthMs: 180_000, // 3 phút
    rewardCoins: 60,
    rewardExp: 25,
  },
  apple: {
    id: "apple",
    name: "Cây táo",
    emoji: "🍎",
    cost: 60,
    growthMs: 300_000, // 5 phút
    rewardCoins: 130,
    rewardExp: 50,
  },
  money_tree: {
    id: "money_tree",
    name: "Cây tài lộc",
    emoji: "💰",
    cost: 150,
    growthMs: 600_000, // 10 phút
    rewardCoins: 350,
    rewardExp: 150,
  },
};

export type FishDef = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  maxFed: number;
  sellPrice: number;
};

export const FISHES: Record<string, FishDef> = {
  goldfish: {
    id: "goldfish",
    name: "Cá vàng",
    emoji: "🐟",
    cost: 20,
    maxFed: 2,
    sellPrice: 50,
  },
  clownfish: {
    id: "clownfish",
    name: "Cá hề Nemo",
    emoji: "🐠",
    cost: 50,
    maxFed: 3,
    sellPrice: 120,
  },
  koi: {
    id: "koi",
    name: "Cá Koi",
    emoji: "🎏",
    cost: 100,
    maxFed: 4,
    sellPrice: 260,
  },
  shark: {
    id: "shark",
    name: "Cá mập con",
    emoji: "🦈",
    cost: 250,
    maxFed: 5,
    sellPrice: 650,
  },
};

export type EnrichedFish = FarmFish & {
  def: FishDef;
  isMature: boolean;
};

export function createFarmService(db: Db) {
  return {
    getUser(chatId: number): FarmUser {
      return db.getOrCreateFarmUser(chatId);
    },

    getPlots(chatId: number): FarmPlot[] {
      return db.getFarmPlots(chatId);
    },

    getFishes(chatId: number): EnrichedFish[] {
      const raw = db.getFarmFishes(chatId);
      return raw.map((f) => {
        const def = FISHES[f.fish_type] ?? FISHES.goldfish;
        return {
          ...f,
          def,
          isMature: f.fed_count >= f.max_fed,
        };
      });
    },

    claimDaily(chatId: number, now = Date.now()): { ok: boolean; message: string; coinsAdded?: number } {
      const user = db.getOrCreateFarmUser(chatId);
      const DAY_MS = 24 * 3600_000;
      if (now - user.last_daily < DAY_MS) {
        const leftHours = Math.ceil((user.last_daily + DAY_MS - now) / 3600_000);
        return { ok: false, message: `Bạn đã điểm danh hôm nay rồi. Quay lại sau ${leftHours} giờ nữa nhé!` };
      }
      user.coins += 50;
      user.water += 3;
      user.food += 3;
      user.last_daily = now;
      db.saveFarmUser(user);
      return { ok: true, message: "🎁 Điểm danh thành công! Nhận +50 Xu, +3 Nước tưới, +3 Thức ăn cá.", coinsAdded: 50 };
    },

    plant(chatId: number, slotIndex: number, plantId: string, now = Date.now()): { ok: boolean; message: string } {
      const user = db.getOrCreateFarmUser(chatId);
      const def = PLANTS[plantId];
      if (!def) return { ok: false, message: "Hạt giống không tồn tại." };
      if (user.coins < def.cost) return { ok: false, message: `Không đủ xu (Cần ${def.cost} xu).` };

      const plots = db.getFarmPlots(chatId);
      const plot = plots.find((p) => p.slot_index === slotIndex);
      if (!plot) return { ok: false, message: "Ô đất không hợp lệ." };
      if (plot.plant_type !== null) return { ok: false, message: "Ô đất này đang có cây trồng rồi!" };

      user.coins -= def.cost;
      db.saveFarmUser(user);

      const harvestAt = now + def.growthMs;
      db.saveFarmPlot(chatId, slotIndex, def.id, now, harvestAt, 0);
      return { ok: true, message: `🌱 Đã gieo ${def.name} vào ô #${slotIndex + 1}!` };
    },

    water(chatId: number, slotIndex: number, now = Date.now()): { ok: boolean; message: string } {
      const user = db.getOrCreateFarmUser(chatId);
      if (user.water <= 0) return { ok: false, message: "Đã hết nước tưới! Hãy mua thêm ở Cửa hàng." };

      const plots = db.getFarmPlots(chatId);
      const plot = plots.find((p) => p.slot_index === slotIndex);
      if (!plot || !plot.plant_type) return { ok: false, message: "Ô đất trống, không có cây để tưới." };
      if (plot.watered >= 1) return { ok: false, message: "Cây đã được tưới đủ nước rồi!" };

      user.water -= 1;
      db.saveFarmUser(user);

      // Tưới nước rút ngắn 30% thời gian còn lại
      const remaining = Math.max(0, (plot.harvest_at ?? now) - now);
      const newHarvestAt = now + Math.floor(remaining * 0.7);

      db.saveFarmPlot(chatId, slotIndex, plot.plant_type, plot.planted_at, newHarvestAt, 1);
      return { ok: true, message: `💧 Đã tưới nước cho ô #${slotIndex + 1}! Cây lớn nhanh hơn 30%.` };
    },

    harvest(chatId: number, slotIndex: number, now = Date.now()): { ok: boolean; message: string; earnedCoins?: number } {
      const plots = db.getFarmPlots(chatId);
      const plot = plots.find((p) => p.slot_index === slotIndex);
      if (!plot || !plot.plant_type) return { ok: false, message: "Ô đất trống, không có gì để thu hoạch." };

      const def = PLANTS[plot.plant_type];
      if (!def) return { ok: false, message: "Loại cây không xác định." };

      if (!plot.harvest_at || now < plot.harvest_at) {
        const leftSec = Math.ceil(((plot.harvest_at ?? now) - now) / 1000);
        return { ok: false, message: `Cây chưa chín! Còn khoảng ${leftSec} giây nữa.` };
      }

      const user = db.getOrCreateFarmUser(chatId);
      user.coins += def.rewardCoins;
      user.exp += def.rewardExp;
      db.saveFarmUser(user);

      // Đưa ô đất về trạng thái trống
      db.saveFarmPlot(chatId, slotIndex, null, null, null, 0);

      return {
        ok: true,
        message: `🎉 Thu hoạch thành công ${def.emoji} ${def.name}! Nhận được +${def.rewardCoins} Xu và +${def.rewardExp} EXP.`,
        earnedCoins: def.rewardCoins,
      };
    },

    buyFish(chatId: number, fishId: string, now = Date.now()): { ok: boolean; message: string } {
      const user = db.getOrCreateFarmUser(chatId);
      const def = FISHES[fishId];
      if (!def) return { ok: false, message: "Loại cá không tồn tại." };
      if (user.coins < def.cost) return { ok: false, message: `Không đủ xu (Cần ${def.cost} xu).` };

      const fishes = db.getFarmFishes(chatId);
      if (fishes.length >= 6) return { ok: false, message: "Hồ cá đã đầy (tối đa 6 con). Hãy bán bớt cá lớn nhé!" };

      user.coins -= def.cost;
      db.saveFarmUser(user);

      db.addFarmFish(chatId, def.id, def.maxFed);
      return { ok: true, message: `🎏 Đã mua ${def.emoji} ${def.name} thả vào hồ cá!` };
    },

    feedFish(chatId: number, fishId: number, now = Date.now()): { ok: boolean; message: string } {
      const user = db.getOrCreateFarmUser(chatId);
      if (user.food <= 0) return { ok: false, message: "Đã hết thức ăn cá! Mua thêm ở Cửa hàng nhé." };

      const fishes = db.getFarmFishes(chatId);
      const fish = fishes.find((f) => f.id === fishId);
      if (!fish) return { ok: false, message: "Không tìm thấy con cá này." };
      if (fish.fed_count >= fish.max_fed) return { ok: false, message: "Cá đã trưởng thành tối đa, sẵn sàng bán!" };

      user.food -= 1;
      db.saveFarmUser(user);

      db.feedFarmFish(fishId, chatId);
      const newFed = fish.fed_count + 1;
      const isNowMature = newFed >= fish.max_fed;
      return {
        ok: true,
        message: isNowMature
          ? `🌟 Cá đã ăn no và đạt độ TRƯỞNG THÀNH! Bạn có thể bán lấy món tiền lớn.`
          : `🦐 Đã cho cá ăn (${newFed}/${fish.max_fed})!`,
      };
    },

    sellFish(chatId: number, fishId: number): { ok: boolean; message: string; earnedCoins?: number } {
      const fishes = db.getFarmFishes(chatId);
      const fish = fishes.find((f) => f.id === fishId);
      if (!fish) return { ok: false, message: "Không tìm thấy cá để bán." };
      if (fish.fed_count < fish.max_fed) return { ok: false, message: "Cá chưa lớn! Cho ăn đủ mới bán được giá tốt." };

      const def = FISHES[fish.fish_type] ?? FISHES.goldfish;
      const user = db.getOrCreateFarmUser(chatId);
      user.coins += def.sellPrice;
      user.exp += 30;
      db.saveFarmUser(user);

      db.deleteFarmFish(fishId, chatId);
      return {
        ok: true,
        message: `💰 Đã bán ${def.emoji} ${def.name} trưởng thành! Thu về +${def.sellPrice} Xu.`,
        earnedCoins: def.sellPrice,
      };
    },

    buySupply(chatId: number, item: "water" | "food"): { ok: boolean; message: string } {
      const user = db.getOrCreateFarmUser(chatId);
      const cost = 10;
      if (user.coins < cost) return { ok: false, message: "Không đủ 10 xu để mua." };

      user.coins -= cost;
      if (item === "water") {
        user.water += 5;
        db.saveFarmUser(user);
        return { ok: true, message: "💧 Đã mua +5 Nước tưới (tốn 10 xu)." };
      } else {
        user.food += 5;
        db.saveFarmUser(user);
        return { ok: true, message: "🦐 Đã mua +5 Thức ăn cá (tốn 10 xu)." };
      }
    },
  };
}

export type FarmService = ReturnType<typeof createFarmService>;

/** Hiển thị Menu Tổng quan Nông trại */
export function renderFarmDashboard(user: FarmUser, plots: FarmPlot[], fishes: EnrichedFish[]): string {
  const readyPlots = plots.filter((p) => p.plant_type && p.harvest_at && Date.now() >= p.harvest_at).length;
  const matureFishes = fishes.filter((f) => f.isMature).length;

  return [
    `🌾 <b>NÔNG TRẠI VUI VẺ · FARM DASHBOARD</b> 🎏`,
    `──────────────────────`,
    `👤 <b>Tài sản nông dân:</b>`,
    `🪙 Xu: <b>${user.coins}</b> · ⭐ EXP: <b>${user.exp}</b>`,
    `💧 Nước tưới: <b>${user.water}</b> bình · 🦐 Thức ăn cá: <b>${user.food}</b> gói`,
    ``,
    `🌳 <b>Khu vườn:</b> ${plots.length} ô đất ${readyPlots > 0 ? `(✨ Có ${readyPlots} cây chín!)` : ""}`,
    `🐟 <b>Hồ cá:</b> ${fishes.length}/6 con ${matureFishes > 0 ? `(🌟 ${matureFishes} cá trưởng thành!)` : ""}`,
    `──────────────────────`,
    `<i>Bấm các nút bên dưới để chăm sóc vườn hoặc hồ cá:</i>`,
  ].join("\n");
}

export function farmDashboardKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🌳 Khu Vườn", "farm:garden")
    .text("🐟 Hồ Cá", "farm:pond")
    .row()
    .text("🏪 Cửa Hàng", "farm:shop")
    .text("🎁 Điểm Danh", "farm:daily");
}

/** Hiển thị Khu Vườn */
export function renderGardenView(user: FarmUser, plots: FarmPlot[], now = Date.now()): string {
  const lines: string[] = [
    `🌳 <b>KHU VƯỜN HOA MÀU</b>`,
    `💧 Nước còn: <b>${user.water}</b> bình · 🪙 Xu: <b>${user.coins}</b>`,
    `──────────────────────`,
  ];

  plots.forEach((p, idx) => {
    if (!p.plant_type) {
      lines.push(`🟫 <b>Ô #${idx + 1}:</b> Đất trống <i>(Chưa gieo hạt)</i>`);
    } else {
      const def = PLANTS[p.plant_type];
      const isReady = p.harvest_at && now >= p.harvest_at;
      const statusIcon = isReady ? "✨ CHÍN RỒI (Thu hoạch ngay!)" : p.watered ? "🌿 Đang lớn (Đã tưới nước)" : "🌱 Đang lớn (Chưa tưới)";
      const timeLeft = isReady ? "" : ` · Còn ~${Math.ceil(((p.harvest_at ?? now) - now) / 1000)}s`;
      lines.push(`${def?.emoji ?? "🌱"} <b>Ô #${idx + 1}:</b> ${def?.name ?? p.plant_type} · ${statusIcon}${timeLeft}`);
    }
  });

  lines.push(`──────────────────────`);
  lines.push(`<i>Tưới nước 💧 giúp cây lớn nhanh hơn 30%!</i>`);
  return lines.join("\n");
}

export function gardenKeyboard(plots: FarmPlot[], now = Date.now()): InlineKeyboard {
  const kb = new InlineKeyboard();

  plots.forEach((p, idx) => {
    if (!p.plant_type) {
      kb.text(`🌱 Gieo #${idx + 1}`, `farm:seedmenu:${idx}`);
    } else if (p.harvest_at && now >= p.harvest_at) {
      kb.text(`🍎 Thu hoạch #${idx + 1}`, `farm:harvest:${idx}`);
    } else if (!p.watered) {
      kb.text(`💧 Tưới #${idx + 1}`, `farm:water:${idx}`);
    }
  });

  kb.row().text("🔄 Làm mới vườn", "farm:garden").text("🔙 Về Nông Trại", "farm:menu");
  return kb;
}

export function seedSelectKeyboard(slotIndex: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(`🌾 Lúa (10xu)`, `farm:plant:${slotIndex}:wheat`)
    .text(`🍓 Dâu (30xu)`, `farm:plant:${slotIndex}:strawberry`)
    .row()
    .text(`🍎 Táo (60xu)`, `farm:plant:${slotIndex}:apple`)
    .text(`💰 Tài Lộc (150xu)`, `farm:plant:${slotIndex}:money_tree`)
    .row()
    .text("🔙 Hủy / Quay lại", "farm:garden");
}

/** Hiển thị Hồ Cá */
export function renderPondView(user: FarmUser, fishes: EnrichedFish[]): string {
  const lines: string[] = [
    `🐟 <b>HỒ CÁ TUNG TĂNG</b> 🫧`,
    `🦐 Mồi còn: <b>${user.food}</b> gói · 🪙 Xu: <b>${user.coins}</b>`,
    `──────────────────────`,
  ];

  if (fishes.length === 0) {
    lines.push(`🫧 🌊  <i>Hồ đang trống vắng... Hãy vào Cửa Hàng mua cá giống thả vào nhé!</i>  🌊 🫧`);
  } else {
    // Hoạt cảnh hồ cá
    const swimPool = fishes.map((f) => f.def.emoji).join("  ");
    lines.push(`🫧 🌊  ${swimPool}  🌊 🫧\n`);

    fishes.forEach((f, idx) => {
      const progress = f.isMature ? "🌟 Trưởng thành (Bán được giá!)" : `Đang lớn (${f.fed_count}/${f.max_fed} mồi)`;
      lines.push(`${f.def.emoji} <b>Cá #${idx + 1}:</b> ${f.def.name} · ${progress}`);
    });
  }

  lines.push(`──────────────────────`);
  lines.push(`<i>Cho ăn đủ số lần cá sẽ trưởng thành và bán được giá cao!</i>`);
  return lines.join("\n");
}

export function pondKeyboard(fishes: EnrichedFish[]): InlineKeyboard {
  const kb = new InlineKeyboard();

  fishes.forEach((f, idx) => {
    if (!f.isMature) {
      kb.text(`🦐 Cho ăn #${idx + 1}`, `farm:feed:${f.id}`);
    } else {
      kb.text(`💰 Bán #${idx + 1} (${f.def.sellPrice}xu)`, `farm:sellfish:${f.id}`);
    }
    if ((idx + 1) % 2 === 0) kb.row();
  });

  kb.row()
    .text("🛒 Mua thêm cá", "farm:shop")
    .text("🔄 Làm mới hồ", "farm:pond")
    .row()
    .text("🔙 Về Nông Trại", "farm:menu");
  return kb;
}

/** Hiển thị Cửa Hàng Nông Trại */
export function renderShopView(user: FarmUser): string {
  return [
    `🏪 <b>CỬA HÀNG NÔNG TRẠI</b> 🛒`,
    `Số dư của bạn: 🪙 <b>${user.coins} Xu</b>`,
    `──────────────────────`,
    `🌾 <b>Hạt giống:</b>`,
    `• Lúa mì: 10 xu ➔ Thu hoạch: 20 xu (1 phút)`,
    `• Dâu tây: 30 xu ➔ Thu hoạch: 60 xu (3 phút)`,
    `• Cây táo: 60 xu ➔ Thu hoạch: 130 xu (5 phút)`,
    `• Cây tài lộc: 150 xu ➔ Thu hoạch: 350 xu (10 phút)`,
    ``,
    `🎏 <b>Cá giống:</b>`,
    `• Cá vàng: 20 xu ➔ Bán: 50 xu (ăn 2 lần)`,
    `• Cá Nemo: 50 xu ➔ Bán: 120 xu (ăn 3 lần)`,
    `• Cá Koi: 100 xu ➔ Bán: 260 xu (ăn 4 lần)`,
    `• Cá mập con: 250 xu ➔ Bán: 650 xu (ăn 5 lần)`,
    ``,
    `🧰 <b>Dụng cụ:</b>`,
    `• 5 Bình nước tưới 💧: 10 xu`,
    `• 5 Gói thức ăn cá 🦐: 10 xu`,
    `──────────────────────`,
  ].join("\n");
}

export function shopKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🐟 Mua Cá Vàng (20x)", "farm:buyfish:goldfish")
    .text("🐠 Mua Cá Nemo (50x)", "farm:buyfish:clownfish")
    .row()
    .text("🎏 Mua Cá Koi (100x)", "farm:buyfish:koi")
    .text("🦈 Mua Cá Mập (250x)", "farm:buyfish:shark")
    .row()
    .text("💧 +5 Nước (10x)", "farm:buysupply:water")
    .text("🦐 +5 Mồi (10x)", "farm:buysupply:food")
    .row()
    .text("🔙 Về Nông Trại", "farm:menu");
}
