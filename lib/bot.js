/** Telegram bot: ghi giao dịch, lệnh báo cáo, nút Xoá / Đổi danh mục; và việc chạy hằng ngày (cron). */
import {
  TYPES, DEBT_DONE, INTEREST_REMIND_DAYS,
  fmt_, fmtShort_, pctStr_, esc_, pad2_, nowVN_, today_, isoDate_, currentMonth_, addMonths_, parseLine_,
} from '../public/js/shared.js';
import { monthReport_, debtStatus_, assetStatus_ } from './report.js';
import {
  HELP_TEXT, txLine_, txConfirmText_, txKeyboard_, monthSummaryText_, budgetText_, debtText_, todayText_, categoriesText_,
} from './texts.js';
import * as db from './db.js';
import { UserError, ConfigError } from './errors.js';

// ---------- Telegram API ----------
export async function tgApi(method, payload) {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) throw new ConfigError('Chưa cấu hình TELEGRAM_TOKEN');
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!body.ok) console.error('Telegram', method, JSON.stringify(body));
  return body;
}
const sendMessage = (chatId, text, markup) =>
  tgApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });
const editMessage = (chatId, msgId, text, markup) =>
  tgApi('editMessageText', { chat_id: chatId, message_id: msgId, text, parse_mode: 'HTML', ...(markup ? { reply_markup: markup } : {}) });
const editMarkup = (chatId, msgId, markup) => tgApi('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup: markup });
const answerCallback = (id, text) => tgApi('answerCallbackQuery', { callback_query_id: id, text: text || '' });

export async function broadcast(text, data) {
  const ms = (data || await db.loadData()).members.filter(m => m.tgId);
  await Promise.all(ms.map(m => sendMessage(m.tgId, text).catch(e => console.error(e))));
}

/** Đăng ký webhook (gọi từ nút "Kết nối Telegram" trong app) */
export async function setupTelegram(siteOrigin) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) throw new UserError('TELEGRAM_WEBHOOK_SECRET trên Vercel thiếu hoặc ngắn hơn 32 ký tự (chỉ chữ, số, _ và -). Sửa rồi deploy lại.');
  if (!process.env.TELEGRAM_TOKEN) throw new UserError('Chưa có TELEGRAM_TOKEN trên Vercel.');
  const hook = await tgApi('setWebhook', {
    url: siteOrigin + '/api/telegram', secret_token: secret,
    allowed_updates: ['message', 'callback_query'], drop_pending_updates: true,
  });
  await tgApi('setMyCommands', {
    commands: [
      { command: 'bc', description: 'Báo cáo tháng này (/bc 9 = tháng 9)' },
      { command: 'ns', description: 'Tình hình ngân sách' },
      { command: 'no', description: 'Nợ & tài sản ròng' },
      { command: 'hom', description: 'Các khoản đã ghi hôm nay' },
      { command: 'xoa', description: 'Xoá giao dịch vừa ghi' },
      { command: 'dm', description: 'Danh sách danh mục' },
      { command: 'help', description: 'Cách ghi chép' },
    ],
  });
  const me = await tgApi('getMe', {});
  const info = await tgApi('getWebhookInfo', {});
  return { ok: !!hook.ok, description: hook.description, bot: me.result && me.result.username, webhook: info.result };
}

export async function telegramStatus() {
  if (!process.env.TELEGRAM_TOKEN) return { configured: false };
  const [me, info] = await Promise.all([tgApi('getMe', {}), tgApi('getWebhookInfo', {})]);
  return { configured: true, bot: me.result && me.result.username, webhook: info.result };
}

// ---------- Nhận update ----------
const PRIVATE_ONLY = 'Bot này chỉ dùng trong chat riêng để không lộ số liệu tài chính. Nhắn trực tiếp cho bot nhé.';
const isPrivate = chat => chat && chat.type === 'private';

export async function handleUpdate(u) {
  if (!(await db.markUpdate(u.update_id))) return;     // Telegram gửi lại -> bỏ qua
  if (u.callback_query) {
    const q = u.callback_query;
    if (!isPrivate(q.message && q.message.chat)) return answerCallback(q.id, PRIVATE_ONLY);
    return handleCallback(q);
  }
  if (u.message && u.message.text) {
    // Bot lỡ bị thêm vào group: không ghi, không trả báo cáo — chỉ nhắc 1 câu khi có người gọi lệnh
    if (!isPrivate(u.message.chat)) {
      if (u.message.text.trim().startsWith('/')) return sendMessage(u.message.chat.id, PRIVATE_ONLY);
      return;
    }
    return handleMessage(u.message);
  }
}

const memberByTg = (members, uid) => members.find(m => m.tgId && String(m.tgId) === String(uid)) || null;

