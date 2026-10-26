import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TELEGRAM_BOT_TOKEN ??= "test";
process.env.LLM_MODEL = "";
process.env.AUTO_SCHEDULE = "0";

const { checkSensitiveContent, SensitiveContentError } = await import("../src/security.ts");
const { openDb } = await import("../src/db.ts");
const { createTaskService } = await import("../src/tasks.ts");

test("chặn mật khẩu và thông tin đăng nhập ngân hàng (Sacombank, Sa cơm banh, Vietcombank...)", () => {
  const blockedCases = [
    "mật khẩu sacombank",
    "mật khẩu sa cơm banh là 123456",
    "mk sa com banh",
    "mk sacombank: Abc@123",
    "pass vietcombank 1234",
    "password techcombank",
    "mã pin thẻ acb 9999",
    "mã otp ngân hàng gửi về 5566",
    "otp vietcombank",
    "pass internet banking",
    "mật khẩu app ngân hàng mb",
    "mã cvv 123 của thẻ vpbank",
    "cvv 456 thẻ visa",
    "pass tk vcb: 123456",
    "mk momo: 998877",
    "sacombank pass 123456",
    "sa cơm banh mk abc",
    "m.ậ.t k.h.ẩ.u sacombank",
    "p.a.s.s sa com banh 1234",
    "mã pin ngân hàng 4 con số: 1234",
  ];

  for (const text of blockedCases) {
    const res = checkSensitiveContent(text);
    assert.equal(res.safe, false, `Phải chặn: "${text}"`);
    assert.equal(res.reason, "banking", `Lý do phải là banking: "${text}"`);
    assert.ok(res.message && res.message.length > 0);
  }
});

test("không chặn nhầm nhắc nhở ngân hàng bình thường (không có mật khẩu / credential)", () => {
  const safeCases = [
    "mai 9h đi sacombank nộp tiền",
    "hẹn bạn ở sa cơm banh đối diện công ty",
    "chuyển tiền vietcombank cho mẹ 2 triệu",
    "làm lại thẻ techcombank vào thứ 2",
    "họp với giám đốc chi nhánh agribank lúc 14h",
    "rút tiền cây atm bidv",
    "pass lại cái bàn học cũ 200k",
    "pass cái áo thun size L cho bạn",
    "thi pass môn tiếng Anh ngày mai",
    "mua sữa cho con 18h",
    "mai 8h họp team dự án",
    "mở tài khoản ngân hàng acb chiều mai",
  ];

  for (const text of safeCases) {
    const res = checkSensitiveContent(text);
    assert.equal(res.safe, true, `Không được chặn nhầm: "${text}"`);
  }
});

test("chặn từ ngữ nhạy cảm / khiêu dâm / liên quan sex", () => {
  const blockedNsfw = [
    "clip sex",
    "phim sex hay",
    "chat sex tối nay",
    "s.e.x",
    "s*x",
    "sexxx",
    "gái gọi cao cấp",
    "mua dâm giá rẻ",
    "bán dâm",
    "thủ dâm mỗi tối",
    "khiêu dâm",
    "link xxx mới nhất",
    "video porn",
    "hentai 3d",
    "lộ clip nóng",
    "gạ chịch tối nay",
    "rủ đi xoạc",
    "sóc lọ 23h",
  ];

  for (const text of blockedNsfw) {
    const res = checkSensitiveContent(text);
    assert.equal(res.safe, false, `Phải chặn NSFW: "${text}"`);
    assert.equal(res.reason, "nsfw", `Lý do phải là nsfw: "${text}"`);
    assert.ok(res.message && res.message.length > 0);
  }
});

test("không chặn nhầm từ ngữ thông thường chứa ký tự tương tự", () => {
  const safeCases = [
    "đi khám phụ khoa lúc 9h",
    "uống thuốc bổ thận sáng mai",
    "tiết kiệm 5 triệu tháng này",
    "chuẩn bị tài liệu công tác thứ 6",
    "kế hoạch quý 4",
    "mua xúc xích đức 17h",
    "sắp xếp bàn làm việc",
    "tập thể dục lúc 6h",
  ];

  for (const text of safeCases) {
    const res = checkSensitiveContent(text);
    assert.equal(res.safe, true, `Không được chặn nhầm từ bình thường: "${text}"`);
  }
});

test("createTaskService.add chặn nội dung nhạy cảm và không lưu vào DB", async () => {
  const db = openDb(":memory:");
  const tasks = createTaskService(db);

  await assert.rejects(
    async () => {
      await tasks.add(1, "mật khẩu sacombank là 123456", "telegram");
    },
    (err: unknown) => {
      assert.ok(err instanceof SensitiveContentError);
      assert.equal(err.reason, "banking");
      return true;
    },
  );

  await assert.rejects(
    async () => {
      await tasks.add(1, "xem phim sex 22h", "telegram");
    },
    (err: unknown) => {
      assert.ok(err instanceof SensitiveContentError);
      assert.equal(err.reason, "nsfw");
      return true;
    },
  );

  // DB hoàn toàn không có task nào
  assert.equal(db.pendingTasks(1).length, 0);

  // Task hợp lệ thì vẫn thêm bình thường
  const { task } = await tasks.add(1, "mai 9h đi sacombank nộp tiền", "telegram");
  assert.equal(task.text, "đi sacombank nộp tiền");
  assert.equal(db.pendingTasks(1).length, 1);
});
