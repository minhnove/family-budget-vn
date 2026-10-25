/** Nội dung tin nhắn Telegram (thuần văn bản HTML của Telegram). */
import {
  TYPES, TYPE_LIST, DEBT_DONE, WARN_PCT,
  fmt_, fmtShort_, pctStr_, esc_, sum_, viDate_, isoDate_, today_, monthLabel_,
} from '../public/js/shared.js';
import { budgetMap_, debtStatus_, summarize_ } from './report.js';

export const HELP_TEXT = [
  '<b>Cú pháp</b>: <code>[ngày] Thu/Chi + nội dung + số tiền</code> (mỗi dòng 1 khoản, gửi nhiều dòng cùng lúc được)',
  '• <code>chi ăn sáng 50k</code> · <code>15/3 chi đi chợ 350k</code>',
  '• <code>thu lương 25tr</code> · <code>thu thưởng 2tr5</code>',
  '• <code>hôm qua chi xăng 100k #mẹ</code> · <code>chi sữa bỉm 450k #bé</code> → ghi cho người khác',
  '• <code>trả nợ ngân hàng 10tr</code> → trả gốc · <code>trả lãi ngân hàng 4tr</code> → trả lãi',
  '• <code>vay người thân 10tr</code> · <code>cho vay 2tr</code> · <code>thu hồi 2tr</code>',
  '• <code>chi bảo hiểm 10tr</code> → khoản theo năm (so với ngân sách năm)',
  '',
  'Bỏ ngày = hôm nay, bỏ Thu/Chi = Chi. Số tiền: 50k, 1tr2 (=1,2tr), 2,5tr, 1.500.000.',
  'Danh mục tự nhận theo <i>từ khoá</i>. Sai thì bấm "Đổi danh mục" — bot sẽ tự học.',
  '',
  '<b>Lệnh</b>: /bc báo cáo tháng (/bc 9) · /ns ngân sách · /no nợ · /hom hôm nay · /xoa xoá khoản vừa ghi · /dm danh mục',
].join('\n');

/** Webhook: Telegram gọi vào đây */

export function txLine_(t) {
  return t.type + ' ' + fmt_(t.amount) + ' · ' + t.category + (t.note ? ' · ' + t.note : '');
}

export function txConfirmText_(tx, data) {
  const icon = { 'Chi': '💸', 'Thu': '💰', 'Trả nợ': '✅', 'Vay': '🏦', 'Cho vay': '🤝', 'Thu hồi nợ': '↩️' }[tx.type] || '•';
  const lines = [
    icon + ' <b>' + tx.type + ' ' + fmt_(tx.amount) + '</b>',
    '📂 ' + esc_(tx.category) + ' · 👤 ' + esc_(tx.person) + ' · 📅 ' + viDate_(tx.date),
  ];
  if (tx.note) lines.push('📝 ' + esc_(tx.note));

  const yearly = data.cats.filter(c => c.type === TYPES.CHI && c.name === tx.category && c.budgetYear > 0)[0];
  if (tx.type === TYPES.CHI && yearly) {
    const y = tx.month.slice(0, 4);
    const ytd = sum_(data.txs.filter(t => t.type === TYPES.CHI && t.category === tx.category && t.month.slice(0, 4) === y), t => t.amount);
    const flag = ytd > yearly.budgetYear ? '🔴 VƯỢT ngân sách năm' : '🗓';
    lines.push('\n' + flag + ' ' + esc_(tx.category) + ' năm ' + y + ': ' + fmtShort_(ytd) + ' / ' + fmtShort_(yearly.budgetYear) + ' (' + pctStr_(ytd / yearly.budgetYear) + ')');
  } else if (tx.type === TYPES.CHI) {
    const budget = budgetMap_(tx.month, data.cats, data.overrides)[tx.category] || 0;
    const spent = sum_(data.txs.filter(t => t.month === tx.month && t.type === TYPES.CHI && t.category === tx.category), t => t.amount);
    if (budget) {
      const pct = spent / budget;
      const flag = pct > 1 ? '🔴 VƯỢT ngân sách' : spent === budget ? '✅ đủ ngân sách' : pct >= WARN_PCT ? '🟡 sắp chạm ngân sách' : '🟢';
      lines.push('\n' + flag + ' ' + esc_(tx.category) + ' tháng này: ' + fmtShort_(spent) + ' / ' + fmtShort_(budget) + ' (' + pctStr_(pct) + ')');
    } else {
      lines.push('\n' + esc_(tx.category) + ' tháng này: ' + fmtShort_(spent));
    }
  }
  if (tx.debt) {
    const d = debtStatus_(data, tx.month).list.filter(x => x.code === tx.debt)[0];
    if (d) lines.push('\n🏦 ' + esc_(d.name) + ' còn: <b>' + fmtShort_(d.remaining) + '</b>');
  }
  return lines.join('\n');
}

