/** Tính toán báo cáo: tháng, năm, nợ, tài sản, xu hướng. Hàm thuần — nhận `data` từ db.loadData(). */
import {
  TYPES, CAT_LAI, DEBT_DONE, ASSET_RECEIVABLE, WARN_PCT, PACE_PCT, BASELINE_MONTHS,
  fmtShort_, pctStr_, pad2_, sum_, groupBy_, sumBy_, uniq_,
  nowVN_, today_, monthKey_, currentMonth_, isoDate_, addMonths_, monthLabel_, daysInMonth_, monthProgress_,
} from '../public/js/shared.js';

/** Ngân sách theo danh mục cho 1 tháng (mặc định ở bảng categories + ghi đè ở budget_overrides) */
export function budgetMap_(month, cats, overrides) {
  const m = Object.create(null);
  cats.filter(c => c.type === TYPES.CHI).forEach(c => { m[c.name] = c.budget; });
  (overrides || []).filter(o => o.month === month).forEach(o => { m[o.name] = o.budget; });
  return m;
}

export const SUM_KEYS = ['thu', 'chi', 'vay', 'traNo', 'traGoc', 'traLai', 'choVay', 'thuHoi', 'surplus', 'net'];

/** Tổng hợp 1 tập giao dịch */
export function summarize_(txs) {
  const s = { thu: 0, chi: 0, vay: 0, traNo: 0, traGoc: 0, traLai: 0, choVay: 0, thuHoi: 0, count: txs.length };
  txs.forEach(t => {
    switch (t.type) {
      case TYPES.THU: s.thu += t.amount; break;
      case TYPES.CHI: s.chi += t.amount; break;
      case TYPES.VAY: s.vay += t.amount; break;
      case TYPES.TRA_NO:
        s.traNo += t.amount;
        if (t.category === CAT_LAI) s.traLai += t.amount; else s.traGoc += t.amount;
        break;
      case TYPES.CHO_VAY: s.choVay += t.amount; break;
      case TYPES.THU_HOI: s.thuHoi += t.amount; break;
    }
  });
  s.surplus = s.thu - s.chi;  // dư sau chi tiêu = sức trả nợ
  s.net = s.thu + s.vay + s.thuHoi - s.chi - s.traNo - s.choVay;  // dòng tiền ròng
  s.debtRatio = s.thu ? s.traNo / s.thu : null;   // % thu nhập dùng trả nợ
  s.spendRatio = s.thu ? s.chi / s.thu : null;    // % thu nhập bị chi tiêu
  return s;
}

export function avgSummaries_(list) {
  const r = { months: list.length };
  SUM_KEYS.forEach(k => { r[k] = sum_(list, s => s[k]) / list.length; });
  r.debtRatio = r.thu ? r.traNo / r.thu : null;
  r.spendRatio = r.thu ? r.chi / r.thu : null;
  return r;
}

/** N tháng liền trước có dữ liệu (tối đa BASELINE_MONTHS) */
export function baselineKeys_(month, byM) {
  const keys = [];
  for (let i = 1; i <= BASELINE_MONTHS; i++) {
    const k = addMonths_(month, -i);
    if (byM[k] && byM[k].length) keys.push(k);
  }
  return keys;
}

export const isChi_ = t => t.type === TYPES.CHI;

