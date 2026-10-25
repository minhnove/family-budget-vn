/** Các thao tác giao diện web gọi tới (POST /api/app {action, payload}) */
import {
  TYPES, TYPE_LIST, DEBT_TYPES, DEBT_DONE, uniq_, sumBy_, toDate_, today_, isoDate_, currentMonth_, parseAmount_,
} from '../public/js/shared.js';
import { monthReport_, yearReport_, debtStatus_, assetStatus_ } from './report.js';
import * as db from './db.js';
import { setupTelegram, telegramStatus } from './bot.js';

export async function handleAction(action, p, ctx) {
  p = p || {};
  let out;
  switch (action) {
    case 'meta': out = meta(await db.loadData()); break;
    case 'add': out = txOut(await addFromClient(p)); break;
    case 'delete': await db.deleteTransaction(p.id); out = { ok: true }; break;
    case 'list': out = listTx(await db.loadData(), p.month || currentMonth_()); break;
    case 'month': out = monthReport_(p.month || currentMonth_(), await db.loadData()); break;
    case 'year': out = yearReport_(Number(p.year) || today_().getFullYear(), await db.loadData()); break;
    case 'debts': {
      const data = await db.loadData();
      out = debtStatus_(data, p.month || currentMonth_());
      out.assets = assetStatus_(data, out.totalRemaining);
      break;
    }
    case 'telegramStatus': out = { ...(await telegramStatus()), dbMode: db.DB_MODE, site: ctx.origin }; break;
    case 'telegramSetup': out = await setupTelegram(ctx.origin); break;
    default: throw new Error('Thao tác không hợp lệ: ' + action);
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
  const amt = typeof p.amount === 'number' ? { value: p.amount } : parseAmount_(p.amount);
  if (!amt) throw new Error('Số tiền không hợp lệ: ' + p.amount);
  return db.addTransaction({
    date: toDate_(p.date) || today_(), type: p.type, category: p.category, amount: amt.value,
    person: p.person, debt: p.debt, note: p.note,
  }, 'Web', 'web');
}

function txOut(t, debtNames) {
  return { id: t.id, date: isoDate_(t.date), type: t.type, category: t.category, amount: t.amount, person: t.person,
    debt: t.debt, debtName: debtNames ? (debtNames[t.debt] || t.debt) : t.debt, note: t.note, source: t.source };
}

function listTx(data, month) {
  const names = {};
  data.debts.forEach(d => { names[d.code] = d.name; });
  return data.txs.filter(t => t.month === month)
    .sort((a, b) => b.date - a.date || b.row - a.row)
    .map(t => txOut(t, names));
}