export function txKeyboard_(tx) {
  return { inline_keyboard: [[
    { text: '🗑 Xoá', callback_data: 'del:' + tx.id },
    { text: '📂 Đổi danh mục', callback_data: 'chg:' + tx.id },
  ]] };
}

export function cmpText_(cur, base, goodWhenUp) {
  if (base == null || !base) return '';
  const d = (cur - base) / base;
  const arrow = d >= 0 ? '↑' : '↓';
  const good = goodWhenUp ? d >= 0 : d <= 0;
  return ' ' + (Math.abs(d) < 0.03 ? '≈' : (good ? '🟢' : '🔴') + arrow + Math.round(Math.abs(d) * 100) + '%');
}

export function monthSummaryText_(rep, isRecap) {
  const t = rep.totals, b = rep.baseline;
  const L = [];
  L.push((isRecap ? '📅 <b>Tổng kết tháng ' : '📊 <b>Tháng ') + rep.label + '</b>' + (rep.day ? ' (ngày ' + rep.day + '/' + rep.days + ')' : ''));
  L.push('');
  L.push('💰 Thu: <b>' + fmtShort_(t.thu) + '</b>' + (t.thuPlan ? ' / KH ' + fmtShort_(t.thuPlan) + ' (' + pctStr_(t.thu / t.thuPlan) + ')' : '') +
    (b ? ' · TB3T ' + fmtShort_(b.thu) + cmpText_(t.thu, b.thu, true) : ''));
  L.push('💸 Chi: <b>' + fmtShort_(t.chi) + '</b>' +
    (t.chiAnnual ? ' (thường xuyên ' + fmtShort_(t.chiRegular) + ' + khoản theo năm ' + fmtShort_(t.chiAnnual) + ')' : ''));
  if (rep.day) L.push('   Dự phóng chi thường xuyên cả tháng: ' + fmtShort_(t.projectedRegular));
  if (rep.budgetTotal) L.push('   Ngân sách tháng: ' + fmtShort_(rep.budgetTotal) + ' (đã dùng ' + pctStr_(t.chiRegular / rep.budgetTotal) + ')' +
    (b && b.chiRegular ? ' · TB3T ' + fmtShort_(b.chiRegular) + cmpText_(t.projectedRegular, b.chiRegular, false) : ''));
  L.push('✅ Trả nợ: <b>' + fmtShort_(t.traNo) + '</b> (gốc ' + fmtShort_(t.traGoc) + ', lãi ' + fmtShort_(t.traLai) + ')' +
    (b ? cmpText_(t.traNo, b.traNo, true) : ''));
  if (t.vay) L.push('🏦 Vay thêm: ' + fmtShort_(t.vay));
  L.push('➖ Dư sau chi tiêu (Thu − Chi): <b>' + fmtShort_(t.surplus) + '</b>');
  L.push('🔁 Dòng tiền ròng: <b>' + fmtShort_(t.net) + '</b>');
  if (t.debtRatio != null) L.push('📐 Trả nợ/Thu nhập: ' + pctStr_(t.debtRatio));
  L.push('💳 Tổng dư nợ: <b>' + fmtShort_(rep.debts.totalRemaining) + '</b>' +
    (rep.debts.etaMonths ? ' · hết nợ sau ~' + rep.debts.etaMonths + ' tháng' : ''));
  if (rep.debts.interestSavePerMonth) L.push('🐷 Để dành cho lãi trả theo năm: ~' + fmtShort_(rep.debts.interestSavePerMonth) + '/tháng');
  if (rep.assets.total) L.push('🏠 Tài sản ròng: <b>' + fmtShort_(rep.assets.netWorth) + '</b>');
  if (rep.prev) L.push('\nSo với tháng trước: chi thường xuyên ' + fmtShort_(rep.prev.chiRegular) + cmpText_(t.chiRegular, rep.prev.chiRegular, false) +
    ', trả nợ ' + fmtShort_(rep.prev.traNo) + cmpText_(t.traNo, rep.prev.traNo, true));

  if (rep.alerts.length) {
    L.push('\n<b>Cảnh báo</b>');
    rep.alerts.slice(0, 8).forEach(a => L.push((a.level === 'bad' ? '🔴 ' : '🟡 ') + esc_(a.text)));
  }
  const top = rep.categories.filter(c => c.actual).sort((a, b) => b.actual - a.actual).slice(0, 5);
  if (top.length) {
    L.push('\n<b>Top chi tiêu</b>');
    top.forEach(c => L.push('• ' + esc_(c.name) + ': ' + fmtShort_(c.actual) + (c.budget ? ' / ' + fmtShort_(c.budget) : '')));
  }
  if (!rep.baseline) L.push('\n<i>Chưa đủ dữ liệu tháng trước để so baseline.</i>');
  return L.join('\n');
}