/** Báo cáo 1 tháng */
export function monthReport_(month, data) {
  const byM = groupBy_(data.txs, t => t.month);
  const cur = byM[month] || [];
  const prevKey = addMonths_(month, -1);
  const totals = summarize_(cur);
  const prev = byM[prevKey] ? summarize_(byM[prevKey]) : null;
  const baseKeys = baselineKeys_(month, byM);
  const baseline = baseKeys.length ? avgSummaries_(baseKeys.map(k => summarize_(byM[k]))) : null;
  const progress = monthProgress_(month);
  const inProgress = progress > 0 && progress < 1;

  // Khoản theo năm (BHNT, du lịch...) tách riêng: không dự phóng, không tính vào ngân sách tháng
  const annualCats = data.cats.filter(c => c.type === TYPES.CHI && c.budgetYear > 0);
  const annualNames = annualCats.map(c => c.name);
  const chiRegularOf = (txs) => sum_(txs.filter(t => isChi_(t) && annualNames.indexOf(t.category) < 0), t => t.amount);
  totals.chiRegular = chiRegularOf(cur);
  totals.chiAnnual = totals.chi - totals.chiRegular;
  totals.projectedRegular = inProgress ? totals.chiRegular / progress : totals.chiRegular;
  totals.projectedChi = totals.projectedRegular + totals.chiAnnual;
  totals.thuPlan = sum_(data.cats.filter(c => c.type === TYPES.THU), c => c.budget);
  if (prev) prev.chiRegular = chiRegularOf(byM[prevKey]);
  if (baseline) baseline.chiRegular = sum_(baseKeys, k => chiRegularOf(byM[k])) / baseKeys.length;

  // --- Theo danh mục chi ---
  const budgets = budgetMap_(month, data.cats, data.overrides);
  const catMeta = Object.create(null);
  data.cats.filter(c => c.type === TYPES.CHI && c.budgetYear <= 0).forEach(c => { catMeta[c.name] = c; });
  const chiCur = sumBy_(cur.filter(isChi_), t => t.category);
  const chiPrev = sumBy_((byM[prevKey] || []).filter(isChi_), t => t.category);
  const chiBase = Object.create(null);
  baseKeys.forEach(k => {
    const s = sumBy_(byM[k].filter(isChi_), t => t.category);
    Object.keys(s).forEach(c => { chiBase[c] = (chiBase[c] || 0) + s[c] / baseKeys.length; });
  });

  // Dự phóng hết tháng = đã chi + phần các tháng trước thường chi SAU ngày hôm nay.
  // Khoản cố định trả đầu tháng (biếu bố mẹ, học phí, điện nước) vì vậy không bị nhân lên.
  // Chưa có lịch sử thì tạm chia đều theo ngày (và không cảnh báo "chi nhanh").
  const hasHistory = baseKeys.length > 0;
  const dayNow = inProgress ? nowVN_().getDate() : 0;
  const afterDay = Object.create(null);
  if (inProgress && hasHistory) {
    baseKeys.forEach(k => {
      const s = sumBy_(byM[k].filter(t => isChi_(t) && t.date.getDate() > dayNow), t => t.category);
      Object.keys(s).forEach(c => { afterDay[c] = (afterDay[c] || 0) + s[c] / baseKeys.length; });
    });
  }
  const projectOf = (name, actual) => !inProgress ? actual : hasHistory ? actual + (afterDay[name] || 0) : actual / progress;

  const names = uniq_(Object.keys(catMeta).concat(Object.keys(chiCur))).filter(n => annualNames.indexOf(n) < 0);
  const categories = names.map(name => {
    const actual = chiCur[name] || 0;
    const budget = budgets[name] || 0;
    const base = baseKeys.length ? (chiBase[name] || 0) : null;
    const projected = projectOf(name, actual);
    let status = 'ok';
    if (budget > 0) {
      if (actual > budget) status = 'over';
      else if (actual === budget) status = 'full';   // khoản cố định chi đủ (VD biếu bố mẹ)
      else if (actual >= budget * WARN_PCT) status = 'warn';
      else if (inProgress && hasHistory && progress >= 0.25 && projected > budget * PACE_PCT) status = 'pace';
    } else if (actual > 0) status = 'nobudget';
    const cmpVal = inProgress ? projected : actual;
    return {
      name: name,
      group: catMeta[name] ? catMeta[name].group : '',
      actual: actual,
      budget: budget,
      pct: budget ? actual / budget : null,
      projected: projected,
      remaining: budget ? budget - actual : null,
      status: status,
      baseline: base,
      vsBaseline: base ? (cmpVal - base) / base : null,
      prev: chiPrev[name] || 0,
    };
  }).filter(r => r.actual || r.budget || r.baseline);
  categories.sort((a, b) => (b.pct || 0) - (a.pct || 0) || b.actual - a.actual);

  const budgetTotal = sum_(categories, c => c.budget);
  if (inProgress) {
    totals.projectedRegular = sum_(categories, c => c.projected);
    totals.projectedChi = totals.projectedRegular + totals.chiAnnual;
  }
  totals.hasHistory = hasHistory;

  // --- Khoản theo năm: so luỹ kế từ đầu năm với ngân sách năm ---
  const year = month.slice(0, 4);
  const annual = annualCats.map(c => {
    const ytd = sum_(data.txs.filter(t => isChi_(t) && t.category === c.name && t.month.slice(0, 4) === year && t.month <= month), t => t.amount);
    return {
      name: c.name, budgetYear: c.budgetYear, ytd: ytd, actual: chiCur[c.name] || 0,
      pct: ytd / c.budgetYear, remaining: c.budgetYear - ytd,
      status: ytd > c.budgetYear ? 'over' : 'ok',
      monthlySaving: c.budgetYear / 12,
    };
  });

  // --- Theo nhóm (Thiết yếu / Linh hoạt) ---
  const byGroup = sumBy_(cur.filter(isChi_), t => (catMeta[t.category] && catMeta[t.category].group) || 'Khác');

  // --- Theo người ---
  const people = uniq_(data.members.map(m => m.name).concat(cur.map(t => t.person)));
  const byPerson = people.map(p => {
    const s = summarize_(cur.filter(t => t.person === p));
    return { name: p, thu: s.thu, chi: s.chi, traNo: s.traNo, count: s.count };
  }).filter(p => p.count);

  // --- Thu theo danh mục ---
  const income = Object.entries(sumBy_(cur.filter(t => t.type === TYPES.THU), t => t.category + ' · ' + t.person))
    .map(e => ({ name: e[0], amount: e[1] })).sort((a, b) => b.amount - a.amount);

  const debts = debtStatus_(data, month);

  // --- Cảnh báo ---
  const alerts = [];
  categories.forEach(c => {
    if (c.status === 'over') alerts.push({ level: 'bad', text: c.name + ' đã vượt ngân sách: ' + fmtShort_(c.actual) + '/' + fmtShort_(c.budget) + ' (' + pctStr_(c.pct) + ')' });
    else if (c.status === 'warn') alerts.push({ level: 'warn', text: c.name + ' đã dùng ' + pctStr_(c.pct) + ' ngân sách, còn ' + fmtShort_(c.remaining) });
    else if (c.status === 'pace') alerts.push({ level: 'warn', text: c.name + ' đang chi nhanh: dự phóng ' + fmtShort_(c.projected) + ' > ngân sách ' + fmtShort_(c.budget) });
  });
  annual.filter(a => a.status === 'over').forEach(a => {
    alerts.push({ level: 'bad', text: a.name + ' năm ' + year + ' đã vượt: ' + fmtShort_(a.ytd) + '/' + fmtShort_(a.budgetYear) });
  });
  if (budgetTotal && (!inProgress || hasHistory) && totals.projectedRegular > budgetTotal * PACE_PCT) {
    alerts.unshift({ level: 'bad', text: 'Chi thường xuyên ' + (inProgress ? 'dự phóng ' : '') + fmtShort_(totals.projectedRegular) + ' vượt tổng ngân sách tháng ' + fmtShort_(budgetTotal) });
  }
  if (baseline && baseline.chiRegular && totals.projectedRegular > baseline.chiRegular * 1.1) {
    alerts.push({ level: 'warn', text: 'Chi thường xuyên ' + (inProgress ? 'dự phóng ' : '') + 'cao hơn TB 3 tháng ' + pctStr_(totals.projectedRegular / baseline.chiRegular - 1) });
  }
  if (month === currentMonth_()) {
    debts.annualDues.filter(a => a.daysLeft <= 30).forEach(a => {
      const when = a.due.split('-').reverse().join('/');
      alerts.unshift(a.daysLeft < 0
        ? { level: 'bad', text: 'Quá hạn trả lãi ' + a.name + ' (' + when + '): ' + fmtShort_(a.amount) }
        : { level: 'warn', text: 'Sắp đến hạn trả lãi ' + a.name + ': ' + fmtShort_(a.amount) + ' vào ' + when + ' (còn ' + a.daysLeft + ' ngày)' });
    });
  }
  if (!inProgress && totals.thuPlan && totals.thu < totals.thuPlan * 0.9) {
    alerts.push({ level: 'warn', text: 'Thu nhập thấp hơn kế hoạch: ' + fmtShort_(totals.thu) + '/' + fmtShort_(totals.thuPlan) });
  }
  if (!inProgress && totals.thu && totals.chi + totals.traNo > totals.thu) {
    alerts.push({ level: 'bad', text: 'Chi tiêu + trả nợ vượt thu nhập ' + fmtShort_(totals.chi + totals.traNo - totals.thu) });
  }

  return {
    month: month,
    label: monthLabel_(month),
    progress: progress,
    day: inProgress ? Math.round(progress * daysInMonth_(month)) : null,
    days: daysInMonth_(month),
    totals: totals,
    prev: prev,
    baseline: baseline,
    baselineMonths: baseKeys,
    budgetTotal: budgetTotal,
    categories: categories,
    annual: annual,
    annualSaving: sum_(annual, a => a.monthlySaving),
    assets: assetStatus_(data, debts.totalRemaining),
    byGroup: byGroup,
    byPerson: byPerson,
    income: income,
    debts: debts,
    alerts: alerts,
    trend: trend_(data, month, 12),
  };
}

