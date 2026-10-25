# Lịch sử phiên bản

## v1.1.0 — 2026-10-25 · Bản vá bảo mật

Khuyến nghị **mọi bản đang chạy nâng cấp**. Bản vá dựa trên một bản review bảo mật độc lập toàn bộ mã nguồn (25/10/2026). Review không tìm thấy lỗ nào cho phép đọc hay sửa dữ liệu khi chưa đăng nhập; các điểm dưới đây là gia cố cửa đăng nhập, phiên và toàn vẹn dữ liệu.

### Bảo mật
- **[P1] Chống dò mật khẩu đúng nghĩa.** Giới hạn 10 lần thử / 15 phút **theo từng IP**, đếm nguyên tử trong Postgres **trước** khi so mật khẩu. Bắn hàng loạt request song song không vượt được giới hạn; người ngoài không còn khoá được cả nhà (chỉ tự khoá IP của chính họ). Toàn hệ thống quá 30 lần sai/giờ → bot Telegram cảnh báo cả nhà. Chỉ lưu bản băm của IP.
- **[P2] Phiên đăng nhập thu hồi được.** Cookie gắn với mật khẩu gia đình hiện tại (đổi `FAMILY_PASSWORD` là mọi thiết bị phải đăng nhập lại) và với "phiên bản phiên" (nút mới **Đăng xuất mọi thiết bị** ở tab ⚙️). Thời hạn 30 ngày, tự gia hạn khi còn dùng (trước đây 180 ngày cố định).
- **[P2] Không còn tải script từ CDN.** Chart.js 4.4.1 tự host trong `public/vendor/` (mã băm khớp SRI của cdnjs). Thêm `Content-Security-Policy` chặt (`script-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`…), `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
- **[P3] Kiểm tra dữ liệu ở máy chủ.** Danh mục, thành viên, khoản nợ phải có thật trong database; ghi chú ≤ 500 ký tự; số tiền 1đ – 1.000 tỷ; tham số tháng/năm/mã đúng định dạng. Thêm ràng buộc tương ứng trong Postgres. Đối tượng tra cứu theo tên do người dùng đặt không còn prototype (chặn `__proto__`, `constructor`).
- **[P3] Chống CSRF nhiều lớp.** API chỉ nhận `Content-Type: application/json`, từ chối khi `Sec-Fetch-Site` khác `same-origin` hoặc `Origin` không khớp — an toàn cả khi gắn tên miền riêng có subdomain khác.
- **[P3] Bot chỉ hoạt động trong chat riêng.** Lỡ thêm bot vào group: không ghi giao dịch, không trả báo cáo, chỉ nhắc 1 câu khi có người gọi lệnh. Nút trên tin nhắn trong group bị từ chối.
- **[P3] Phụ thuộc tái lập được.** Thêm `package-lock.json`, nâng `@supabase/supabase-js` 2.45.4 → 2.117.3 (hết advisory), bật Dependabot cho npm và GitHub Actions, ghim action CI theo SHA, CI chạy `npm ci --ignore-scripts` và `npm audit`.
- **Gia cố khác:** so `CRON_SECRET` bằng so sánh thời gian hằng; `SESSION_SECRET`, `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET` bắt buộc ≥ 32 ký tự; lỗi hệ thống/cấu hình không còn lộ chi tiết ra trình duyệt (xem trong log Vercel); địa chỉ webhook lấy từ `APP_URL` / `VERCEL_PROJECT_PRODUCTION_URL` trước header; `scripts/add-secrets.ps1` cài đủ 7 biến, tự sinh 3 chuỗi bí mật, ghim phiên bản Vercel CLI.

### Thay đổi khác
- Yêu cầu **Node.js 22+** (theo `@supabase/supabase-js` mới). Vercel mặc định Node 24 — không cần làm gì.
- Bộ test mở rộng: tái hiện từng finding (kể cả 100 lần đăng nhập song song với database trễ 80ms).

### Nâng cấp từ v1.0 (khoảng 5 phút)

1. **Cập nhật code**: trên trang fork của bạn bấm **Sync fork** (Vercel tự deploy), hoặc `git pull` rồi deploy lại.
2. **Chạy migration** trong Supabase → SQL Editor: dán toàn bộ [`supabase/migrations/2026-10-25_v1.1.0_security.sql`](supabase/migrations/2026-10-25_v1.1.0_security.sql) → **Run**. Chạy lại nhiều lần cũng an toàn.
3. **Kiểm tra độ dài secret** trên Vercel: `SESSION_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET` phải **≥ 32 ký tự**. Nếu ngắn hơn, tạo chuỗi mới (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`), cập nhật, **Redeploy**; đổi `TELEGRAM_WEBHOOK_SECRET` thì vào tab ⚙️ bấm **Kết nối lại Telegram**.
4. Mọi thiết bị sẽ phải **đăng nhập lại một lần** (định dạng cookie mới).

> Chưa chạy migration mà đã deploy code mới: đăng nhập sẽ báo lỗi máy chủ (log Vercel ghi thiếu hàm `login_attempt`). Chạy bước 2 là hết.

## v1.0.0 — 2026-10-25

Phát hành đầu tiên.