export function budgetText_(rep) {
  const L = ['🎯 <b>Ngân sách tháng ' + rep.label + '</b>' + (rep.day ? ' — đã qua ' + pctStr_(rep.progress) + ' tháng' : ''), ''];
  rep.categories.filter(c => c.budget).forEach(c => {
    const icon = c.status === 'over' ? '🔴' : c.status === 'warn' || c.status === 'pace' ? '🟡' : c.status === 'full' ? '✅' : '🟢';
    L.push(icon + ' ' + esc_(c.name) + ': ' + fmtShort_(c.actual) + '/' + fmtShort_(c.budget) + ' (' + pctStr_(c.pct) + ')' +
      (c.remaining > 0 ? ' · còn ' + fmtShort_(c.remaining) : ''));
  });
  const nob = rep.categories.filter(c => !c.budget && c.actual);
  nob.forEach(c => L.push('⚪ ' + esc_(c.name) + ': ' + fmtShort_(c.actual) + ' (chưa đặt ngân sách)'));
  L.push('\nTổng chi thường xuyên: ' + fmtShort_(rep.totals.chiRegular) + ' / ' + fmtShort_(rep.budgetTotal));
  if (rep.annual.length) {
    L.push('\n🗓 <b>Khoản theo năm ' + rep.month.slice(0, 4) + '</b> (nên để dành ~' + fmtShort_(rep.annualSaving) + '/tháng)');
    rep.annual.forEach(a => L.push((a.status === 'over' ? '🔴 ' : '• ') + esc_(a.name) + ': ' + fmtShort_(a.ytd) + '/' + fmtShort_(a.budgetYear) + ' (' + pctStr_(a.pct) + ')'));
  }
  return L.join('\n');
}

