# Hướng dẫn cài đặt chi tiết

Khoảng **30 phút**, **0 đồng**. Làm lần lượt từ trên xuống. Không cần biết lập trình.

> 💡 Dùng **tài khoản cá nhân** cho GitHub, Supabase và Vercel — đây là dữ liệu tài chính của gia đình bạn.

**Mục lục**
1. [Chuẩn bị](#1-chuẩn-bị)
2. [Fork repo & sửa dữ liệu ban đầu (tuỳ chọn)](#2-fork-repo--sửa-dữ-liệu-ban-đầu-tuỳ-chọn)
3. [Supabase — nơi lưu dữ liệu](#3-supabase--nơi-lưu-dữ-liệu)
4. [Telegram bot](#4-telegram-bot)
5. [Tạo các chuỗi bí mật](#5-tạo-các-chuỗi-bí-mật)
6. [Vercel — đưa app lên mạng](#6-vercel--đưa-app-lên-mạng)
7. [Kết nối Telegram & thêm thành viên](#7-kết-nối-telegram--thêm-thành-viên)
8. [Cài app lên điện thoại](#8-cài-app-lên-điện-thoại)
9. [Kiểm tra lần cuối](#9-kiểm-tra-lần-cuối)
10. [Xử lý lỗi thường gặp](#10-xử-lý-lỗi-thường-gặp)
11. [Cập nhật, sao lưu, bảo mật](#11-cập-nhật-sao-lưu-bảo-mật)

---

## 1. Chuẩn bị

| Cần | Ghi chú |
|---|---|
| Tài khoản [GitHub](https://github.com) | Để fork repo |
| Tài khoản [Supabase](https://supabase.com) | Đăng nhập bằng GitHub cho nhanh. Gói Free |
| Tài khoản [Vercel](https://vercel.com) | Đăng nhập bằng GitHub. Gói **Hobby** (miễn phí) |
| Telegram trên điện thoại | Mỗi thành viên muốn dùng bot |
| *(tuỳ chọn)* [Node.js 22+](https://nodejs.org) | Chỉ cần nếu muốn chạy thử trên máy hoặc deploy bằng dòng lệnh |

## 2. Fork repo & sửa dữ liệu ban đầu (tuỳ chọn)

1. Mở trang repo trên GitHub → bấm **Fork** (góc phải) → **Create fork**. Bạn có bản sao riêng.
2. *(Tuỳ chọn, có thể làm sau trong Supabase)*: sửa [`lib/seed.js`](../lib/seed.js) cho đúng nhà bạn — tên thành viên, danh mục & ngân sách, khoản nợ, tài sản — rồi chạy `npm run seed-sql` để tạo lại `supabase/seed.sql`.

   Nếu không quen sửa code: cứ dùng dữ liệu ví dụ, sau đó sửa trực tiếp trong Supabase (bước 3.5) — dễ như sửa Excel.

## 3. Supabase — nơi lưu dữ liệu

### 3.1 Tạo project
1. Vào **[supabase.com/dashboard](https://supabase.com/dashboard)** → **New project**.
2. Điền:
   - **Name**: `family-budget` (tuỳ ý)
   - **Database Password**: bấm *Generate a password*, lưu lại (ít khi cần dùng)
   - **Region**: **Southeast Asia (Singapore)** — gần Việt Nam nhất
3. **Create new project**, đợi 1–2 phút.

### 3.2 Tạo bảng
1. Menu trái → **SQL Editor** → **New query**.
2. Mở file [`supabase/schema.sql`](../supabase/schema.sql) trên GitHub → nút **Copy raw file** → dán vào ô → **Run** (Ctrl+Enter).
3. Thấy *Success. No rows returned* là được.

### 3.3 Nạp dữ liệu ban đầu
1. **New query** → dán toàn bộ [`supabase/seed.sql`](../supabase/seed.sql) → **Run**.
2. Chạy lại nhiều lần cũng không bị trùng.

### 3.4 Kiểm tra
Menu trái → **Table Editor**: có 8 bảng `members`, `categories`, `budget_overrides`, `debts`, `assets`, `transactions`, `app_state`, `tg_updates`. Bảng `categories` có 23 dòng, `transactions` trống.

### 3.5 Sửa cho đúng nhà bạn (làm ngay hoặc sau)
Trong **Table Editor**, bấm vào ô để sửa, **Insert → Insert row** để thêm, chuột phải → *Delete row* để xoá:
- `members`: tên thành viên (VD đổi "Bố" → "Anh Tuấn").
- `categories`: ngân sách (`budget`), từ khoá (`keywords`), icon.
- `debts`: **xoá 3 khoản ví dụ**, nhập khoản nợ thật. Xem giải thích từng cột ở [CUSTOMIZE.md](CUSTOMIZE.md#khoản-nợ).
- `assets`: tài sản thật (hoặc xoá hết nếu không cần).

### 3.6 Lấy 2 thông tin kết nối
⚙️ **Project Settings**:
- **Data API** → **Project URL**, dạng `https://abcdefghij.supabase.co` → đây là `SUPABASE_URL`. *Chỉ copy phần này, không kèm `/rest/v1`* (app cũng tự sửa nếu lỡ dán thừa).
- **API Keys** → tab **Legacy API Keys** → dòng **`service_role`** → **Reveal** → copy → đây là `SUPABASE_SERVICE_ROLE_KEY`.

> ⚠️ `service_role` có **toàn quyền** với database. Chỉ dán vào Vercel. Không gửi cho ai, không đưa lên GitHub. Đừng nhầm với key `anon`.

## 4. Telegram bot

*(Bỏ qua nếu chỉ muốn dùng web app.)*

1. Trong Telegram tìm **@BotFather** (có tích xanh ✔️) → **Start**.
2. Gửi `/newbot`.
3. Đặt **tên hiển thị**, VD: `Thu chi gia đình`.
4. Đặt **username**: chỉ chữ không dấu, số, `_`, **kết thúc bằng `bot`**, VD `thuchi_giadinh_bot`. Trùng thì thêm số.
5. BotFather trả về **token** dạng `1234567890:AAH…` → copy → đây là `TELEGRAM_TOKEN`. Giữ bí mật như mật khẩu.
6. *(Tuỳ chọn)* `/setuserpic` để đặt ảnh đại diện cho bot.

## 5. Tạo các chuỗi bí mật

Cần 3 chuỗi ngẫu nhiên, mỗi chuỗi **≥ 32 ký tự** (ngắn hơn thì app từ chối chạy phần tương ứng): `SESSION_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`.

- **Có Node.js**: chạy lệnh sau 3 lần, mỗi lần lấy 1 chuỗi:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
- **Không có Node.js**: dùng trình quản lý mật khẩu (Bitwarden, 1Password…) tạo mật khẩu 40 ký tự **chỉ gồm chữ và số** (Telegram chỉ chấp nhận chữ, số, `_`, `-` cho webhook secret).

Và tự đặt **mật khẩu gia đình** `FAMILY_PASSWORD` — **ít nhất 10 ký tự**, dễ nhớ với cả nhà nhưng khó đoán, VD 4 từ ghép: `com-chieu-ngon-lam`.

## 6. Vercel — đưa app lên mạng

### Cách A — Qua giao diện web (dễ nhất)
1. Vào **[vercel.com/new](https://vercel.com/new)** → **Import Git Repository** → chọn repo `family-budget-vn` bạn vừa fork → **Import**.
2. **Project Name**: tên này thành địa chỉ app, VD `thuchi-giadinh` → `https://thuchi-giadinh.vercel.app`.
3. **Framework Preset**: `Other`. Không cần sửa Build/Output (đã cấu hình sẵn trong `vercel.json`).
4. Mở **Environment Variables**, thêm đủ **7 biến**:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | Bước 3.6 |
   | `SUPABASE_SERVICE_ROLE_KEY` | Bước 3.6 |
   | `TELEGRAM_TOKEN` | Bước 4 (bỏ trống nếu không dùng bot) |
   | `FAMILY_PASSWORD` | Bước 5 |
   | `SESSION_SECRET` | Bước 5 — chuỗi #1 |
   | `TELEGRAM_WEBHOOK_SECRET` | Bước 5 — chuỗi #2 |
   | `CRON_SECRET` | Bước 5 — chuỗi #3 |

5. **Deploy** → đợi ~1 phút → **Visit**.

> Thêm/sửa biến sau khi đã deploy: *Project → Settings → Environment Variables* → sửa → tab *Deployments* → bản mới nhất → **⋯ → Redeploy**. Biến chỉ có hiệu lực sau khi redeploy.

### Cách B — Dòng lệnh (cho người quen terminal)
```bash
npx vercel@latest login
```
```bash
npx vercel@latest link --yes --project thuchi-giadinh
```
Thêm biến. Trên Windows chạy `powershell -ExecutionPolicy Bypass -File scriptsadd-secrets.ps1`: script tự sinh 3 chuỗi bí mật và hỏi lần lượt 4 biến còn lại. Hoặc thêm từng biến (mỗi lệnh sẽ hỏi giá trị):
```bash
npx vercel@latest env add SUPABASE_URL production
```
…lặp lại cho 7 biến, rồi deploy:
```bash
npx vercel@latest deploy --prod
```

### Cron hằng ngày
`vercel.json` đã khai báo cron `0 14 * * *` (14:00 UTC = **21:00 giờ Việt Nam**). Vercel tự gọi `/api/cron` kèm `CRON_SECRET` — không cần làm gì thêm. Gói Hobby có thể chạy lệch trong vòng 1 giờ.

## 7. Kết nối Telegram & thêm thành viên

1. Mở địa chỉ app → nhập **mật khẩu gia đình**.
2. Tab **⚙️** → **Kết nối / kết nối lại Telegram** → thấy *✅ Đã kết nối bot @…*.
3. **Mỗi thành viên** mở bot trên Telegram → **Start** (hoặc gõ `/id`). Bot trả về một dãy số — đó là *Telegram User ID*.
4. Supabase → **Table Editor → `members`** → dán ID vào cột **`tg_id`** đúng dòng tên người đó → **Save**.
5. Nhắn thử `chi ăn sáng 50k` → bot trả lời. Bấm 🗑 **Xoá** để xoá khoản thử.

## 8. Cài app lên điện thoại

- **iPhone (Safari)**: mở địa chỉ app → nút **Chia sẻ** → **Thêm vào MH chính**.
- **Android (Chrome)**: **⋮** → **Thêm vào màn hình chính** / **Cài đặt ứng dụng**.

App mở toàn màn hình như app thật, nhớ đăng nhập 30 ngày và tự gia hạn khi còn dùng.

## 9. Kiểm tra lần cuối

- [ ] Vào app được bằng mật khẩu gia đình, **không** có dải vàng "Chế độ xem thử" (nếu có → chưa nối được Supabase, xem mục 10).
- [ ] Tab **Nợ & tài sản** hiện đúng khoản nợ trong bảng `debts`.
- [ ] Gõ `chi cafe 30k` trên web → thấy trong tab **Sổ** → tải lại trang vẫn còn.
- [ ] Nhắn bot `chi cafe 30k` → bot trả lời; xoá các khoản thử.
- [ ] Tab ⚙️: webhook ✅, không có "Lỗi gần nhất".

## 10. Xử lý lỗi thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| App báo **"Máy chủ chưa cấu hình đủ…"** hoặc **"Lỗi máy chủ…"** | Vì an toàn, chi tiết lỗi không hiện trên trình duyệt. Vào *Vercel → Project → Logs* xem dòng lỗi: thiếu/ngắn biến môi trường (`FAMILY_PASSWORD` < 10 ký tự, `SESSION_SECRET` < 32 ký tự…), lỗi database… Sửa trên Vercel → **Redeploy**. |
| Log ghi **"Could not find the function public.login_attempt"** | Chưa chạy `schema.sql` (cài mới) hoặc file migration (nâng cấp từ v1.0) — xem [CHANGELOG](../CHANGELOG.md). |
| Log ghi **"Invalid path specified in request URL"** | `SUPABASE_URL` sai định dạng. Phải là `https://xxxx.supabase.co`. Sửa → Redeploy. |
| Log ghi **"Invalid API key"** / **permission denied** | Dán nhầm key `anon` thay vì `service_role`, hoặc copy thiếu ký tự. |
| Báo **relation "…" does not exist** | Chưa chạy `schema.sql` (bước 3.2). |
| App hiện dải vàng **"Chế độ xem thử"** | Thiếu `SUPABASE_URL` hoặc `SUPABASE_SERVICE_ROLE_KEY` → app đang dùng dữ liệu mẫu. Thêm biến → Redeploy. |
| Bot không trả lời | Tab ⚙️ xem webhook. Chưa kết nối → bấm *Kết nối Telegram*. Có "Lỗi gần nhất 401" → `TELEGRAM_WEBHOOK_SECRET` vừa đổi, bấm kết nối lại. |
| Bot trả lời **"🔒 chưa được cấp quyền"** | Chưa dán Telegram ID vào `members.tg_id`, hoặc dán sai dòng. |
| Bot hiểu sai danh mục | Bấm **📂 Đổi danh mục** — bot tự học từ khoá. Hoặc thêm từ khoá trong bảng `categories`. |
| **"Sai mật khẩu quá nhiều lần từ thiết bị / mạng này"** | Chống dò mật khẩu theo từng IP: đợi 15 phút, hoặc dùng mạng khác (4G). Người nhà ở mạng khác không bị ảnh hưởng. |
| Không nhận tin nhắc 21h | Chưa có thành viên nào có `tg_id`; hoặc chưa đến giờ (có thể lệch đến 22h). Xem *Vercel → Project → Cron Jobs*. |
| Supabase báo project **Paused** | 7 ngày không ai dùng. Vào Supabase bấm **Restore**. Cron hằng ngày thường giữ project luôn hoạt động. |

## 11. Cập nhật, sao lưu, bảo mật

**Cập nhật bản mới**: trên trang fork của bạn bấm **Sync fork** → Vercel tự deploy lại. Đọc [CHANGELOG.md](../CHANGELOG.md) trước: bản nào có thay đổi database sẽ kèm 1 file trong `supabase/migrations/` cần chạy trong SQL Editor (chạy lại nhiều lần cũng an toàn).

**Sao lưu**: gói Free của Supabase không cho tải bản sao lưu. Mỗi tháng vào *Table Editor → `transactions` → Export → CSV* cất vào Drive (làm tương tự với `debts`, `categories` nếu đã sửa nhiều).

**Mất điện thoại / lộ mật khẩu**: tab ⚙️ → **Đăng xuất mọi thiết bị**, rồi đổi `FAMILY_PASSWORD` trên Vercel → Redeploy. Đổi mật khẩu gia đình là mọi phiên cũ cũng tự hết hiệu lực.

**Lộ `service_role` key**: Supabase → *Project Settings → API Keys* → tạo key mới / roll → cập nhật trên Vercel → Redeploy.

**Lộ Telegram token**: nhắn @BotFather `/revoke` → chọn bot → cập nhật `TELEGRAM_TOKEN` → Redeploy → tab ⚙️ bấm *Kết nối Telegram*.