/** "/bc 9" | "/bc 9/2026" | "/bc 2026-09" | "/bc" */
function monthArg(arg) {
  const now = nowVN_();
  const a = String(arg || '').trim();
  let m = a.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return m[1] + '-' + pad2_(Number(m[2]));
  m = a.match(/^(\d{1,2})(?:\/(\d{4}))?$/);
  if (m) {
    const mo = Number(m[1]);
    let y = m[2] ? Number(m[2]) : now.getFullYear();
    if (!m[2] && mo > now.getMonth() + 1) y -= 1;
    return y + '-' + pad2_(mo);
  }
  return currentMonth_();
}

async function handleMessage(msg) {
  const chatId = msg.chat.id, uid = msg.from.id, text = msg.text.trim();
  const cmd = text.startsWith('/') ? text.split(/\s+/)[0].split('@')[0].toLowerCase() : null;
  const arg = cmd ? text.split(/\s+/).slice(1).join(' ') : '';

  if (cmd === '/start' || cmd === '/id') {
    return sendMessage(chatId, '👋 Telegram User ID của bạn: <code>' + uid + '</code>\n' +
      'Dán số này vào cột <b>tg_id</b> của bảng <b>members</b> (Supabase) đúng dòng tên bạn để bắt đầu dùng.\n\n' + HELP_TEXT);
  }

  const data = await db.loadData();
  const me = memberByTg(data.members, uid);
  if (!me) return sendMessage(chatId, '🔒 Bạn chưa được cấp quyền. ID: <code>' + uid + '</code>');

  switch (cmd) {
    case null: return handleEntries(chatId, uid, me, text, data);
    case '/help': return sendMessage(chatId, HELP_TEXT);
    case '/bc': case '/baocao': return sendMessage(chatId, monthSummaryText_(monthReport_(monthArg(arg), data)));
    case '/ns': return sendMessage(chatId, budgetText_(monthReport_(monthArg(arg), data)));
    case '/no': {
      const ds = debtStatus_(data, currentMonth_());
      return sendMessage(chatId, debtText_(ds, assetStatus_(data, ds.totalRemaining)));
    }
    case '/hom': return sendMessage(chatId, todayText_(data));
    case '/dm': return sendMessage(chatId, categoriesText_(data));
    case '/xoa': case '/undo': {
      const last = await db.lastTxBy('tg:' + uid);
      if (!last) return sendMessage(chatId, 'Không có giao dịch nào của bạn để xoá.');
      await db.deleteTransaction(last.id);
      return sendMessage(chatId, '🗑 Đã xoá: ' + esc_(txLine_(last)));
    }
    default: return sendMessage(chatId, 'Không hiểu lệnh. Gõ /help');
  }
}

async function handleEntries(chatId, uid, me, text, data) {
  const ctx = { person: me.name, cats: data.cats, debts: data.debts, members: data.members, today: today_() };
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const results = [];
  for (const line of lines) {
    const p = parseLine_(line, ctx);
    if (p.error) { results.push({ line, error: p.error }); continue; }
    try { results.push({ line, tx: await db.addTransaction(p.tx, 'Telegram', 'tg:' + uid, data) }); }
    catch (err) { results.push({ line, error: err.message }); }
  }
  const fresh = await db.loadData();
  for (const r of results) {
    if (r.error) await sendMessage(chatId, '⚠️ <i>' + esc_(r.line) + '</i>\n' + esc_(r.error) + '\n\nGõ /help để xem cách ghi.');
    else await sendMessage(chatId, txConfirmText_(r.tx, fresh), txKeyboard_(r.tx));
  }
}

async function handleCallback(q) {
  const data = await db.loadData();
  const chatId = q.message.chat.id, msgId = q.message.message_id;
  if (!memberByTg(data.members, q.from.id)) return answerCallback(q.id, 'Chưa được cấp quyền');

  const [action, id, idx] = String(q.data || '').split(':');
  const tx = data.txs.find(t => t.id === id);
  if (!tx) {
    await answerCallback(q.id, 'Giao dịch không còn tồn tại');
    return editMessage(chatId, msgId, esc_(q.message.text || '') + '\n\n(đã xoá)');
  }
  if (action === 'del') {
    await db.deleteTransaction(id);
    await answerCallback(q.id, 'Đã xoá');
    return editMessage(chatId, msgId, '🗑 <s>' + esc_(txLine_(tx)) + '</s>\nĐã xoá.');
  }
  if (action === 'chg') {
    const cats = data.cats.filter(c => c.type === tx.type);
    const rows = [];
    cats.forEach((c, i) => {
      if (i % 2 === 0) rows.push([]);
      rows[rows.length - 1].push({ text: (c.icon ? c.icon + ' ' : '') + c.name, callback_data: 'set:' + id + ':' + i });
    });
    rows.push([{ text: '↩️ Giữ nguyên', callback_data: 'keep:' + id }]);
    await answerCallback(q.id, '');
    return editMarkup(chatId, msgId, { inline_keyboard: rows });
  }
  if (action === 'set') {
    const cat = data.cats.filter(c => c.type === tx.type)[Number(idx)];
    if (cat) {
      await db.updateTxCategory(id, cat.name);
      tx.category = cat.name;
      await db.learnKeyword(tx.type, cat.name, tx.note);
    }
    await answerCallback(q.id, 'Đã đổi sang ' + (cat ? cat.name : '?'));
    return editMessage(chatId, msgId, txConfirmText_(tx, await db.loadData()), txKeyboard_(tx));
  }
  if (action === 'keep') {
    await answerCallback(q.id, '');
    return editMarkup(chatId, msgId, txKeyboard_(tx));
  }
  return answerCallback(q.id, '');
}

