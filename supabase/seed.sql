-- Dữ liệu ban đầu (tạo tự động từ lib/seed.js). Chạy SAU schema.sql. Chạy lại nhiều lần cũng không bị trùng.

insert into members (name, tg_id, note, sort) values
  ('Bố', null, 'Đổi tên tuỳ ý', 1),
  ('Mẹ', null, null, 2),
  ('Bé', null, 'Chi tiêu cho con — gõ #bé', 3),
  ('Chung', null, 'Chi tiêu chung của gia đình', 4)
on conflict (name) do nothing;

insert into categories (type, name, grp, budget, keywords, budget_year, icon, sort) values
  ('Chi', 'Đi chợ & ăn ở nhà', 'Thiết yếu', 5500000, 'đi chợ, ra chợ, siêu thị, winmart, bách hoá xanh, coopmart, gạo, thịt, cá, rau, trứng, hoa quả, trái cây, đồ ăn', 0, '🛒', 1),
  ('Chi', 'Ăn ngoài', 'Linh hoạt', 1800000, 'ăn sáng, ăn trưa, ăn tối, ăn ngoài, nhà hàng, quán, bún, phở, cơm, lẩu, nướng, bánh mì, grabfood, shopeefood', 0, '🍜', 2),
  ('Chi', 'Cafe', 'Linh hoạt', 800000, 'cafe, cà phê, cf, trà sữa, trà đá, highlands, starbucks, phúc long, katinat, sinh tố', 0, '☕', 3),
  ('Chi', 'Nhà cửa & hoá đơn', 'Thiết yếu', 2500000, 'điện, tiền điện, nước, tiền nước, internet, wifi, mạng, gas, phí quản lý, tiền nhà, thuê nhà, điện thoại, nạp thẻ', 0, '🏠', 4),
  ('Chi', 'Đi lại', 'Thiết yếu', 1200000, 'xăng, grab, taxi, xanh sm, gửi xe, vé xe, sửa xe, bảo dưỡng, rửa xe', 0, '🛵', 5),
  ('Chi', 'Con cái', 'Thiết yếu', 4000000, 'sữa, bỉm, tã, học phí, trường, mầm non, đồ chơi, quần áo con, vaccine, tiêm, bé, con', 0, '👶', 6),
  ('Chi', 'Sức khoẻ', 'Thiết yếu', 800000, 'thuốc, khám, bệnh viện, nha khoa', 0, '💊', 7),
  ('Chi', 'Biếu bố mẹ', 'Gia đình', 2500000, 'biếu, ông bà, bà nội, bà ngoại, ông nội, ông ngoại, gửi bà, gửi ông', 0, '👵', 8),
  ('Chi', 'Hiếu hỉ & quà', 'Linh hoạt', 800000, 'đám cưới, đám ma, đám hiếu, mừng, sinh nhật, quà', 0, '🎁', 9),
  ('Chi', 'Mua sắm', 'Linh hoạt', 1200000, 'shopee, lazada, tiki, tiktok shop, quần áo, giày, mỹ phẩm, gia dụng', 0, '🛍️', 10),
  ('Chi', 'Giải trí', 'Linh hoạt', 500000, 'phim, netflix, spotify, youtube, game', 0, '🎬', 11),
  ('Chi', 'Khác', 'Linh hoạt', 700000, '', 0, '📦', 12),
  ('Chi', 'Bảo hiểm', 'Theo năm', 0, 'bảo hiểm, bhnt, nhân thọ', 10000000, '🛡️', 13),
  ('Chi', 'Du lịch', 'Theo năm', 0, 'du lịch, khách sạn, vé máy bay, homestay, resort', 15000000, '✈️', 14),
  ('Thu', 'Lương', null, 40000000, 'lương', 0, '💼', 15),
  ('Thu', 'Thưởng', null, 0, 'thưởng, bonus', 0, '🎉', 16),
  ('Thu', 'Thu nhập phụ', null, 0, 'freelance, hoa hồng, commission, kinh doanh, bán hàng', 0, '💡', 17),
  ('Thu', 'Khác', null, 0, '', 0, '💰', 18),
  ('Trả nợ', 'Gốc', null, 0, 'gốc', 0, '🏦', 19),
  ('Trả nợ', 'Lãi', null, 0, 'lãi', 0, '📈', 20),
  ('Vay', 'Vay', null, 0, '', 0, '🤝', 21),
  ('Cho vay', 'Cho vay', null, 0, '', 0, '📤', 22),
  ('Thu hồi nợ', 'Thu hồi', null, 0, '', 0, '📥', 23)
on conflict (type, name) do nothing;

insert into debts (code, name, creditor, initial, start_date, rate, min_pay, keywords, status, note, interest_cycle, next_due, next_amount, sort) values
  ('NH-NHA', 'Vay mua nhà (ngân hàng)', 'Ngân hàng', 500000000, null, 8.5, 10000000, 'ngân hàng, bank, vay nhà', 'Đang trả', 'VÍ DỤ — sửa theo hợp đồng thật', 'Tháng', null, null, 1),
  ('NGUOI-THAN', 'Vay người thân', 'Người thân', 100000000, null, 5, 0, 'người thân, chú, bác', 'Đang trả', 'VÍ DỤ — trả lãi 1 lần/năm', 'Năm', current_date + 75, 5000000, 2),
  ('BAN-BE', 'Vay bạn bè', 'Bạn bè', 30000000, null, 0, 0, 'bạn bè, bạn', 'Đang trả', 'VÍ DỤ — không lãi', 'Tháng', null, null, 3)
on conflict (code) do nothing;

do $$ begin
  if not exists (select 1 from assets) then
  insert into assets (name, type, qty, unit, price, value, included, updated, note, sort) values
    ('Nhà / căn hộ', 'Bất động sản', null, null, null, 2000000000, true, current_date, 'VÍ DỤ — giá ước tính', 1),
    ('Vàng', 'Vàng', 5, 'chỉ', 8000000, null, true, current_date, 'Sửa cột price khi giá vàng đổi', 2),
    ('Tiết kiệm', 'Tiền mặt & tiết kiệm', null, null, null, 50000000, true, current_date, null, 3),
    ('Đang cho vay', 'Phải thu', null, null, null, 10000000, true, current_date, 'Tự cộng/trừ theo giao dịch Cho vay / Thu hồi nợ', 4);
  end if;
end $$;
