# Gói 1: Nâng cấp Telegram UX & Voice-to-Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp trải nghiệm bot Telegram với giao diện Card UI trực quan, thanh tiến độ, Persistent Menu Keyboard tiện dụng và tính năng ghi note qua tin nhắn thoại (Voice Note to Task) dùng Whisper STT.

**Architecture:** 
- Nâng cấp tầng hiển thị trong `src/tasks.ts` để sinh tin nhắn dạng Card UI chuẩn Telegram HTML (`<blockquote>`, visual progress bar).
- Thêm Persistent Reply Keyboard trong `src/bot.ts` với các nút điều hướng nhanh (`📋 Hôm nay`, `📥 Hộp thư`, `➕ Thêm việc`, `📊 Thống kê`), đồng thời bổ sung query thống kê trong `src/db.ts`.
- Tạo module `src/stt.ts` xử lý tải audio từ Telegram Bot API và gọi endpoint Speech-to-Text chuẩn OpenAI `/audio/transcriptions` (tương thích OpenAI Whisper và Groq Whisper siêu tốc), sau đó luân chuyển văn bản vào pipeline tạo task sẵn có.

**Tech Stack:** TypeScript, Node.js (>=23.6, `node:sqlite`, `node:test`), `grammy` (^1.46.0), OpenAI-compatible STT API (Fetch / FormData).

**Spec:** Yêu cầu người dùng chọn Gói 1: UX Card format + Persistent Menu + Voice Note transcription.

## Global Constraints

- Chạy trên Node.js >= 23.6 mà không cần build step (native TypeScript execution).
- Không thêm thư viện phụ thuộc cồng kềnh (dùng native `fetch`, `FormData`, `Blob` có sẵn trong Node.js).
- Giữ 100% độ tương thích ngược với các lệnh hiện tại (`/list`, `/today`, `/done`, `/move`, `/del`).
- Toàn bộ test phải pass (`npm test` và `npm run typecheck`).

## Review Focus

1. Tin nhắn thoại không có cấu hình STT API key: Bot phải phản hồi thông báo hướng dẫn văn minh, không crash hoặc treo typing.
2. Voice note transcribe ra chuỗi rỗng hoặc chỉ có tiếng ồn: Xử lý an toàn, báo người dùng nói rõ hơn.
3. Người dùng ấn Persistent Menu button khi đang có rate limit: Áp dụng cơ chế anti-spam hiện có.
4. Chia cho 0 trong hàm tính tiến độ (khi không có task nào): Phải trả về thanh rỗng an toàn `[░░░░░░░░░░] 0%`.
5. Voice note gửi trong group: Chỉ nhận private voice note hoặc khi được reply/mention (tránh transcribe mọi voice chat trong nhóm).

---

### Task 1: Card UI & Visual Formatting

**Files:**
- Modify: `src/tasks.ts`
- Modify: `src/scheduler.ts`
- Test: `test/tasks.test.ts`

**Interfaces:**
- Consumes: `Task` from `src/db.ts`
- Produces: 
  - `renderProgressBar(done: number, total: number, size?: number): string`
  - `formatTaskCard(task: Task, index?: number): string`
  - Updated `formatTask(t: Task): string`

- [ ] **Step 1: Write failing tests for progress bar & card formatting**

Thêm test vào `test/tasks.test.ts`:
```typescript
test("renderProgressBar hiển thị đúng tỷ lệ", () => {
  assert.strictEqual(renderProgressBar(0, 0), "[░░░░░░░░░░] 0%");
  assert.strictEqual(renderProgressBar(5, 10, 10), "[▓▓▓▓▓░░░░░] 50%");
  assert.strictEqual(renderProgressBar(10, 10, 10), "[▓▓▓▓▓▓▓▓▓▓] 100%");
});

test("formatTaskCard định dạng HTML blockquote và emoji", () => {
  const task: Task = {
    id: 1,
    chat_id: 123,
    text: "Mua sữa tươi",
    due_at: 1774843200000,
    next_remind_at: 1774843200000,
    remind_count: 0,
    recurring: null,
    status: "pending",
    source: "telegram",
    created_at: 1774800000000,
  };
  const card = formatTaskCard(task);
  assert.match(card, /<b>#1<\/b>/);
  assert.match(card, /<blockquote>Mua sữa tươi<\/blockquote>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "test/tasks.test.ts"`
Expected: FAIL (functions not defined)

- [ ] **Step 3: Implement `renderProgressBar` and `formatTaskCard` in `src/tasks.ts`**

