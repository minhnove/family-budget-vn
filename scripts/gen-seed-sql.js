// Tạo supabase/seed.sql từ lib/seed.js.  Chạy: npm run seed-sql
import { writeFileSync } from 'node:fs';
import { SEED } from '../lib/seed.js';

const lit = v => v === null || v === undefined ? 'null'
  : typeof v === 'number' || typeof v === 'boolean' ? String(v)
  : "'" + String(v).replace(/'/g, "''") + "'";

// Cột ngày trong dữ liệu ví dụ được tính tương đối theo hôm nay -> ghi thành "current_date + N"
// để ai chạy seed.sql vào lúc nào cũng có ngày hợp lý.
const RELATIVE_DATE_COLS = ['next_due', 'updated'];
const todayUTC = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
function value(col, v) {
  if (RELATIVE_DATE_COLS.includes(col) && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    const n = Math.round((Date.UTC(y, m - 1, d) - todayUTC()) / 864e5);
    return n === 0 ? 'current_date' : `current_date + ${n}`;
  }
  return lit(v);
}

function insert(table, rows, conflict) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return `insert into ${table} (${cols.join(', ')}) values\n` +
    rows.map(r => '  (' + cols.map(c => value(c, r[c])).join(', ') + ')').join(',\n') +
    `\non conflict ${conflict} do nothing;\n\n`;
}

const sql = '-- Dữ liệu ban đầu (tạo tự động từ lib/seed.js). Chạy SAU schema.sql. Chạy lại nhiều lần cũng không bị trùng.\n\n' +
  insert('members', SEED.members, '(name)') +
  insert('categories', SEED.categories, '(type, name)') +
  insert('debts', SEED.debts, '(code)') +
  // assets không có khoá tự nhiên -> chỉ chèn khi bảng còn trống
  (SEED.assets.length ? `do $$ begin\n  if not exists (select 1 from assets) then\n` +
    '  ' + insert('assets', SEED.assets, '').replace(/\non conflict  do nothing;\n\n$/, ';\n').replace(/\n/g, '\n  ') +
    `end if;\nend $$;\n` : '');

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log('supabase/seed.sql:', SEED.members.length, 'thành viên,', SEED.categories.length, 'danh mục,',
  SEED.debts.length, 'khoản nợ,', SEED.assets.length, 'tài sản');
