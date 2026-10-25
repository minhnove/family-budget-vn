# Chính sách bảo mật

Family Budget VN lưu dữ liệu tài chính gia đình, nên bảo mật được ưu tiên hàng đầu.

## Báo lỗ hổng

**Vui lòng không mở Issue công khai cho lỗ hổng bảo mật.**

Báo riêng qua GitHub: tab **Security → [Report a vulnerability](../../security/advisories/new)**. Chỉ maintainer thấy báo cáo này.

Hãy ghi:
- Lỗ hổng là gì, ảnh hưởng thế nào (VD đọc được dữ liệu không cần mật khẩu).
- Các bước tái hiện (dùng chế độ xem thử `npm run dev` hoặc bản tự host của chính bạn — **không thử trên bản của người khác**).
- Đề xuất cách sửa nếu có.

Maintainer sẽ phản hồi trong vòng **7 ngày**, sửa và công bố bản vá trước khi công khai chi tiết lỗ hổng. Người báo cáo sẽ được ghi nhận (nếu muốn).

## Phạm vi

Trong phạm vi: code trong repo này — xác thực (`lib/auth.js`), API (`api/`), webhook Telegram, cron, truy cập database, xử lý dữ liệu đầu vào, XSS trên giao diện.

Ngoài phạm vi: lỗ hổng của Vercel / Supabase / Telegram; cấu hình sai của người tự host (VD đặt mật khẩu yếu, lộ `service_role` key).

## Phiên bản được hỗ trợ

Chỉ nhánh `main` mới nhất. Người tự host nên **Sync fork** thường xuyên để nhận bản vá.

## Khuyến nghị cho người tự host

- `FAMILY_PASSWORD` dài ≥ 10 ký tự; `SESSION_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET` là chuỗi ngẫu nhiên ≥ 32 ký tự.
- **Không bao giờ** commit file `.env` hay dán `SUPABASE_SERVICE_ROLE_KEY` vào code, Issue, ảnh chụp.
- Lộ key/token: làm theo mục *Cập nhật, sao lưu, bảo mật* trong [docs/SETUP.md](docs/SETUP.md#11-cập-nhật-sao-lưu-bảo-mật).