- `renderProgressBar(done: number, total: number, size = 10): string`: tính phần trăm, tạo thanh `▓` và `░`.
- `formatTaskCard(task: Task)`: dùng `<blockquote>` cho nội dung việc, icon `⏳` cho giờ nhắc, `🔁` cho lặp, `📥` cho source.
- Cập nhật thông điệp nhắc việc trong `src/scheduler.ts` dùng format card đẹp mắt.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "test/tasks.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tasks.ts src/scheduler.ts test/tasks.test.ts
git commit -m "feat(ui): add progress bar and telegram card formatting"
```

---

### Task 2: Persistent Menu Keyboard & Thống kê (Stats)

**Files:**
- Modify: `src/db.ts`
- Modify: `src/bot.ts`
- Test: `test/tasks.test.ts`

**Interfaces:**
- Consumes: `openDb` from `src/db.ts`, `renderProgressBar` from `src/tasks.ts`
- Produces: 
  - `mainMenuKeyboard()` in `src/bot.ts`
  - `getDailyStats(chatId: number, startOfDay: number, endOfDay: number): { doneToday: number; pendingToday: number; inbox: number }` in `src/db.ts`

- [ ] **Step 1: Write test for database stats query**

Thêm test vào `test/tasks.test.ts`:
```typescript
test("db.getDailyStats đếm đúng task hoàn thành và tồn đọng hôm nay", () => {
  const db = openDb(":memory:");
  const now = Date.now();
  const t1 = db.addTask(100, "Việc 1", now + 1000, null, "telegram");
  const t2 = db.addTask(100, "Việc 2", now + 2000, null, "telegram");
  const t3 = db.addTask(100, "Việc inbox", null, null, "telegram");
  db.setStatus(t1.id, 100, "done");

  const stats = db.getDailyStats(100, now - 10000, now + 10000);
  assert.strictEqual(stats.doneToday, 1);
  assert.strictEqual(stats.pendingToday, 1);
  assert.strictEqual(stats.inbox, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "test/tasks.test.ts"`
Expected: FAIL (`db.getDailyStats is not a function`)

- [ ] **Step 3: Implement `getDailyStats` in `src/db.ts` and Persistent Keyboard in `src/bot.ts`**

- Trong `src/db.ts`: thêm query `getDailyStats` đếm các task `status = 'done'` trong ngày, `status = 'pending'` trong ngày, và `due_at IS NULL`.
- Trong `src/bot.ts`:
  - Khởi tạo `mainMenuKeyboard = new Keyboard().text("📋 Hôm nay").text("➕ Thêm việc").row().text("📥 Hộp thư").text("📊 Thống kê").text("❓ Trợ giúp").resized().persistent()`
  - Gửi kèm `reply_markup: mainMenuKeyboard` khi user gọi `/start`, `/help` hoặc thêm note mới.
  - Bắt các tin nhắn text tương ứng:
    - `"📋 Hôm nay"`: Chạy logic xem việc hôm nay kèm thanh tiến độ hoàn thành trong ngày.
    - `"📥 Hộp thư"`: Hiển thị các việc chưa xếp giờ (`due_at === null`).
    - `"➕ Thêm việc"`: Trả lời hướng dẫn ngắn gọn cách ghi việc nhanh bằng text hoặc gửi voice note.
    - `"📊 Thống kê"`: Hiển thị bảng tóm tắt tiến độ, số lượng task, kèm thanh tiến độ trực quan.
    - `"❓ Trợ giúp"`: Hiển thị help guide.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "test/tasks.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db.ts src/bot.ts test/tasks.test.ts
git commit -m "feat(ux): add persistent menu keyboard and daily stats"
```

---

### Task 3: Voice-to-Text Transcription Service (Whisper / OpenAI / Groq)

**Files:**
- Create: `src/stt.ts`
- Modify: `src/config.ts`
- Modify: `.env.example`
- Modify: `src/bot.ts`
- Create: `test/stt.test.ts`

**Interfaces:**
- Consumes: `config.stt`
- Produces: `transcribeAudio(audioBytes: Uint8Array, mimeType?: string): Promise<string>`

- [ ] **Step 1: Write test for STT helper**

Tạo `test/stt.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert";
import { parseSttResponse } from "../src/stt.ts";

test("parseSttResponse trích xuất đúng chuỗi transcription từ JSON", () => {
  assert.strictEqual(parseSttResponse({ text: "  mai 9h họp phòng kinh doanh  " }), "mai 9h họp phòng kinh doanh");
  assert.strictEqual(parseSttResponse({}), "");
  assert.strictEqual(parseSttResponse(null), "");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "test/stt.test.ts"`
Expected: FAIL (`Cannot find module ../src/stt.ts`)

- [ ] **Step 3: Implement `src/stt.ts` and integrate into `src/config.ts` and `src/bot.ts`**

- Cấu hình trong `src/config.ts`:
  ```typescript
  stt: {
    apiKey: process.env.STT_API_KEY ?? process.env.LLM_API_KEY ?? "",
    baseUrl: (process.env.STT_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.STT_MODEL ?? "whisper-1",
  }
  ```
- Trong `src/stt.ts`:
  - Hàm `transcribeAudio(audioBytes: Uint8Array, fileName: string)`:
    - Tạo `FormData`, append `file` (dùng `new Blob([audioBytes])`), `model`, `language: "vi"`.
    - Gửi `POST ${config.stt.baseUrl}/audio/transcriptions` với header `Authorization: Bearer ...`.
    - Trả về text đã clean.
- Trong `src/bot.ts`:
  - Lắng nghe `bot.on(["message:voice", "message:audio"])`.
  - Trong private chat:
    - Kiểm tra `config.stt.apiKey`: nếu thiếu, hướng dẫn user điền `STT_API_KEY` vào `.env`.
    - Lấy thông tin file: `const file = await ctx.getFile()`.
    - Tải buffer file từ `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`.
    - Gọi `transcribeAudio`.
    - Gửi tin nhắn xác nhận: `🎙 <i>"${escapeHtml(transcribed)}"</i>`.
    - Đưa vào `addNote(ctx, transcribed)` để tự động parse thời gian và tạo task!

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "test/stt.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stt.ts src/config.ts .env.example src/bot.ts test/stt.test.ts
git commit -m "feat(stt): support voice note to reminder using whisper transcription"
```

---

### Task 4: Integration Verification & Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README.md with Voice Note & Menu guide**

Mô tả:
- Hướng dẫn cấu hình `STT_API_KEY` (Groq siêu nhanh hoặc OpenAI).
- Hướng dẫn dùng phím tắt Persistent Menu.
- Hướng dẫn gửi voice note để tạo nhắc việc tự động.

- [ ] **Step 2: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document persistent menu and voice note features"
```