export function debtText_(ds, assets) {
  if (!ds.list.length) return 'Chưa có khoản nợ nào trong sheet "Khoản nợ".';
  const L = [];
  if (assets && assets.total) {
    L.push('🏠 <b>Tài sản ròng: ' + fmtShort_(assets.netWorth) + '</b>');
    L.push('Tài sản ' + fmtShort_(assets.total) + ' − Nợ ' + fmtShort_(assets.debtTotal) + ' (nợ = ' + pctStr_(assets.debtToAsset) + ' tài sản)');
    assets.list.forEach(a => L.push('• ' + esc_(a.name) + ': ' + fmtShort_(a.value) +
      (a.qty && a.unit ? ' (' + String(a.qty).replace('.', ',') + ' ' + esc_(a.unit) + ')' : '') + (a.included ? '' : ' — không tính')));
    L.push('');
  }
  const head = L.length;
  L.push('💳 <b>Tổng dư nợ: ' + fmtShort_(ds.totalRemaining) + '</b>',
    'Tháng này đã trả: gốc ' + fmtShort_(ds.monthGoc) + ', lãi ' + fmtShort_(ds.monthLai),
    'Lãi phát sinh ước tính: ~' + fmtShort_(ds.monthlyInterest) + '/tháng',
    ds.etaMonths ? 'Với tốc độ trả gốc TB ' + fmtShort_(ds.avgGoc) + '/tháng → hết nợ sau ~' + ds.etaMonths + ' tháng' : '', '');
  ds.list.forEach((d, i) => {
    if (d.remaining <= 0) { L.push('✅ ' + esc_(d.name) + ' — đã tất toán'); return; }
    L.push((i + 1) + '. <b>' + esc_(d.name) + '</b> (' + d.code + ')');
    L.push('   Còn ' + fmtShort_(d.remaining) + ' · ' + String(d.rate).replace('.', ',') + '%/năm · đã trả ' + pctStr_(d.paidPct) +
      (d.etaMonths ? ' · ~' + d.etaMonths + ' tháng (' + monthLabel_(d.etaMonth) + ')' : ''));
    if (d.belowMin) L.push('   🔴 Tháng này trả chưa đủ mức tối thiểu ' + fmtShort_(d.minPay));
    const ai = d.annualInterest;
    if (ai) L.push('   🗓 Lãi năm kỳ tới: <b>' + fmtShort_(ai.amount) + '</b>' + (ai.estimated ? ' (ước tính)' : '') +
      ' hạn ' + ai.due.split('-').reverse().join('/') + ' (còn ' + ai.daysLeft + ' ngày) · ' +
      (ai.dueSoon ? 'cần chuẩn bị đủ tiền trước hạn' : 'cần để dành ~' + fmtShort_(ai.savePerMonth) + '/tháng'));
  });
  if (ds.interestSavePerMonth) L.push('\n🐷 Để dành cho lãi trả theo năm: ~' + fmtShort_(ds.interestSavePerMonth) + '/tháng');
  if (ds.priority) L.push('\n💡 Có tiền dư thì ưu tiên trả thêm: <b>' + esc_(ds.priority) + '</b> (lãi suất cao nhất).' +
    (ds.priorityAlt ? '\nNếu khoản này không nhận trả bớt gốc giữa kỳ thì trả thêm vào <b>' + esc_(ds.priorityAlt) + '</b>.' : ''));
  return L.filter((x, i) => x !== '' || i !== head + 3).join('\n');
}

export function todayText_(data) {
  const key = isoDate_(today_());
  const txs = data.txs.filter(t => isoDate_(t.date) === key);
  if (!txs.length) return 'Hôm nay chưa ghi khoản nào.';
  const L = ['📒 <b>Hôm nay</b>'];
  txs.forEach(t => L.push('• ' + esc_(t.person) + ': ' + esc_(txLine_(t))));
  const s = summarize_(txs);
  L.push('\nChi ' + fmtShort_(s.chi) + ' · Thu ' + fmtShort_(s.thu) + ' · Trả nợ ' + fmtShort_(s.traNo));
  return L.join('\n');
}

export function categoriesText_(data) {
  const L = [];
  TYPE_LIST.forEach(type => {
    const cats = data.cats.filter(c => c.type === type);
    if (!cats.length) return;
    L.push('<b>' + type + '</b>');
    cats.forEach(c => L.push('• ' + esc_(c.name) + (c.budget ? ' (' + fmtShort_(c.budget) + ')' : '') +
      (c.keywords.length > 1 ? ': <i>' + esc_(c.keywords.slice(0, 6).join(', ')) + '</i>' : '')));
  });
  const debts = data.debts.filter(d => d.status !== DEBT_DONE);
  if (debts.length) {
    L.push('<b>Khoản nợ</b>');
    debts.forEach(d => L.push('• ' + d.code + ' — ' + esc_(d.name) + ': <i>' + esc_(d.keywords.slice(0, 4).join(', ')) + '</i>'));
  }
  return L.join('\n');
}
