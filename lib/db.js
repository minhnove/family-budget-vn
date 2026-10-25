/**
 * Đọc / ghi dữ liệu.
 * - Có SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY: dùng Supabase (chạy thật trên Vercel).
 * - Không có: dùng bộ nhớ với dữ liệu ban đầu + giao dịch mẫu (chạy thử local: npm run dev).
 */
import {
  TYPES, TYPE_LIST, DEBT_TYPES, CAT_GOC, norm_, splitKeywords_, uniq_, toDate_, monthKey_, isoDate_,
} from '../public/js/shared.js';
import { SEED } from './seed.js';
import { demoTransactions } from './demo-data.js';
import { UserError } from './errors.js';

/** Giới hạn dữ liệu một giao dịch (khớp ràng buộc trong supabase/schema.sql) */
export const NOTE_MAX = 500;
export const AMOUNT_MAX = 1e12;

const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
export const DB_MODE = useSupabase ? 'supabase' : 'memory';

// ---------- Chuyển dòng database -> object mà phần báo cáo dùng ----------
const mapTx = (r, i) => {
  const date = toDate_(r.date);
  return { row: i, id: r.id, date, month: monthKey_(date), type: r.type, category: r.category || 'Khác',
    amount: Math.abs(Number(r.amount)), person: r.person || 'Chung', debt: r.debt || '', note: r.note || '',
    source: r.source || '', by: r.created_by || '' };
};
const mapCat = r => ({ type: r.type, name: r.name, group: r.grp || '', budget: Number(r.budget) || 0,
  keywords: uniq_(splitKeywords_(r.keywords).concat([norm_(r.name)])), budgetYear: Number(r.budget_year) || 0, icon: r.icon || '' });
const mapDebt = r => ({ code: r.code, name: r.name, creditor: r.creditor || '', initial: Number(r.initial) || 0,
  start: toDate_(r.start_date), rate: Number(r.rate) || 0, minPay: Number(r.min_pay) || 0,
  keywords: uniq_(splitKeywords_(r.keywords).concat([norm_(r.code), norm_(r.name), norm_(r.creditor)]).filter(Boolean)),
  status: r.status || 'Đang trả', note: r.note || '', interestCycle: norm_(r.interest_cycle) === 'nam' ? 'year' : 'month',
  nextDue: toDate_(r.next_due), nextAmount: Number(r.next_amount) || 0 });
const mapAsset = r => {
  const qty = Number(r.qty) || 0, price = Number(r.price) || 0;
  return { name: r.name, type: r.type || '', qty, unit: r.unit || '', price,
    baseValue: qty && price ? qty * price : (Number(r.value) || 0), included: r.included !== false,
    updated: toDate_(r.updated), note: r.note || '' };
};
const mapMember = r => ({ name: r.name, tgId: r.tg_id ? String(r.tg_id).trim() : '' });
const mapOverride = r => ({ month: r.month, name: r.category, budget: Number(r.budget) || 0 });

// ---------- Backend: Supabase ----------
/**
 * Chấp nhận mọi kiểu dán URL: "https://ref.supabase.co", ".../rest/v1/", có dấu "/" cuối,
 * hoặc link dashboard "https://supabase.com/dashboard/project/ref/..." -> luôn trả về "https://ref.supabase.co".
 */