/** Tình hình các khoản nợ tính đến hết tháng `month` */
export function debtStatus_(data, month) {
  const cur = currentMonth_();
  const avgEnd = month === cur && monthProgress_(month) < 1 ? addMonths_(month, -1) : month;
  const avgKeys = [0, 1, 2].map(i => addMonths_(avgEnd, -i));

  const rows = data.debts.map(d => {
    const startKey = d.start ? monthKey_(d.start) : null;
    const linked = data.txs.filter(t => t.debt === d.code && (!d.start || t.date >= d.start));
    const upto = linked.filter(t => t.month <= month);
    const borrowed = sum_(upto.filter(t => t.type === TYPES.VAY), t => t.amount);
    const goc = upto.filter(t => t.type === TYPES.TRA_NO && t.category !== CAT_LAI);
    const lai = upto.filter(t => t.type === TYPES.TRA_NO && t.category === CAT_LAI);
    const paidGoc = sum_(goc, t => t.amount);
    const paidLai = sum_(lai, t => t.amount);
    const initial = !startKey || startKey <= month ? d.initial : 0;
    const original = initial + borrowed;
    const remaining = Math.max(0, original - paidGoc);

    const inMonth = linked.filter(t => t.month === month);
    const monthGoc = sum_(inMonth.filter(t => t.type === TYPES.TRA_NO && t.category !== CAT_LAI), t => t.amount);
    const monthLai = sum_(inMonth.filter(t => t.type === TYPES.TRA_NO && t.category === CAT_LAI), t => t.amount);

    // Tháng bắt đầu theo dõi nếu không phải ngày 1 thì không đủ tháng -> bỏ khỏi trung bình
    const firstFull = d.start && d.start.getDate() > 1 ? addMonths_(startKey, 1) : startKey;
    let validAvgKeys = avgKeys.filter(k => !firstFull || k >= firstFull);
    if (!validAvgKeys.length && startKey <= month) validAvgKeys = [month];
    const avgGoc = validAvgKeys.length
      ? sum_(goc.filter(t => validAvgKeys.indexOf(t.month) >= 0), t => t.amount) / validAvgKeys.length : 0;
    const payRate = avgGoc || d.minPay;
    const eta = remaining > 0 && payRate > 0 ? Math.ceil(remaining / payRate) : (remaining > 0 ? null : 0);

    return {
      code: d.code, name: d.name, creditor: d.creditor, rate: d.rate, minPay: d.minPay,
      status: remaining <= 0 && original > 0 ? DEBT_DONE : d.status,
      start: d.start ? isoDate_(d.start) : null,
      original: original, remaining: remaining, paidGoc: paidGoc, paidLai: paidLai,
      paidPct: original ? paidGoc / original : null,
      monthGoc: monthGoc, monthLai: monthLai,
      avgGoc: avgGoc, etaMonths: eta, etaMonth: eta ? addMonths_(month, eta) : null,
      monthlyInterest: remaining * d.rate / 100 / 12,
      belowMin: d.minPay > 0 && month <= cur && monthProgress_(month) === 1 && monthGoc + monthLai < d.minPay,
      annualInterest: d.interestCycle === 'year' && remaining > 0 ? annualInterest_(d, data.txs, remaining) : null,
    };
  });

  const active = rows.filter(r => r.remaining > 0);
  active.sort((a, b) => b.rate - a.rate || a.remaining - b.remaining);
  const done = rows.filter(r => r.remaining <= 0);

  const total = sum_(active, r => r.remaining);
  // Tính cả khoản đã tất toán: tiền trước đây trả khoản đó sẽ chuyển sang trả khoản khác
  const avgGoc = sum_(rows, r => r.avgGoc);
  return {
    month: month,
    list: active.concat(done),
    totalRemaining: total,
    totalOriginal: sum_(rows, r => r.original),
    monthGoc: sum_(rows, r => r.monthGoc),
    monthLai: sum_(rows, r => r.monthLai),
    monthlyInterest: sum_(active, r => r.monthlyInterest),
    avgGoc: avgGoc,
    etaMonths: total > 0 && avgGoc > 0 ? Math.ceil(total / avgGoc) : null,
    priority: active.length ? active[0].name : null,  // Avalanche: lãi suất cao nhất trước
    // Nếu khoản ưu tiên tính lãi theo kỳ năm (có thể không nhận trả bớt gốc giữa kỳ) -> phương án thay thế
    priorityAlt: active.length && active[0].annualInterest
      ? ((active.filter(r => !r.annualInterest && r.rate > 0)[0] || {}).name || null) : null,
    // Lãi trả 1 lần/năm (VD vay người thân trả lãi cuối kỳ): hạn tiếp theo + số nên để dành mỗi tháng
    annualDues: active.filter(r => r.annualInterest).map(r => Object.assign({ code: r.code, name: r.name }, r.annualInterest))
      .sort((a, b) => a.daysLeft - b.daysLeft),
    interestSavePerMonth: sum_(active.filter(r => r.annualInterest && !r.annualInterest.dueSoon), r => r.annualInterest.savePerMonth),
    interestDueSoon: sum_(active.filter(r => r.annualInterest && r.annualInterest.dueSoon), r => r.annualInterest.amount),
  };
}

