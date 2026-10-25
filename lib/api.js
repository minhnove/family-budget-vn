/** Các thao tác giao diện web gọi tới (POST /api/app {action, payload}) */
import {
  TYPES, TYPE_LIST, DEBT_TYPES, DEBT_DONE, uniq_, sumBy_, toDate_, today_, isoDate_, currentMonth_, parseAmount_,
} from '../public/js/shared.js';
import { monthReport_, yearReport_, debtStatus_, assetStatus_ } from './report.js';
import * as db from './db.js';
import { setupTelegram, telegramStatus } from './bot.js';
import { logoutEverywhere } from './auth.js';
import { UserError } from './errors.js';

// Tham số từ client: chỉ nhận đúng định dạng
const monthArg = m => {
  if (m == null || m === '') return currentMonth_();
  if (typeof m !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new UserError('Tháng không hợp lệ (yyyy-MM)');
  return m;
};
const yearArg = y => {
  if (y == null || y === '') return today_().getFullYear();
  const n = Number(y);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new UserError('Năm không hợp lệ');
  return n;
};
const idArg = id => {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new UserError('Mã giao dịch không hợp lệ');
  return id;
};

export async function handleAction(action, p, ctx) {
  p = p && typeof p === 'object' ? p : {};
  let out;
  switch (action) {
    case 'meta': out = meta(await db.loadData()); break;
    case 'add': out = txOut(await addFromClient(p)); break;
    case 'delete': await db.deleteTransaction(idArg(p.id)); out = { ok: true }; break;
    case 'list': out = listTx(await db.loadData(), monthArg(p.month)); break;
    case 'month': out = monthReport_(monthArg(p.month), await db.loadData()); break;
    case 'year': out = yearReport_(yearArg(p.year), await db.loadData()); break;
    case 'debts': {
      const data = await db.loadData();
      out = debtStatus_(data, monthArg(p.month));
      out.assets = assetStatus_(data, out.totalRemaining);
      break;
    }
    case 'telegramStatus': out = { ...(await telegramStatus()), dbMode: db.DB_MODE, site: ctx.origin }; break;
    case 'telegramSetup': out = await setupTelegram(ctx.origin); break;
    case 'logoutAll': out = { ok: true, sessionVersion: await logoutEverywhere() }; break;
    default: throw new UserError('Thao tác không hợp lệ');
  }
  return JSON.parse(JSON.stringify(out));   // Date -> chuỗi
}

function meta(data) {
  const month = currentMonth_();
  return {
    types: TYPE_LIST,
    debtTypes: DEBT_TYPES,
    categories: data.cats.map(c => ({ type: c.type, name: c.name, group: c.group, budget: c.budget,
      budgetYear: c.budgetYear, icon: c.icon, keywords: c.keywords })),
    members: data.members.map(m => m.name),
    debts: data.debts.filter(d => d.status !== DEBT_DONE).map(d => ({ code: d.code, name: d.name, keywords: d.keywords, status: d.status })),
    spent: sumBy_(data.txs.filter(t => t.month === month && t.type === TYPES.CHI), t => t.category),
    today: isoDate_(today_()),
    month,
    dbMode: db.DB_MODE,   // 'memory' = chế độ xem thử, dữ liệu không được lưu
    years: uniq_(data.txs.map(t => t.date.getFullYear()).concat([today_().getFullYear()])).sort(),
  };
}

async function addFromClient(p) {
  const amt = typeof p.amount === 'number' ? { value: p.amount }
    : typeof p.amount === 'string' && p.amount.length <= 30 ? parseAmount_(p.amount) : null;
  if (!amt) throw new UserError('Số tiền không hợp lệ');
  const str = (v, max) => v == null ? '' : typeof v === 'string' && v.length <= max ? v : (() => { throw new UserError('Dữ liệu không hợp lệ'); })();
  return db.addTransaction({
    date: toDate_(str(p.date, 10)) || today_(), type: str(p.type, 20), category: str(p.category, 80) || undefined,
    amount: amt.value, person: str(p.person, 80) || undefined, debt: str(p.debt, 40) || undefined, note: str(p.note, 5000),
  }, 'Web', 'web');
}

function txOut(t, debtNames) {
  return { id: t.id, date: isoDate_(t.date), type: t.type, category: t.category, amount: t.amount, person: t.person,
    debt: t.debt, debtName: debtNames ? (debtNames[t.debt] || t.debt) : t.debt, note: t.note, source: t.source };
}

function listTx(data, month) {
  const names = Object.create(null);
  data.debts.forEach(d => { names[d.code] = d.name; });
  return data.txs.filter(t => t.month === month)
    .sort((a, b) => b.date - a.date || b.row - a.row)
    .map(t => txOut(t, names));
}