export function normalizeSupabaseUrl(raw) {
  const s = String(raw || '').trim().replace(/^["']|["']$/g, '');
  let u;
  try { u = new URL(/^https?:\/\//.test(s) ? s : 'https://' + s); } catch (e) { return s; }
  const dash = u.pathname.match(/\/project\/([a-z0-9]{10,})/i);
  if (/(^|\.)supabase\.com$/i.test(u.hostname) && dash) return 'https://' + dash[1] + '.supabase.co';
  return u.origin;
}

let sbClient = null;
async function sb() {
  if (!sbClient) {
    const { createClient } = await import('@supabase/supabase-js');
    sbClient = createClient(normalizeSupabaseUrl(process.env.SUPABASE_URL), String(process.env.SUPABASE_SERVICE_ROLE_KEY).trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return sbClient;
}
const check = ({ data, error }) => { if (error) throw new Error('Database: ' + error.message); return data; };

/** Lấy hết dòng (Supabase giới hạn 1000 dòng/lần) */
async function fetchAll(table, order) {
  const c = await sb();
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = c.from(table).select('*').range(from, from + 999);
    order.forEach(o => { q = q.order(o, { ascending: true }); });
    const rows = check(await q);
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const supabaseBackend = {
  async load() {
    const [tx, cats, ov, debts, mem, assets] = await Promise.all([
      fetchAll('transactions', ['date', 'created_at']), fetchAll('categories', ['sort', 'id']),
      fetchAll('budget_overrides', ['month']), fetchAll('debts', ['sort', 'code']),
      fetchAll('members', ['sort', 'id']), fetchAll('assets', ['sort', 'id']),
    ]);
    return { tx, cats, ov, debts, mem, assets };
  },
  async insertTx(row) { return check(await (await sb()).from('transactions').insert(row).select().single()); },
  async deleteTx(id) {
    const rows = check(await (await sb()).from('transactions').delete().eq('id', id).select('id'));
    if (!rows.length) throw new UserError('Không tìm thấy giao dịch', 404);
  },
  async updateTx(id, fields) { check(await (await sb()).from('transactions').update(fields).eq('id', id)); },
  async lastTxBy(by) {
    const rows = check(await (await sb()).from('transactions').select('*').eq('created_by', by)
      .order('created_at', { ascending: false }).limit(1));
    return rows[0] || null;
  },
  async getCategory(type, name) {
    const rows = check(await (await sb()).from('categories').select('*').eq('type', type).eq('name', name).limit(1));
    return rows[0] || null;
  },
  async setCategoryKeywords(type, name, keywords) {
    check(await (await sb()).from('categories').update({ keywords }).eq('type', type).eq('name', name));
  },
  async getState(key) {
    const rows = check(await (await sb()).from('app_state').select('value').eq('key', key).limit(1));
    return rows[0] ? rows[0].value : null;
  },
  async setState(key, value) {
    check(await (await sb()).from('app_state').upsert({ key, value, updated_at: new Date().toISOString() }));
  },
  // Đếm nguyên tử trong Postgres (supabase/schema.sql: login_attempt / login_reset / bump_session_version)
  async loginAttempt(key, windowSeconds) {
    return Number(check(await (await sb()).rpc('login_attempt', { p_key: key, p_window_seconds: windowSeconds })));
  },
  async loginReset(key) { check(await (await sb()).rpc('login_reset', { p_key: key })); },
  async bumpSessionVersion() { return Number(check(await (await sb()).rpc('bump_session_version'))); },
  async markUpdate(updateId) {
    const res = await (await sb()).from('tg_updates').insert({ update_id: updateId });
    if (res.error) {
      if (res.error.code === '23505') return false;   // đã xử lý rồi
      throw new Error('Database: ' + res.error.message);
    }
    return true;
  },
};

// ---------- Backend: bộ nhớ (chạy thử) ----------
const mem = {
  tx: [], state: Object.create(null), seen: new Set(), attempts: new Map(),
  cats: SEED.categories.map(x => ({ ...x })), debts: SEED.debts.map(x => ({ ...x })),
  members: SEED.members.map(x => ({ ...x })), assets: SEED.assets.map(x => ({ ...x })), ov: [],
};
let memSeq = 0;
function memorySeedTransactions(rows) {
  rows.forEach(r => mem.tx.push({ id: 'd' + (++memSeq), created_at: new Date(Date.now() + memSeq).toISOString(), ...r }));
}
// Chế độ xem thử: nạp sẵn giao dịch mẫu để giao diện có số liệu
if (!useSupabase) memorySeedTransactions(demoTransactions());
/** Chỉ cho chạy thử: sửa 1 dòng trong bảng bộ nhớ, VD memoryUpdate('members', {name: 'Bố'}, {tg_id: '123'}) */
export function memoryUpdate(table, match, fields) {
  const list = { members: mem.members, categories: mem.cats, debts: mem.debts, assets: mem.assets }[table];
  (list || []).filter(r => Object.entries(match).every(([k, v]) => r[k] === v)).forEach(r => Object.assign(r, fields));
}
// Chạy thử: MEMORY_LATENCY_MS giả lập độ trễ database (dùng trong test bắn request song song)
const lag = () => new Promise(r => setTimeout(r, Number(process.env.MEMORY_LATENCY_MS) || 0));
const memoryBackend = {
  async load() {
    return { tx: [...mem.tx].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)),
      cats: mem.cats, ov: mem.ov, debts: mem.debts, mem: mem.members, assets: mem.assets };
  },
  async insertTx(row) {
    const r = { id: Math.random().toString(16).slice(2, 10), created_at: new Date(Date.now() + (++memSeq)).toISOString(), ...row };
    mem.tx.push(r); return r;
  },
  async deleteTx(id) {
    const i = mem.tx.findIndex(t => t.id === id);
    if (i < 0) throw new UserError('Không tìm thấy giao dịch', 404);
    mem.tx.splice(i, 1);
  },
  async updateTx(id, fields) { Object.assign(mem.tx.find(t => t.id === id) || {}, fields); },
  async lastTxBy(by) {
    return mem.tx.filter(t => t.created_by === by).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
  },
  async getCategory(type, name) { return mem.cats.find(c => c.type === type && c.name === name) || null; },
  async setCategoryKeywords(type, name, keywords) { const c = mem.cats.find(x => x.type === type && x.name === name); if (c) c.keywords = keywords; },
  async getState(key) { return mem.state[key] ?? null; },
  async setState(key, value) { mem.state[key] = value; },
  async markUpdate(id) { if (mem.seen.has(id)) return false; mem.seen.add(id); return true; },
  // Tăng bộ đếm ngay (đồng bộ, không có await xen giữa đọc và ghi) rồi mới chờ — giống 1 lệnh SQL nguyên tử
  async loginAttempt(key, windowSeconds) {
    const now = Date.now();
    let a = mem.attempts.get(key);
    if (!a || now - a.start > windowSeconds * 1000) { a = { count: 0, start: now }; mem.attempts.set(key, a); }
    const n = ++a.count;
    await lag();
    return n;
  },
  async loginReset(key) { mem.attempts.delete(key); await lag(); },
  async bumpSessionVersion() { mem.state.session_version = (Number(mem.state.session_version) || 1) + 1; return mem.state.session_version; },
};

const B = useSupabase ? supabaseBackend : memoryBackend;

// ---------- API dùng trong app ----------
export async function loadData() {
  const r = await B.load();
  return {
    txs: r.tx.map(mapTx).filter(t => t.date && t.amount && TYPE_LIST.includes(t.type)),
    cats: r.cats.map(mapCat), overrides: r.ov.map(mapOverride), debts: r.debts.map(mapDebt),
    members: r.mem.map(mapMember), assets: r.assets.map(mapAsset),
  };
}

/**
 * Kiểm tra giao dịch theo dữ liệu thật (danh mục, thành viên, khoản nợ phải tồn tại) — không tin client.
 * tx = {date: Date, type, category, amount, person, debt, note}. Trả về dòng sẵn sàng ghi.
 */
export function validateTransaction(tx, data) {
  if (!TYPE_LIST.includes(tx.type)) throw new UserError('Loại giao dịch không hợp lệ');
  const amount = Number(tx.amount);
  if (!Number.isFinite(amount) || amount < 1 || amount > AMOUNT_MAX) throw new UserError('Số tiền không hợp lệ (1đ – 1.000 tỷ)');
  if (!(tx.date instanceof Date) || isNaN(tx.date) || tx.date.getFullYear() < 2000 || tx.date.getFullYear() > 2100) {
    throw new UserError('Ngày không hợp lệ');
  }
  const note = String(tx.note == null ? '' : tx.note).trim();
  if (note.length > NOTE_MAX) throw new UserError('Ghi chú tối đa ' + NOTE_MAX + ' ký tự');

  const ofType = data.cats.filter(c => c.type === tx.type);
  const fallback = tx.type === TYPES.TRA_NO ? CAT_GOC : tx.type === TYPES.VAY ? 'Vay' : 'Khác';
  const category = tx.category || (ofType.some(c => c.name === fallback) ? fallback : (ofType[0] && ofType[0].name));
  if (!ofType.some(c => c.name === category)) throw new UserError('Danh mục không có trong danh sách của loại "' + tx.type + '"');

  const names = data.members.map(m => m.name);
  const person = tx.person || (names.includes('Chung') ? 'Chung' : names[0]);
  if (!names.includes(person)) throw new UserError('Người ghi không có trong danh sách thành viên');

  let debt = null;
  if (DEBT_TYPES.includes(tx.type)) {
    if (!tx.debt) throw new UserError('Loại "' + tx.type + '" cần chọn khoản nợ');
    if (!data.debts.some(d => d.code === tx.debt)) throw new UserError('Khoản nợ không tồn tại');
    debt = tx.debt;
  }
  return { date: isoDate_(tx.date), type: tx.type, category, amount: Math.round(amount), person, debt, note };
}

/** data: kết quả loadData() nếu đã có sẵn (đỡ đọc lại database) */
export async function addTransaction(tx, source, by, data) {
  const row = validateTransaction(tx, data || await loadData());
  const saved = await B.insertTx({ ...row, source: String(source || '').slice(0, 20), created_by: String(by || '').slice(0, 40) });
  return mapTx(saved, 0);
}

export const deleteTransaction = id => B.deleteTx(String(id));
export const updateTxCategory = (id, category) => B.updateTx(String(id), { category });
export async function lastTxBy(by) { const r = await B.lastTxBy(by); return r ? mapTx(r, 0) : null; }
export const getState = key => B.getState(key);
export const setState = (key, value) => B.setState(key, value);
/** true nếu update Telegram này chưa xử lý */
export const markUpdate = id => B.markUpdate(id);
/** Đếm 1 lần đăng nhập cho key trong cửa sổ windowSeconds — nguyên tử, trả về số lần hiện tại */
export const loginAttempt = (key, windowSeconds) => B.loginAttempt(key, windowSeconds);
export const loginReset = key => B.loginReset(key);
/** Phiên bản phiên đăng nhập hiện tại (mặc định 1). Tăng lên = mọi cookie cũ hết hiệu lực. */
export async function getSessionVersion() { return Number(await B.getState('session_version')) || 1; }
export const bumpSessionVersion = () => B.bumpSessionVersion();

/** Khi đổi danh mục, ghi chú ngắn (1–2 từ) được thêm làm từ khoá để lần sau tự nhận đúng */
export async function learnKeyword(type, category, note) {
  const kw = String(note || '').trim().toLowerCase();
  if (!kw || kw.split(/\s+/).length > 2 || kw.length > 30) return;
  const c = await B.getCategory(type, category);
  if (!c || splitKeywords_(c.keywords).includes(norm_(kw))) return;
  await B.setCategoryKeywords(type, category, c.keywords ? c.keywords + ', ' + kw : kw);
}
