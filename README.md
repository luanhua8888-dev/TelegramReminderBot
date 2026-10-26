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
| `cuối tuần dọn nhà` | thứ 7 tới, 09:00 |
| `đầu tháng sau đóng tiền điện` | 09:00 ngày 1 tháng sau |
| `gọi chị Mai` | "Mai" là tên người, không phải "ngày mai" |
| `mua sữa` | không có giờ: tự xếp vào khung trống sớm nhất (tắt bằng `AUTO_SCHEDULE=0`) |

Khi tới giờ, tin nhắc có các nút ✅ Xong · ⏰ +15p · ⏰ +1h · 🌙 Tối nay · 📅 Mai.
Chưa bấm thì bot nhắc lại mỗi 15 phút, tối đa 6 lần. Mỗi sáng 7h bot gửi tóm tắt việc trong ngày kèm inbox.

Lệnh: `/list`, `/today`, `/move 12 mai 10h`, `/done 12`, `/del 12`.

## Cho người khác dùng (duyệt bởi host)

Đặt `OWNER_CHAT_ID` (host) trong `.env`. Người mới nhắn bot → host nhận tin "X muốn dùng bot" với nút ✅ Duyệt / ❌ Từ chối.
Được duyệt thì họ dùng ngay, mỗi người một danh sách việc riêng. Host quản lý bằng `/users`, `/approve <id>`, `/revoke <id>`.

- `ALLOWED_CHAT_IDS`: những chat luôn được dùng, không cần duyệt.
- Để trống cả hai biến = ai cũng dùng được.
- Người không phải host bị giới hạn 200 việc chưa xong và 20 note/phút (`MAX_PENDING_PER_CHAT`, `MAX_NOTES_PER_MINUTE`).
- Trong nhóm chat, bot chỉ nhận `/add`, không biến tin nhắn thường thành việc.
- Bridge Zalo chỉ gửi về host.

## Tự xếp lịch và AI

Thứ tự xử lý một note: **parser luật** (nhanh, có test) → nếu không thấy giờ và đã bật AI thì hỏi **AI** → vẫn không có giờ thì
**tự xếp** vào khung trống sớm nhất trong `WORK_START_HOUR`–`WORK_END_HOUR`, cách việc khác ít nhất 30 phút. Phần tự xếp là code, không cần AI.

AI là tuỳ chọn: điền `LLM_MODEL` (+ `LLM_API_KEY`) trong `.env`, dùng được mọi endpoint kiểu OpenAI.
Đã thử `qwen2.5:3b` qua Ollama trên máy không có GPU: 3–7 giây mỗi câu và không nhận ra thêm cách nói nào so với luật, nên đang tắt.
Model lớn hơn (qua API trả phí) sẽ đáng dùng hơn.

## Bridge Zalo

⚠️ Dùng [zca-js](https://github.com/RFS-ADRENO/zca-js), một thư viện **không chính thức**. Zalo có thể khoá tài khoản, nên dùng nick phụ.

1. `ZALO_ENABLED=1` trong `.env`, khởi động lại.
2. Gõ `/zalo` cho bot: bot gửi mã QR vào Telegram (đồng thời lưu ở `data/zalo-qr.png`). Quét bằng app Zalo.
   Mã hết hạn 3 lần liên tiếp thì bot dừng, gõ `/zalo` lại khi sẵn sàng.
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
