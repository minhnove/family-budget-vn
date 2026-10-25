/**
 * Code dùng chung cho TRÌNH DUYỆT và MÁY CHỦ (Vercel):
 * hằng số, tiện ích định dạng, ngày giờ theo giờ Việt Nam, và bộ hiểu câu nhập (parser).
 * Không được import thư viện Node ở file này.
 */

// ---------- Hằng số ----------
// Đổi tên app ở đây (và trong public/manifest.webmanifest)
export const APP_NAME = 'Thu chi gia đình';
export const TZ = 'Asia/Ho_Chi_Minh';

export const TYPES = {
  CHI: 'Chi',
  THU: 'Thu',
  TRA_NO: 'Trả nợ',
  VAY: 'Vay',
  CHO_VAY: 'Cho vay',
  THU_HOI: 'Thu hồi nợ',
};
export const TYPE_LIST = [TYPES.CHI, TYPES.THU, TYPES.TRA_NO, TYPES.VAY, TYPES.CHO_VAY, TYPES.THU_HOI];
export const DEBT_TYPES = [TYPES.VAY, TYPES.TRA_NO];   // bắt buộc gắn với 1 khoản nợ
export const CAT_GOC = 'Gốc';
export const CAT_LAI = 'Lãi';
export const DEBT_DONE = 'Đã tất toán';
export const ASSET_RECEIVABLE = 'Phải thu';             // tự cộng Cho vay / trừ Thu hồi nợ sau ngày cập nhật

export const WARN_PCT = 0.8;          // >= 80% ngân sách: cảnh báo vàng
export const PACE_PCT = 1.1;          // dự phóng > 110% ngân sách: "chi nhanh"
export const BASELINE_MONTHS = 3;     // baseline = trung bình 3 tháng gần nhất
export const INTEREST_REMIND_DAYS = [30, 14, 7, 3, 1, 0];

// ---------- Chuỗi & số ----------
/** Bỏ dấu tiếng Việt + chữ thường, để so khớp từ khoá */
export function norm_(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim();
}
export function isAscii_(s) { return /^[\x00-\x7F]*$/.test(s); }
export function splitKeywords_(s) { return String(s || '').split(',').map(norm_).filter(Boolean); }

