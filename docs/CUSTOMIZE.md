# Cá nhân hoá theo nhà bạn

Hầu hết mọi thứ sửa trong **Supabase → Table Editor** (giống sửa Excel), **tải lại app là thấy** — không cần deploy lại. Vài thứ thuộc về giao diện (tên app, ngưỡng cảnh báo, giờ nhắc) thì sửa code rồi deploy.

| Muốn đổi | Sửa ở đâu | Cần deploy lại? |
|---|---|---|
| Thành viên, Telegram ID | Bảng `members` | Không |
| Danh mục, ngân sách, từ khoá, icon | Bảng `categories` | Không |
| Ngân sách riêng 1 tháng | Bảng `budget_overrides` | Không |
| Khoản nợ, lãi suất, lịch trả lãi năm | Bảng `debts` | Không |
| Tài sản, giá vàng | Bảng `assets` | Không |
| Tắt tin nhắc "hôm nay chưa ghi" | Bảng `app_state` | Không |
| Tên app, ngưỡng cảnh báo, múi giờ | `public/js/shared.js`, `public/manifest.webmanifest` | Có |
| Giờ chạy nhắc tự động | `vercel.json` | Có |
| Mật khẩu gia đình | Biến `FAMILY_PASSWORD` trên Vercel | Có (Redeploy) |

---

## Thành viên

Bảng **`members`**: mỗi dòng 1 người hoặc 1 "nhóm chi" (VD *Chung* cho chi tiêu chung, *Bé* cho con).

| Cột | Ý nghĩa |
|---|---|
| `name` | Tên hiển thị. Khi gõ `#mẹ`, `#lan` hay `#melan` đều khớp người tên "Mẹ Lan" (khớp cả tên đầy đủ viết liền hoặc từng chữ, không phân biệt dấu). |
| `tg_id` | Telegram User ID (nhắn `/id` cho bot). Có ID → người đó dùng được bot và nhận tin nhắc. Để trống → chỉ dùng làm "người được ghi cho". |
| `sort` | Thứ tự hiển thị. |

## Danh mục

Bảng **`categories`**:

| Cột | Ý nghĩa |
|---|---|
| `type` | `Chi`, `Thu`, `Trả nợ`, `Vay`, `Cho vay`, `Thu hồi nợ` |
| `name` | Tên danh mục (không trùng trong cùng 1 loại) |
| `grp` | Nhóm để xem tổng: *Thiết yếu*, *Linh hoạt*, *Gia đình*, *Theo năm*… tuỳ bạn |
| `budget` | **Chi**: ngân sách mỗi tháng (đồng). **Thu**: thu nhập *kế hoạch* mỗi tháng — hết tháng mà thu thấp hơn 90% kế hoạch thì báo cáo sẽ cảnh báo. `0` = không đặt. |
| `budget_year` | > 0 = **khoản theo năm** (bảo hiểm, du lịch, học phí năm…): so luỹ kế từ đầu năm với số này và **không** tính vào ngân sách tháng. |
| `keywords` | Từ khoá để tự nhận danh mục, cách nhau dấu phẩy. |
| `icon` | 1 emoji hiện trên lưới chọn danh mục, VD `🛒`. |
| `sort` | Thứ tự trên lưới icon. |

> Loại `Trả nợ` cần đúng 2 danh mục tên **`Gốc`** và **`Lãi`** — đừng đổi tên 2 dòng này.

### Viết từ khoá sao cho app đoán đúng

- **Không cần dấu**: app bỏ dấu khi so khớp, `xăng` = `xang`.
- **Khớp theo cả từ**: `cá` khớp "mua cá" nhưng không khớp "cafe".
- **Danh mục khớp nhiều từ khoá nhất thắng**: "sữa cho con" khớp `sữa` + `con` của *Con cái*.
- **Tránh từ quá ngắn, dễ trùng khi bỏ dấu**: `bé`/`be`, `nội`/`nồi`, `chợ`/`cho`, `trà`/`trả`. Dùng cụm dài hơn: `đi chợ`, `bà nội`, `trà sữa`.
- **Để app tự học**: khi app đoán sai, bấm icon đúng (web) hoặc *📂 Đổi danh mục* (bot). Nếu ghi chú ngắn (1–2 từ), bot tự thêm nó vào từ khoá.

### Ngân sách riêng cho 1 tháng

Bảng **`budget_overrides`**: `month` = `2027-01`, `category` = `Hiếu hỉ & quà`, `budget` = `10000000` → tháng 1/2027 dùng 10tr thay cho mức mặc định.

## Khoản nợ

Bảng **`debts`**:

