# Đóng góp cho Family Budget VN

Cảm ơn bạn muốn cùng hoàn thiện tool! Mọi đóng góp — báo lỗi, đề xuất tính năng, sửa tài liệu, viết code — đều được chào đón.

*English: Contributions are welcome. Fork → branch → Pull Request; `npm test` must pass; every PR is reviewed and merged by the maintainer. Issues and PRs may be written in English or Vietnamese.*

---

## Cách đóng góp nhanh

| Bạn muốn… | Làm gì |
|---|---|
| Báo lỗi | [Mở Issue → "Báo lỗi"](../../issues/new/choose) — mô tả cách tái hiện, ảnh chụp màn hình (**che số liệu thật**). |
| Đề xuất tính năng | [Mở Issue → "Đề xuất tính năng"](../../issues/new/choose) — mô tả *vấn đề gia đình bạn gặp*, không chỉ giải pháp. |
| Báo lỗ hổng bảo mật | **Không** mở Issue công khai. Xem [SECURITY.md](SECURITY.md). |
| Sửa code / tài liệu | Làm theo quy trình bên dưới. Với thay đổi lớn, hãy mở Issue trao đổi trước để tránh làm phí công. |

Issue có nhãn **`good first issue`** phù hợp cho người mới.

## Quy trình gửi Pull Request

1. **Fork** repo về tài khoản của bạn, clone về máy.
2. Tạo nhánh mới từ `main`: `git checkout -b sua-loi-ngay-thang` (tên ngắn, mô tả việc).
3. Sửa code. Chạy thử: `npm run dev` → http://localhost:3000 (mật khẩu `demo`).
4. **Chạy kiểm tra** (bắt buộc, giống hệt CI):
   ```bash
   npm test
   ```
   ```bash
   npm run check
   ```
5. Commit với mô tả rõ ràng (tiếng Việt hoặc tiếng Anh), push lên fork, mở **Pull Request** vào `main`.
6. CI tự chạy. Maintainer sẽ review, có thể góp ý / yêu cầu sửa. Khi được duyệt, maintainer sẽ **squash merge**.

> Nhánh `main` được bảo vệ: không ai đẩy thẳng được; mọi thay đổi phải qua Pull Request, CI xanh và được maintainer duyệt.

## Nguyên tắc của dự án

Những nguyên tắc này giúp tool luôn **đơn giản, riêng tư, dễ tự host** — PR đi ngược sẽ khó được nhận:

1. **Không framework, không build step.** Giao diện là HTML/CSS/JS thuần trong `public/`; máy chủ là Vercel Functions trong `api/`.
2. **Hạn chế dependency.** Hiện chỉ có `@supabase/supabase-js`. Thêm thư viện mới cần lý do rõ ràng.
3. **Dữ liệu thuộc về người dùng.** Không gửi dữ liệu ra dịch vụ bên thứ ba, không analytics, không tracking.
4. **Không đưa dữ liệu thật vào repo.** Ví dụ, ảnh chụp, dữ liệu test chỉ dùng số liệu bịa (gia đình mẫu "Bố, Mẹ, Bé"). CI có bước quét chặn token/key.
5. **Tiếng Việt là ngôn ngữ chính** của giao diện và tài liệu; code và tên biến dùng tiếng Anh hoặc tiếng Việt không dấu như hiện tại.
6. **Bộ hiểu câu dùng chung** (`public/js/shared.js`) chạy cả trình duyệt lẫn máy chủ — không import thư viện Node vào file này.
7. **Thay đổi database** (sửa `supabase/schema.sql`) phải tương thích ngược hoặc kèm đoạn SQL migration và ghi chú trong PR để người đang dùng nâng cấp được.

## Viết test

- Bộ test ở `scripts/test.js`, chạy với dữ liệu trong bộ nhớ và Telegram giả lập — không cần mạng hay tài khoản.
- Sửa lỗi → thêm 1 bài test tái hiện lỗi đó. Thêm tính năng → thêm test cho luồng chính.
- Logic báo cáo (`lib/report.js`) và parser (`public/js/shared.js`) là hàm thuần, rất dễ test.

## Cấu trúc code

Xem mục *Cấu trúc code* trong [README](README.md#cấu-trúc-code) và giải thích luồng hoạt động trong [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md).

## Giấy phép

Khi gửi đóng góp, bạn đồng ý đóng góp đó được phát hành theo [giấy phép MIT](LICENSE) của dự án.