/**
 * Khoản trả lãi 1 lần/năm.
 * - Hạn tiếp theo: lấy từ sheet; nếu đã có giao dịch "Lãi" của khoản này trong ±45 ngày quanh hạn
 *   thì coi như đã trả và tự lùi sang hạn năm sau (không cần sửa sheet mỗi năm).
 * - Số tiền: dùng "Số lãi kỳ tới" nếu đúng là kỳ ghi trên sheet, các kỳ sau = dư nợ × lãi suất.
 */
export function annualInterest_(d, txs, remaining) {
  if (!d.nextDue) return null;
  const DAY = 864e5;
  const today = today_();
  const lai = txs.filter(t => t.debt === d.code && t.type === TYPES.TRA_NO && t.category === CAT_LAI);
  const paidNear = (due) => lai.filter(t => Math.abs(t.date - due) <= 45 * DAY);
  let due = d.nextDue, isSheetDue = true, lastPaid = null;
  for (let guard = 0; guard < 20; guard++) {
    const paid = paidNear(due);
    if (!paid.length) break;
    lastPaid = { date: isoDate_(due), amount: sum_(paid, t => t.amount) };
    due = new Date(due.getFullYear() + 1, due.getMonth(), due.getDate());
    isSheetDue = false;
  }
  const amount = isSheetDue && d.nextAmount ? d.nextAmount : Math.round(remaining * d.rate / 100);
  const daysLeft = Math.round((due - today) / DAY);
  const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30.4));
  return {
    due: isoDate_(due),
    amount: amount,
    daysLeft: daysLeft,
    monthsLeft: monthsLeft,
    // Dàn đều số lãi kỳ tới trên số tháng còn lại (tối đa 12)
    savePerMonth: daysLeft > 0 ? amount / Math.min(12, monthsLeft) : amount,
    dueSoon: daysLeft <= 31,   // còn ≤ 1 tháng: cần chuẩn bị đủ cả khoản, không phải "để dành mỗi tháng"
    estimated: !(isSheetDue && d.nextAmount),
    lastPaid: lastPaid,
  };
}