/** 1234567 -> "1.234.567đ" */
export function fmt_(n) {
  n = Math.round(Number(n) || 0);
  return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
}
/** 1234567 -> "1,2tr" */
export function fmtShort_(n) {
  n = Number(n) || 0;
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  const dec = (v, d) => String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).replace('.', ',');
  if (a >= 1e9) return s + dec(a / 1e9, 2) + ' tỷ';
  if (a >= 1e6) return s + dec(a / 1e6, 1) + 'tr';
  if (a >= 1e3) return s + Math.round(a / 1e3) + 'k';
  return s + Math.round(a) + 'đ';
}
export function pctStr_(v) { return v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%'; }
export function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function pad2_(n) { return (n < 10 ? '0' : '') + n; }

// ---------- Mảng ----------
export function sum_(arr, fn) { return arr.reduce((a, x) => a + (fn ? fn(x) : x), 0); }
export function groupBy_(arr, fn) { const r = {}; arr.forEach(x => { const k = fn(x); (r[k] = r[k] || []).push(x); }); return r; }
export function sumBy_(arr, keyFn, valFn) {
  const r = {}; arr.forEach(x => { const k = keyFn(x); r[k] = (r[k] || 0) + (valFn ? valFn(x) : x.amount); }); return r;
}
export function uniq_(arr) { return arr.filter((x, i) => arr.indexOf(x) === i); }

// ---------- Ngày giờ ----------
// Mọi ngày trong app là "ngày lịch" tạo bằng new Date(y, m, d) và đọc bằng getFullYear/getMonth/getDate,
// nên không phụ thuộc múi giờ của máy chủ. Chỉ "bây giờ" mới cần quy đổi về giờ Việt Nam.
const VN_PARTS = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
/** Bây giờ theo giờ Việt Nam (đọc bằng các getter thường) */
export function nowVN_() {
  const p = {};
  VN_PARTS.formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return new Date(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
}
export function today_() { const n = nowVN_(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
export function monthKey_(d) { return d.getFullYear() + '-' + pad2_(d.getMonth() + 1); }
export function currentMonth_() { return monthKey_(nowVN_()); }
export function isoDate_(d) { return d.getFullYear() + '-' + pad2_(d.getMonth() + 1) + '-' + pad2_(d.getDate()); }
export function viDate_(d) { return pad2_(d.getDate()) + '/' + pad2_(d.getMonth() + 1); }
/** "2027-03" + (-1) -> "2027-02" */
export function addMonths_(key, n) {
  const p = key.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1 + n, 1);
  return d.getFullYear() + '-' + pad2_(d.getMonth() + 1);
}
/** "2027-03" -> "03/2027" */
export function monthLabel_(key) { const p = key.split('-'); return p[1] + '/' + p[0]; }
export function daysInMonth_(key) { const p = key.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); }
/** Tỷ lệ đã đi qua của tháng: tháng cũ = 1, tháng tương lai = 0 */
export function monthProgress_(key) {
  const cur = currentMonth_();
  if (key < cur) return 1;
  if (key > cur) return 0;
  return nowVN_().getDate() / daysInMonth_(key);
}
/** Date | "yyyy-MM-dd" | "dd/MM/yyyy" -> ngày lịch */
export function toDate_(v) {
  if (v instanceof Date && !isNaN(v)) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) { let y = Number(m[3]); if (y < 100) y += 2000; return new Date(y, Number(m[2]) - 1, Number(m[1])); }
  return null;
}

// ---------- Parser: hiểu câu "[ngày] Thu/Chi + nội dung + số tiền" ----------
/**
 * Hiểu câu ghi chép tự nhiên, ví dụ:
 *   "50k cafe"                 -> Chi 50.000, Ăn ngoài & cafe
 *   "thu 15tr lương"           -> Thu 15.000.000, Lương
 *   "+2tr5 thưởng"             -> Thu 2.500.000
 *   "trả nợ 5tr ngân hàng"     -> Trả nợ (Gốc) 5.000.000, khoản nợ khớp "ngân hàng"
 *   "trả lãi 1tr2 ngân hàng"   -> Trả nợ (Lãi) 1.200.000
 *   "vay 10tr mẹ"              -> Vay 10.000.000, khoản nợ khớp "mẹ"
 *   "hôm qua 200k xăng #vợ"    -> ngày hôm qua, người = Vợ
 *   "15/3 1.500.000 điện"      -> ngày 15/3
 */

export const UNIT_MAP = { k: 1e3, nghin: 1e3, ngan: 1e3, tr: 1e6, trieu: 1e6, cu: 1e6, m: 1e6, ty: 1e9, d: 1, vnd: 1, dong: 1 };
export const AMOUNT_RE = /^([+-]?)(\d[\d.,]*)(k|nghin|ngan|tr|trieu|cu|m|ty|d|vnd|dong)?(\d{1,3})?$/;
export const UNIT_WORD_RE = /^(k|nghin|ngan|tr|trieu|cu|ty|d|vnd|dong)$/;

// [cụm từ (có dấu), loại, danh mục]. Không dấu cũng nhận nếu người dùng gõ không dấu.
export function typePrefixes_() { return [
  [['trả', 'nợ', 'gốc'], TYPES.TRA_NO, CAT_GOC],
  [['trả', 'nợ', 'lãi'], TYPES.TRA_NO, CAT_LAI],
  [['trả', 'nợ'], TYPES.TRA_NO, CAT_GOC],
  [['trả', 'gốc'], TYPES.TRA_NO, CAT_GOC],
  [['trả', 'lãi'], TYPES.TRA_NO, CAT_LAI],
  [['cho', 'vay'], TYPES.CHO_VAY, null],
  [['thu', 'hồi'], TYPES.THU_HOI, null],
  [['thu', 'nợ'], TYPES.THU_HOI, null],
  [['đi', 'vay'], TYPES.VAY, null],
  [['vay'], TYPES.VAY, null],
  [['mượn'], TYPES.VAY, null],
  [['thu'], TYPES.THU, null],
  [['nhận'], TYPES.THU, null],
  [['chi'], TYPES.CHI, null],
]; }

/** "50k" | "1tr2" | "1.500.000" | "2,5tr" -> số tiền (đồng). Không đơn vị & < 1000 thì hiểu là nghìn. */
export function parseAmount_(raw) {
  const m = norm_(raw).replace(/\s+/g, '').match(AMOUNT_RE);
  if (!m) return null;
  return amountFromMatch_(m, '');
}

export function amountFromMatch_(m, extraUnit) {
  const numStr = m[2];
  const unit = m[3] || extraUnit || '';
  const tail = m[4] || '';
  let num;
  if (/^\d{1,3}([.,]\d{3})+$/.test(numStr)) num = Number(numStr.replace(/[.,]/g, ''));
  else if (/^\d+([.,]\d+)?$/.test(numStr)) num = Number(numStr.replace(',', '.'));
  else return null;
  if (!isFinite(num)) return null;
  if (tail) {
    if (!m[3]) return null;
    num += Number('0.' + tail);          // 1tr2 = 1,2tr ; 2k5 = 2,5k
  }
  const mult = unit ? UNIT_MAP[unit] : (num < 1000 ? 1e3 : 1);
  const value = Math.round(num * mult);
  return value > 0 ? { value: value, sign: m[1] } : null;
}

export function tokenIs_(tok, phrase) {
  const t = tok.toLowerCase().replace(/[:,]$/, '');   // "Chi:" cũng nhận
  return t === phrase || (isAscii_(t) && t === norm_(phrase));
}

/** Tìm mục khớp nhiều từ khoá nhất (điểm = tổng độ dài từ khoá khớp, text đã bỏ dấu) */
export function bestKeywordMatch_(textNorm, items) {
  const clean = s => s.replace(/[^a-z0-9]+/g, ' ').trim();
  const hay = ' ' + clean(textNorm) + ' ';
  let best = null, bestScore = 0;
  items.forEach(it => {
    const score = sum_(uniq_(it.keywords.map(clean)), kw => kw && hay.indexOf(' ' + kw + ' ') >= 0 ? kw.length : 0);
    if (score > bestScore) { best = it; bestScore = score; }
  });
  return best;
}

/**
 * Parse 1 dòng.
 * ctx = {person, cats, debts, members, today}
 * Trả về {tx} hoặc {error}
 */
export function parseLine_(line, ctx) {
  let tokens = String(line || '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { error: 'Dòng trống' };

  let type = null, cat = null, date = ctx.today, person = ctx.person, amount = null, dateSet = false;

  // 1) Ngày (ở bất kỳ đâu, thường ở đầu câu): "15/3", "15/3/2027", "hôm qua", "hôm kia"
  const kept = [];
  for (let i = 0; i < tokens.length; i++) {
    const n = norm_(tokens[i]).replace(/[:,]$/, '');
    const next = norm_(tokens[i + 1] || '').replace(/[:,]$/, '');
    if ((n === 'hom' || n === 'bua') && (next === 'qua' || next === 'kia' || next === 'nay')) {
      date = new Date(ctx.today.getTime());
      date.setDate(date.getDate() - (next === 'qua' ? 1 : next === 'kia' ? 2 : 0));
      dateSet = true; i++; continue;
    }
    if (n === 'hqua') { date = new Date(ctx.today.getTime()); date.setDate(date.getDate() - 1); dateSet = true; continue; }
    const dm = n.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
    if (dm) {
      const d = Number(dm[1]), mo = Number(dm[2]);
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        let y = dm[3] ? Number(dm[3]) : ctx.today.getFullYear();
        if (y < 100) y += 2000;
        date = new Date(y, mo - 1, d);
        if (!dm[3] && date > ctx.today) date = new Date(y - 1, mo - 1, d);  // 25/12 khi đang tháng 1 -> năm trước
        dateSet = true; continue;
      }
    }
    kept.push(tokens[i]);
  }
  tokens = kept;

  // 2) Loại giao dịch: "Thu", "Chi", "Trả nợ", "Vay"... ở đầu câu (sau ngày)
  for (const p of typePrefixes_()) {
    const words = p[0];
    if (tokens.length >= words.length && words.every((w, i) => tokenIs_(tokens[i], w))) {
      type = p[1]; cat = p[2]; tokens = tokens.slice(words.length);
      break;
    }
  }

  // 3) Người, số tiền
  const rest = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const n = norm_(tok);
    const next = norm_(tokens[i + 1] || '');

    if ((tok[0] === '#' || tok[0] === '@') && tok.length > 1) {
      // "#mẹ", "#lan", "#melan" đều khớp thành viên tên "Mẹ Lan"
      const tag = norm_(tok.slice(1));
      const who = (ctx.members || []).filter(m => {
        const words = norm_(m.name).split(/\s+/);
        return words.join('') === tag || words.indexOf(tag) >= 0;
      })[0];
      if (who) { person = who.name; continue; }
    }

    if (amount === null) {
      const am = n.match(AMOUNT_RE);
      if (am) {
        let extra = '';
        if (!am[3] && UNIT_WORD_RE.test(next)) { extra = next; i++; }   // "15 triệu"
        const a = amountFromMatch_(am, extra);
        if (a) {
          amount = a.value;
          if (!type && a.sign === '+') type = TYPES.THU;
          continue;
        }
      }
    }
    rest.push(tok);
  }

  if (!amount) return { error: 'Không thấy số tiền. VD: "50k cafe", "thu 15tr lương"' };
  const note = rest.join(' ').trim();
  const noteNorm = norm_(note);

  // Không ghi loại: mặc định Chi, trừ khi chỉ khớp từ khoá của danh mục Thu (VD "15tr lương")
  if (!type) {
    const chiHit = bestKeywordMatch_(noteNorm, ctx.cats.filter(c => c.type === TYPES.CHI));
    const thuHit = chiHit ? null : bestKeywordMatch_(noteNorm, ctx.cats.filter(c => c.type === TYPES.THU));
    type = thuHit ? TYPES.THU : TYPES.CHI;
  }

  // 4) Danh mục (catMatched = false nghĩa là đang để mặc định, nên cho người dùng chọn lại)
  let catMatched = !!cat;
  if (!cat) {
    const ofType = ctx.cats.filter(c => c.type === type);
    const hit = bestKeywordMatch_(noteNorm, ofType);
    if (hit) { cat = hit.name; catMatched = true; }
    else if (type === TYPES.TRA_NO) cat = CAT_GOC;
    else {
      const other = ofType.filter(c => norm_(c.name) === 'khac')[0];
      cat = other ? other.name : (ofType[0] ? ofType[0].name : 'Khác');
    }
  }

  const tx = { date: date, type: type, category: cat, amount: amount, person: person, debt: '', note: note };
  const info = { catMatched: catMatched, dateSet: dateSet };

  // 5) Khoản nợ
  if (DEBT_TYPES.indexOf(type) >= 0) {
    const active = ctx.debts.filter(d => d.status !== DEBT_DONE);
    const hit = bestKeywordMatch_(noteNorm, ctx.debts) || (active.length === 1 ? active[0] : null);
    if (!hit) {
      return { needDebt: true, tx: tx, info: info,
        error: 'Chưa rõ khoản nợ nào. Thêm tên/từ khoá vào câu, các khoản đang có:\n' +
          active.map(d => '• ' + d.code + ' — ' + d.name).join('\n') };
    }
    tx.debt = hit.code;
  }

  return { tx: tx, info: info };
}