// ---------- Chạy hằng ngày (Vercel Cron ~21h giờ VN) ----------
/**
 * - Cảnh báo danh mục chạm 80% / vượt 100% ngân sách (mỗi mức 1 lần/tháng)
 * - Nhắc hạn trả lãi năm (30/14/7/3/1/0 ngày; quá hạn: 3 ngày/lần)
 * - Nhắc nếu hôm nay chưa ai ghi khoản nào
 * - Ngày 1: gửi tổng kết tháng trước
 */
export async function dailyJob() {
  if (!process.env.TELEGRAM_TOKEN) return { skipped: 'no TELEGRAM_TOKEN' };
  const data = await db.loadData();
  const month = currentMonth_();
  const rep = monthReport_(month, data);
  const sent = [];

  let state = (await db.getState('alert_state')) || {};
  if (state.month !== month) state = { month, sent: {} };
  state.sent = Object.assign(Object.create(null), state.sent);

  const lines = [];
  rep.categories.forEach(c => {
    const level = c.status === 'over' ? 2 : c.status === 'warn' ? 1 : 0;
    if (level > (state.sent[c.name] || 0)) {
      lines.push((level === 2 ? '🔴 ' : '🟡 ') + esc_(c.name) + ': ' + fmtShort_(c.actual) + '/' + fmtShort_(c.budget) + ' (' + pctStr_(c.pct) + ')');
      state.sent[c.name] = level;
    }
  });
  rep.annual.filter(a => a.status === 'over' && !state.sent['năm:' + a.name]).forEach(a => {
    lines.push('🔴 ' + esc_(a.name) + ' (ngân sách năm): ' + fmtShort_(a.ytd) + '/' + fmtShort_(a.budgetYear));
    state.sent['năm:' + a.name] = 2;
  });
  if (lines.length) {
    await broadcast('⚠️ <b>Cảnh báo ngân sách tháng ' + rep.label + '</b>\n' + lines.join('\n') + '\n\nXem chi tiết: /ns', data);
    sent.push('budget');
  }

  for (const a of rep.debts.annualDues) {
    if (a.daysLeft >= 0 && !INTEREST_REMIND_DAYS.includes(a.daysLeft)) continue;
    if (a.daysLeft < 0 && a.daysLeft % 3 !== 0) continue;
    const when = a.due.split('-').reverse().join('/');
    await broadcast('🗓 <b>' + (a.daysLeft < 0 ? 'QUÁ HẠN' : a.daysLeft === 0 ? 'HÔM NAY' : 'Còn ' + a.daysLeft + ' ngày') +
      '</b> trả lãi năm ' + esc_(a.name) + ': <b>' + fmtShort_(a.amount) + '</b> (hạn ' + when + ')' +
      (a.estimated ? '\n<i>Số ước tính = dư nợ × lãi suất, sửa ở bảng debts nếu khác.</i>' : '') +
      '\nKhi trả, nhắn: <code>trả lãi ' + esc_(a.name.toLowerCase()) + ' ' + Math.round(a.amount / 1e6) + 'tr</code>', data);
    sent.push('interest:' + a.code);
  }

  const todayKey = isoDate_(today_());
  const remind = await db.getState('daily_remind');
  if (remind !== 'off' && !data.txs.some(t => isoDate_(t.date) === todayKey)) {
    await broadcast('📝 Hôm nay nhà mình chưa ghi khoản nào. Có chi gì thì nhắn luôn nhé (VD: <code>chi ăn sáng 50k</code>).', data);
    sent.push('remind');
  }

  if (nowVN_().getDate() === 1) {
    await broadcast(monthSummaryText_(monthReport_(addMonths_(month, -1), data), true), data);
    sent.push('monthly');
  }

  await db.setState('alert_state', state);
  return { ok: true, sent };
}
