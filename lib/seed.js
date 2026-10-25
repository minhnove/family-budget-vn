/**
 * DỮ LIỆU VÍ DỤ — một gia đình mẫu "Bố, Mẹ, Bé". Hãy sửa cho đúng nhà bạn!
 *
 * Dùng cho 2 việc:
 *  1. Tạo file supabase/seed.sql (npm run seed-sql) để nạp vào Supabase lần đầu.
 *  2. Chế độ xem thử (chạy local hoặc deploy khi chưa nối Supabase).
 *
 * Sau khi nạp vào Supabase, mọi chỉnh sửa làm trực tiếp trong Supabase → Table Editor.
 * Ngày tháng tính tương đối theo hôm nay để dữ liệu mẫu luôn "mới".
 */
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const inDays = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); };

export const SEED = {
  // Tên thành viên dùng để ghi "ai chi". Gõ #mẹ, #bé... khi nhập để ghi cho người khác.
  // tg_id: Telegram User ID — nhắn /id cho bot để lấy.
  members: [
    { name: 'Bố', tg_id: null, note: 'Đổi tên tuỳ ý', sort: 1 },
    { name: 'Mẹ', tg_id: null, note: null, sort: 2 },
    { name: 'Bé', tg_id: null, note: 'Chi tiêu cho con — gõ #bé', sort: 3 },
    { name: 'Chung', tg_id: null, note: 'Chi tiêu chung của gia đình', sort: 4 },
  ],

  // type: Chi / Thu / Trả nợ / Vay / Cho vay / Thu hồi nợ
  // budget: Chi = ngân sách/tháng · Thu = thu nhập kế hoạch/tháng
  // budget_year > 0: khoản theo năm (không tính vào ngân sách tháng)
  // keywords: từ khoá để tự nhận danh mục khi gõ "chi xăng 100k"
  categories: [
    { type: 'Chi', name: 'Đi chợ & ăn ở nhà', grp: 'Thiết yếu', budget: 5500000, keywords: 'đi chợ, ra chợ, siêu thị, winmart, bách hoá xanh, coopmart, gạo, thịt, cá, rau, trứng, hoa quả, trái cây, đồ ăn', budget_year: 0, icon: '🛒' },
    { type: 'Chi', name: 'Ăn ngoài', grp: 'Linh hoạt', budget: 1800000, keywords: 'ăn sáng, ăn trưa, ăn tối, ăn ngoài, nhà hàng, quán, bún, phở, cơm, lẩu, nướng, bánh mì, grabfood, shopeefood', budget_year: 0, icon: '🍜' },
    { type: 'Chi', name: 'Cafe', grp: 'Linh hoạt', budget: 800000, keywords: 'cafe, cà phê, cf, trà sữa, trà đá, highlands, starbucks, phúc long, katinat, sinh tố', budget_year: 0, icon: '☕' },
    { type: 'Chi', name: 'Nhà cửa & hoá đơn', grp: 'Thiết yếu', budget: 2500000, keywords: 'điện, tiền điện, nước, tiền nước, internet, wifi, mạng, gas, phí quản lý, tiền nhà, thuê nhà, điện thoại, nạp thẻ', budget_year: 0, icon: '🏠' },
    { type: 'Chi', name: 'Đi lại', grp: 'Thiết yếu', budget: 1200000, keywords: 'xăng, grab, taxi, xanh sm, gửi xe, vé xe, sửa xe, bảo dưỡng, rửa xe', budget_year: 0, icon: '🛵' },
    { type: 'Chi', name: 'Con cái', grp: 'Thiết yếu', budget: 4000000, keywords: 'sữa, bỉm, tã, học phí, trường, mầm non, đồ chơi, quần áo con, vaccine, tiêm, bé, con', budget_year: 0, icon: '👶' },
    { type: 'Chi', name: 'Sức khoẻ', grp: 'Thiết yếu', budget: 800000, keywords: 'thuốc, khám, bệnh viện, nha khoa', budget_year: 0, icon: '💊' },
    { type: 'Chi', name: 'Biếu bố mẹ', grp: 'Gia đình', budget: 2500000, keywords: 'biếu, ông bà, bà nội, bà ngoại, ông nội, ông ngoại, gửi bà, gửi ông', budget_year: 0, icon: '👵' },
    { type: 'Chi', name: 'Hiếu hỉ & quà', grp: 'Linh hoạt', budget: 800000, keywords: 'đám cưới, đám ma, đám hiếu, mừng, sinh nhật, quà', budget_year: 0, icon: '🎁' },
    { type: 'Chi', name: 'Mua sắm', grp: 'Linh hoạt', budget: 1200000, keywords: 'shopee, lazada, tiki, tiktok shop, quần áo, giày, mỹ phẩm, gia dụng', budget_year: 0, icon: '🛍️' },
    { type: 'Chi', name: 'Giải trí', grp: 'Linh hoạt', budget: 500000, keywords: 'phim, netflix, spotify, youtube, game', budget_year: 0, icon: '🎬' },
    { type: 'Chi', name: 'Khác', grp: 'Linh hoạt', budget: 700000, keywords: '', budget_year: 0, icon: '📦' },
    // Khoản theo năm: so luỹ kế từ đầu năm với ngân sách năm
    { type: 'Chi', name: 'Bảo hiểm', grp: 'Theo năm', budget: 0, keywords: 'bảo hiểm, bhnt, nhân thọ', budget_year: 10000000, icon: '🛡️' },
    { type: 'Chi', name: 'Du lịch', grp: 'Theo năm', budget: 0, keywords: 'du lịch, khách sạn, vé máy bay, homestay, resort', budget_year: 15000000, icon: '✈️' },
    // Thu: cột budget = thu nhập kế hoạch mỗi tháng (cả nhà)
    { type: 'Thu', name: 'Lương', grp: null, budget: 40000000, keywords: 'lương', budget_year: 0, icon: '💼' },
    { type: 'Thu', name: 'Thưởng', grp: null, budget: 0, keywords: 'thưởng, bonus', budget_year: 0, icon: '🎉' },
    { type: 'Thu', name: 'Thu nhập phụ', grp: null, budget: 0, keywords: 'freelance, hoa hồng, commission, kinh doanh, bán hàng', budget_year: 0, icon: '💡' },
    { type: 'Thu', name: 'Khác', grp: null, budget: 0, keywords: '', budget_year: 0, icon: '💰' },
    { type: 'Trả nợ', name: 'Gốc', grp: null, budget: 0, keywords: 'gốc', budget_year: 0, icon: '🏦' },
    { type: 'Trả nợ', name: 'Lãi', grp: null, budget: 0, keywords: 'lãi', budget_year: 0, icon: '📈' },
    { type: 'Vay', name: 'Vay', grp: null, budget: 0, keywords: '', budget_year: 0, icon: '🤝' },
    { type: 'Cho vay', name: 'Cho vay', grp: null, budget: 0, keywords: '', budget_year: 0, icon: '📤' },
    { type: 'Thu hồi nợ', name: 'Thu hồi', grp: null, budget: 0, keywords: '', budget_year: 0, icon: '📥' },
  ].map((c, i) => ({ ...c, sort: i + 1 })),

  // initial: dư nợ tại ngày bắt đầu theo dõi (start_date; để trống = tính mọi giao dịch)
  // interest_cycle: 'Tháng' (trả lãi hằng tháng) | 'Năm' (trả lãi 1 lần/năm, khai báo next_due + next_amount)
  debts: [
    { code: 'NH-NHA', name: 'Vay mua nhà (ngân hàng)', creditor: 'Ngân hàng', initial: 500000000, start_date: null, rate: 8.5, min_pay: 10000000,
      keywords: 'ngân hàng, bank, vay nhà', status: 'Đang trả', note: 'VÍ DỤ — sửa theo hợp đồng thật', interest_cycle: 'Tháng', next_due: null, next_amount: null, sort: 1 },
    { code: 'NGUOI-THAN', name: 'Vay người thân', creditor: 'Người thân', initial: 100000000, start_date: null, rate: 5, min_pay: 0,
      keywords: 'người thân, chú, bác', status: 'Đang trả', note: 'VÍ DỤ — trả lãi 1 lần/năm', interest_cycle: 'Năm', next_due: inDays(75), next_amount: 5000000, sort: 2 },
    { code: 'BAN-BE', name: 'Vay bạn bè', creditor: 'Bạn bè', initial: 30000000, start_date: null, rate: 0, min_pay: 0,
      keywords: 'bạn bè, bạn', status: 'Đang trả', note: 'VÍ DỤ — không lãi', interest_cycle: 'Tháng', next_due: null, next_amount: null, sort: 3 },
  ],

  // Có qty + price thì giá trị = qty × price (VD vàng: số chỉ × giá 1 chỉ). included=false: không tính vào tài sản ròng.
  // Loại "Phải thu" tự cộng giao dịch Cho vay / trừ Thu hồi nợ phát sinh sau ngày cập nhật.
  assets: [
    { name: 'Nhà / căn hộ', type: 'Bất động sản', qty: null, unit: null, price: null, value: 2000000000, included: true, updated: inDays(0), note: 'VÍ DỤ — giá ước tính', sort: 1 },
    { name: 'Vàng', type: 'Vàng', qty: 5, unit: 'chỉ', price: 8000000, value: null, included: true, updated: inDays(0), note: 'Sửa cột price khi giá vàng đổi', sort: 2 },
    { name: 'Tiết kiệm', type: 'Tiền mặt & tiết kiệm', qty: null, unit: null, price: null, value: 50000000, included: true, updated: inDays(0), note: null, sort: 3 },
    { name: 'Đang cho vay', type: 'Phải thu', qty: null, unit: null, price: null, value: 10000000, included: true, updated: inDays(0), note: 'Tự cộng/trừ theo giao dịch Cho vay / Thu hồi nợ', sort: 4 },
  ],
};
