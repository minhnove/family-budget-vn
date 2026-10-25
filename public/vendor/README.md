# Thư viện bên thứ ba (tự host)

Tự host thay vì tải từ CDN: không phụ thuộc runtime vào bên thứ ba, và chạy được với CSP `script-src 'self'`.

| File | Nguồn | Phiên bản | Giấy phép | SHA-512 |
|---|---|---|---|---|
| `chart.umd.js` | npm `chart.js@4.4.1` → `dist/chart.umd.js` | 4.4.1 | MIT | `ZwR1/gSZM3ai6vCdI+LVF1zSq/5HznD3ZSTk7kajkaj4D292NLuduDCO1c/NT8Id+jE58KYLKT7hXnbtryGmMg==` (khớp SRI cdnjs) |

Nâng cấp: `npm pack chart.js@<phiên bản>`, chép `package/dist/chart.umd.js` vào đây, đối chiếu mã băm với SRI trên cdnjs, cập nhật bảng này.
