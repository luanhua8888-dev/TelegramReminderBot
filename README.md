# Telegram Reminder Bot

Ghi note nhanh qua Telegram (hoặc Zalo), bot nhắc đúng giờ và **nhắc lại tới khi bấm ✅ Xong**.

```
Zalo "#note ..." ──┐
                   ▼
Telegram ───► parser (LLM hoặc luật) ───► SQLite ───► scheduler (30s/lần) ───► Telegram 🔔
```

## Chạy trong 5 phút

Cần Node.js ≥ 23.6 (chạy thẳng file `.ts`, có sẵn SQLite, không cần build).

1. Telegram → **@BotFather** → `/newbot` → copy token.
2. ```powershell
   npm install
   copy .env.example .env   # điền TELEGRAM_BOT_TOKEN
   npm start
   ```
3. Nhắn `/id` cho bot, điền số đó vào `ALLOWED_CHAT_IDS` trong `.env`, rồi khởi động lại bot.

## Dùng

Gõ tin nhắn bình thường:

| Gõ | Hiểu là |
|---|---|
| `mai 9h gọi khách A` | 09:00 ngày mai |
| `30p nữa uống thuốc` | 30 phút nữa |
| `3h chiều nộp báo cáo` | 15:00 (đã qua thì sang ngày mai) |
| `thứ 6 tuần sau review` | thứ 6 của tuần sau, 09:00 |
| `25/12 mua quà` | 09:00 ngày 25/12 |
| `mỗi ngày 7h tập thể dục` | lặp hằng ngày |
| `mua sữa` | không có giờ: lưu vào inbox, hoặc AI tự xếp giờ nếu đã bật LLM |

Khi tới giờ, tin nhắc có các nút ✅ Xong · ⏰ +15p · ⏰ +1h · 🌙 Tối nay · 📅 Mai.
Chưa bấm thì bot nhắc lại mỗi 15 phút, tối đa 6 lần. Mỗi sáng 7h bot gửi tóm tắt việc trong ngày kèm inbox.

Lệnh: `/list`, `/today`, `/move 12 mai 10h`, `/done 12`, `/del 12`.

## Bật AI tự xếp lịch

Điền `LLM_MODEL` (+ `LLM_API_KEY`) trong `.env`. Dùng được mọi endpoint kiểu OpenAI: OpenAI, OpenRouter, hoặc Ollama chạy local (miễn phí).
AI được gửi kèm danh sách việc đã có lịch, nên với câu không có giờ nó sẽ chọn khung trống trong `WORK_START_HOUR`–`WORK_END_HOUR`.
Khi AI lỗi, bot tự quay về parser luật.

## Bridge Zalo

⚠️ Dùng [zca-js](https://github.com/RFS-ADRENO/zca-js), một thư viện **không chính thức**. Zalo có thể khoá tài khoản, nên dùng nick phụ.

1. `ZALO_ENABLED=1` trong `.env`, khởi động lại.
2. Bot gửi mã QR vào Telegram (đồng thời lưu ở `data/zalo-qr.png`). Quét bằng app Zalo.
3. Trên Zalo, nhắn `#note mai 9h gọi khách` ở bất kỳ đâu, ví dụ "Cloud của tôi". Việc sẽ xuất hiện trên Telegram.

Phiên đăng nhập được lưu trong `data/zalo-credentials.json`. **Không commit file này.**

## Chạy ngầm trên Windows (miễn phí)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\autostart.ps1 install    # tự chạy mỗi khi đăng nhập + chạy ngay
powershell -ExecutionPolicy Bypass -File scripts\autostart.ps1 status     # đang chạy không + log
powershell -ExecutionPolicy Bypass -File scripts\autostart.ps1 stop       # tắt (cũng dùng start để bật lại sau khi sửa .env)
powershell -ExecutionPolicy Bypass -File scripts\autostart.ps1 uninstall  # gỡ
```

Bot chạy ẩn, không có cửa sổ. Crash thì 10 giây sau tự chạy lại. Log nằm ở `data\bot.log`.
Máy ngủ hoặc tắt thì không nhắc; khi máy bật lại, các việc đã quá giờ sẽ được nhắc ngay.

## Chạy 24/7

Muốn nhắc cả khi tắt máy thì dùng VPS, Raspberry Pi hoặc máy luôn bật:

```bash
npm i -g pm2
pm2 start "npm start" --name reminder
pm2 save
```

## Dev

```bash
npm test          # test parser + logic nhắc
npm run typecheck
npm run dev       # tự restart khi sửa code
```