| Cột | Ý nghĩa |
|---|---|
| `code` | Mã ngắn, không dấu, không trùng, VD `NH-NHA`. Giao dịch gắn vào khoản nợ qua mã này. |
| `name`, `creditor` | Tên khoản nợ, chủ nợ — cũng dùng làm từ khoá. |
| `initial` | **Dư nợ tại ngày bắt đầu theo dõi** (không phải số vay ban đầu nếu đã trả bớt). |
| `start_date` | Ngày bắt đầu theo dõi. Chỉ giao dịch từ ngày này trở đi mới trừ vào `initial`. Để trống = tính mọi giao dịch. |
| `rate` | Lãi suất %/năm hiện hành (đổi lãi suất thì sửa số này). |
| `min_pay` | Số phải trả tối thiểu/tháng → báo cáo của tháng đã qua đánh dấu đỏ nếu trả chưa đủ; cũng dùng để ước tính ngày hết nợ khi chưa có lịch sử trả. |
| `keywords` | Từ khoá để nhận ra khoản nợ khi gõ `trả nợ ngân hàng 10tr`. |
| `status` | `Đang trả` / `Đã tất toán` (khoản đã tất toán không hiện để chọn khi nhập). |
| `interest_cycle` | `Tháng` (lãi trả hằng tháng) hoặc `Năm` (lãi trả 1 lần/năm). |
| `next_due`, `next_amount` | Chỉ cho khoản `Năm`: hạn trả lãi tiếp theo và số lãi kỳ đó (để trống = dư nợ × lãi suất). Khi bạn ghi `trả lãi …` trong khoảng ±45 ngày quanh hạn, app **tự chuyển sang hạn năm sau** — không cần sửa bảng mỗi năm. |

**Khoản trả góp cố định** (VD trả góp 5tr/tháng trong 12 tháng, lãi đã tính sẵn trong kỳ): đặt `initial` = tổng số tiền còn phải trả, `rate` = 0, `min_pay` = số trả mỗi kỳ, và mỗi kỳ ghi `trả nợ <từ khoá> 5tr`.

**Ghi bù khoản đã trả trước đó**: gõ kèm ngày, VD `20/2 trả nợ ngân hàng 10tr #mẹ`. Với khoản nợ chưa có trong bảng, thêm dòng vào `debts` trước (`start_date` sớm hơn ngày trả).

## Tài sản

Bảng **`assets`** → tab *Nợ & tài sản* tính **tài sản ròng = tài sản (included) − tổng dư nợ**.

| Cột | Ý nghĩa |
|---|---|
| `type` | `Bất động sản`, `Vàng`, `Tiền mặt & tiết kiệm`, `Phải thu`, `Khác` |
| `qty`, `unit`, `price` | Có cả `qty` và `price` → giá trị = qty × price (VD 5 chỉ × 8.000.000). Đổi giá vàng: sửa `price`. |
| `value` | Giá trị cố định khi không dùng qty × price. |
| `included` | `false` = hiển thị nhưng không tính vào tài sản ròng (VD vàng để dành riêng cho con). |
| `updated` | Ngày cập nhật. Với loại **`Phải thu`**: app tự cộng các giao dịch *Cho vay* và trừ *Thu hồi nợ* phát sinh **sau** ngày này. |

## Tin nhắc tự động

- Tắt nhắc "hôm nay chưa ghi khoản nào": bảng `app_state` → **Insert row** → `key` = `daily_remind`, `value` = `"off"` (có dấu ngoặc kép).
- Đổi **giờ chạy**: sửa `vercel.json` → `"schedule": "0 14 * * *"` là 14:00 **UTC** = 21:00 Việt Nam. VD 20:00 VN → `0 13 * * *`. Gói Hobby chỉ cho 1 lần/ngày.
- Các mốc nhắc hạn trả lãi năm: `INTEREST_REMIND_DAYS` trong `public/js/shared.js` (mặc định 30, 14, 7, 3, 1, 0 ngày).

## Ngưỡng cảnh báo & cách tính

Trong [`public/js/shared.js`](../public/js/shared.js):

| Hằng số | Mặc định | Ý nghĩa |
|---|---|---|
| `WARN_PCT` | `0.8` | Danh mục dùng ≥ 80% ngân sách → 🟡 |
| `PACE_PCT` | `1.1` | Dự phóng cuối tháng > 110% ngân sách → 🟡 "chi nhanh" |
| `BASELINE_MONTHS` | `3` | Số tháng trước dùng làm mốc so sánh |
| `TZ` | `Asia/Ho_Chi_Minh` | Múi giờ tính "hôm nay", "tháng này" |

## Tên app, icon, màu

- **Tên**: `APP_NAME` trong `public/js/shared.js` (tiêu đề, màn đăng nhập) **và** `name`/`short_name` trong `public/manifest.webmanifest` (tên khi cài lên màn hình chính).
- **Icon**: thay `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`.
- **Màu chủ đạo**: biến `--accent` đầu file `public/styles.css` và `theme_color` trong manifest.

## Thêm thành viên / thiết bị mới

1. Thêm dòng vào `members` (hoặc dùng dòng có sẵn).
2. Người đó nhắn `/id` cho bot → dán vào `tg_id`.
3. Gửi họ địa chỉ app + mật khẩu gia đình (qua tin nhắn riêng).