/** Tài sản hiện tại và tài sản ròng (= tài sản được tính − tổng dư nợ) */
export function assetStatus_(data, debtTotal) {
  const list = (data.assets || []).map(a => {
    let value = a.baseValue;
    if (a.type === ASSET_RECEIVABLE) {
      const after = data.txs.filter(t => !a.updated || t.date >= a.updated);
      value += sum_(after.filter(t => t.type === TYPES.CHO_VAY), t => t.amount) -
               sum_(after.filter(t => t.type === TYPES.THU_HOI), t => t.amount);
    }
    return { name: a.name, type: a.type, qty: a.qty, unit: a.unit, price: a.price, value: Math.max(0, value),
      included: a.included, updated: a.updated ? isoDate_(a.updated) : null, note: a.note };
  });
  const total = sum_(list.filter(a => a.included), a => a.value);
  return {
    list: list,
    total: total,
    excluded: sum_(list.filter(a => !a.included), a => a.value),
    debtTotal: debtTotal,
    netWorth: total - debtTotal,
    debtToAsset: total ? debtTotal / total : null,
  };
}

/** Tổng dư nợ cuối tháng `key` */
export function debtTotalAt_(data, key) {
  return sum_(data.debts, d => {
    const startKey = d.start ? monthKey_(d.start) : null;
    if (startKey && startKey > key) return 0;
    const linked = data.txs.filter(t => t.debt === d.code && t.month <= key && (!d.start || t.date >= d.start));
    const vay = sum_(linked.filter(t => t.type === TYPES.VAY), t => t.amount);
    const goc = sum_(linked.filter(t => t.type === TYPES.TRA_NO && t.category !== CAT_LAI), t => t.amount);
    return Math.max(0, d.initial + vay - goc);
  });
}

