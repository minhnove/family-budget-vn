// Giao dịch mẫu cho CHẾ ĐỘ XEM THỬ (khi chưa nối Supabase): 3 tháng trước + tháng này tới hôm nay.
// Ngày tính tương đối theo hôm nay nên lúc nào mở cũng có số liệu. KHÔNG nạp vào Supabase.
import { today_, isoDate_ } from '../public/js/shared.js';

export function demoTransactions() {
  const rows = [];
  const now = today_();
  const add = (y, m, d, type, category, amount, person, note, debt) => rows.push({
    date: isoDate_(new Date(y, m, d)), type, category, amount: Math.round(amount),
    person: person || 'Chung', debt: debt || null, note: note || '', source: 'Mẫu', created_by: 'demo',
  });

  // k = hệ số dao động từng tháng để biểu đồ trông thật hơn
  [[3, 1.00], [2, 1.06], [1, 0.95], [0, 1.12]].forEach(([back, k]) => {
    const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = first.getFullYear(), m = first.getMonth();
    const last = back === 0 ? now.getDate() : 28;
    const on = (d, ...a) => { if (d <= last) add(y, m, d, ...a); };

    on(5, 'Thu', 'Lương', 25e6, 'Bố', 'lương');
    on(5, 'Thu', 'Lương', 15e6, 'Mẹ', 'lương');
    on(2, 'Chi', 'Biếu bố mẹ', 2e6, 'Mẹ', 'biếu ông bà');
    [3, 9, 15, 21, 27].forEach((d, i) => on(d, 'Chi', 'Đi chợ & ăn ở nhà', 1200000 * k + i * 40000, 'Mẹ', 'đi chợ'));
    [4, 11, 18, 25].forEach(d => {
      on(d, 'Chi', 'Ăn ngoài', 450000 * k * (back === 0 ? 1.25 : 1), 'Bố', 'ăn ngoài cuối tuần');
      on(d + 1, 'Chi', 'Cafe', 180000 * k, 'Bố', 'cafe');
    });
    on(6, 'Chi', 'Con cái', 2500000 * k, 'Bé', 'học phí mầm non');
    on(16, 'Chi', 'Con cái', 1300000 * k, 'Bé', 'sữa, bỉm');
    on(8, 'Chi', 'Đi lại', 900000 * k, 'Bố', 'xăng, gửi xe');
    on(10, 'Chi', 'Nhà cửa & hoá đơn', 2200000 * k, 'Chung', 'điện, nước, internet');
    on(13, 'Chi', 'Mua sắm', 1200000 * k * (back === 0 ? 1.3 : 1), 'Mẹ', 'shopee');
    on(14, 'Chi', 'Khác', 500000 * k, 'Chung', '');
    on(15, 'Trả nợ', 'Gốc', 6e6, 'Bố', 'ngân hàng', 'NH-NHA');
    on(15, 'Trả nợ', 'Lãi', 3.4e6, 'Bố', 'ngân hàng', 'NH-NHA');
    on(20, 'Trả nợ', 'Gốc', 2e6, 'Mẹ', 'bạn bè', 'BAN-BE');
    if (back === 2) on(20, 'Chi', 'Bảo hiểm', 10e6, 'Bố', 'bảo hiểm');
    if (back === 1) { on(2, 'Chi', 'Du lịch', 6e6, 'Chung', 'du lịch biển'); on(24, 'Chi', 'Hiếu hỉ & quà', 1e6, 'Chung', 'đám cưới'); }
  });
  return rows;
}