/** Xu hướng n tháng kết thúc ở `month` */
export function trend_(data, month, n) {
  const byM = groupBy_(data.txs, t => t.month);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = addMonths_(month, -i);
    const s = summarize_(byM[k] || []);
    out.push({ month: k, label: monthLabel_(k), thu: s.thu, chi: s.chi, traNo: s.traNo, traGoc: s.traGoc,
      surplus: s.surplus, net: s.net, debtEnd: debtTotalAt_(data, k), count: s.count });
  }
  return out;
}

/** Báo cáo năm */
export function yearReport_(year, data) {
  const cur = currentMonth_();
  const keys = [];
  for (let m = 1; m <= 12; m++) keys.push(year + '-' + pad2_(m));
  const byM = groupBy_(data.txs, t => t.month);
  const yearTx = data.txs.filter(t => t.date.getFullYear() === year);

  const months = keys.map(k => {
    const s = summarize_(byM[k] || []);
    return { month: k, label: monthLabel_(k), thu: s.thu, chi: s.chi, traNo: s.traNo, traGoc: s.traGoc, traLai: s.traLai,
      vay: s.vay, surplus: s.surplus, net: s.net, count: s.count,
      debtEnd: k <= cur ? debtTotalAt_(data, k) : null, budget: sum_(Object.values(budgetMap_(k, data.cats, data.overrides))) };
  });
  const withData = months.filter(m => m.count);
  const totals = summarize_(yearTx);
  const avg = withData.length ? avgSummaries_(withData.map(m => summarize_(byM[m.month]))) : null;

  const matrix = (type) => {
    const tx = yearTx.filter(t => t.type === type);
    const names = uniq_(data.cats.filter(c => c.type === type).map(c => c.name).concat(tx.map(t => t.category)));
    return names.map(name => {
      const cat = data.cats.filter(c => c.type === type && c.name === name)[0];
      const yearly = cat && cat.budgetYear > 0;
      const values = keys.map(k => sum_(tx.filter(t => t.month === k && t.category === name), t => t.amount));
      const budgets = keys.map(k => type === TYPES.CHI && !yearly ? (budgetMap_(k, data.cats, data.overrides)[name] || 0) : 0);
      const total = sum_(values);
      const budgetYtd = yearly ? cat.budgetYear : sum_(budgets.filter((b, i) => months[i].count));
      return { name: name, yearly: yearly, values: values, budgets: budgets, total: total,
        avg: withData.length ? total / withData.length : 0, budgetYtd: budgetYtd,
        pct: budgetYtd ? total / budgetYtd : null };
    }).filter(r => r.total || r.budgetYtd);
  };

  const people = uniq_(data.members.map(m => m.name).concat(yearTx.map(t => t.person)));
  const byPerson = people.map(p => {
    const s = summarize_(yearTx.filter(t => t.person === p));
    return { name: p, thu: s.thu, chi: s.chi, traNo: s.traNo, count: s.count };
  }).filter(p => p.count);

  const lastKey = year + '-12' < cur ? year + '-12' : cur;
  return {
    year: year,
    months: months,
    totals: totals,
    avg: avg,
    monthsWithData: withData.length,
    chiMatrix: matrix(TYPES.CHI).sort((a, b) => b.total - a.total),
    thuMatrix: matrix(TYPES.THU).sort((a, b) => b.total - a.total),
    byPerson: byPerson,
    debtStart: debtTotalAt_(data, (year - 1) + '-12'),
    debtEnd: debtTotalAt_(data, lastKey),
  };
}
