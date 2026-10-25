// Bộ hiểu câu nhập dùng chung với máy chủ & bot Telegram
import { parseLine_, norm_, bestKeywordMatch_, APP_NAME } from './js/shared.js';

const $ = (s) => document.querySelector(s);
const S = { meta: null, type: 'Chi', charts: {}, soData: [], loaded: {} };

// ---------- tiện ích ----------
const fmt = n => (n < 0 ? '-' : '') + String(Math.round(Math.abs(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
function short(n) {
  n = n || 0; const s = n < 0 ? '-' : ''; const a = Math.abs(n);
  const d = (v, k) => String(Math.round(v * Math.pow(10, k)) / Math.pow(10, k)).replace('.', ',');
  if (a >= 1e9) return s + d(a / 1e9, 2) + ' tỷ';
  if (a >= 1e6) return s + d(a / 1e6, 1) + 'tr';
  if (a >= 1e3) return s + Math.round(a / 1e3) + 'k';
  return s + Math.round(a) + 'đ';
}
const pct = v => v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const viDate = iso => { const p = String(iso).split('-'); return p[2] + '/' + p[1]; };
const mLabel = k => { const p = k.split('-'); return p[1] + '/' + p[0]; };
const STATUS_TXT = { ok: 'Ổn', full: 'Đủ', warn: 'Sắp chạm', pace: 'Chi nhanh', over: 'Vượt', nobudget: 'Chưa đặt' };

/** So sánh với mốc: trả về "↑12%" có màu (goodUp: tăng là tốt) */
function cmp(cur, base, goodUp, label) {
  if (base == null || !base) return '';
  const d = (cur - base) / base;
  if (Math.abs(d) < 0.03) return `<span>≈ ${label}</span>`;
  const good = goodUp ? d > 0 : d < 0;
  return `<span class="${good ? 'good' : 'bad'}">${d > 0 ? '↑' : '↓'}${Math.round(Math.abs(d) * 100)}% ${label}</span>`;
}

let pending = 0;
async function call(action, payload) {
  pending++; $('#loading').hidden = false;
  try {
    const res = await fetch('/api/app', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action, payload: payload || {} }),
    });
    const r = await res.json().catch(() => ({ error: 'Lỗi máy chủ (' + res.status + ')' }));
    if (res.status === 401) { showLogin(); throw new Error('Cần đăng nhập'); }
    if (!res.ok || (r && r.error)) throw new Error(r.error || 'Lỗi ' + res.status);
    return r;
  } finally {
    if (--pending === 0) $('#loading').hidden = true;
  }
}

// ---------- đăng nhập ----------
function showLogin() { $('#login').hidden = false; setTimeout(() => $('#loginPw').focus(), 50); }
$('#loginForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  $('#loginErr').hidden = true;
  const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', body: JSON.stringify({ password: $('#loginPw').value }) });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) { $('#loginErr').textContent = r.error || 'Đăng nhập thất bại'; $('#loginErr').hidden = false; return; }
  $('#loginPw').value = '';
  $('#login').hidden = true;
  boot();
});
$('#btnLogout').onclick = async () => {
  await fetch('/api/login', { method: 'DELETE', credentials: 'same-origin' });
  location.reload();
};
$('#btnLogoutAll').onclick = async () => {
  if (!confirm('Đăng xuất khỏi MỌI thiết bị đang dùng app (kể cả máy này)?')) return;
  try {
    await call('logoutAll');
    await fetch('/api/login', { method: 'DELETE', credentials: 'same-origin' });
    location.reload();
  } catch (e) { fail(e); }
};

// ---------- cài đặt ----------
async function loadSettings() {
  try {
    const s = await call('telegramStatus');
    const w = s.webhook || {};
    $('#tgStatus').innerHTML = !s.configured ? '⚠️ Chưa có TELEGRAM_TOKEN trên Vercel.' :
      `Bot: <b>@${esc(s.bot || '?')}</b><br>Webhook: ${w.url ? '✅ ' + esc(w.url) : '❌ chưa kết nối'}` +
      (w.last_error_message ? `<br><span class="bad">Lỗi gần nhất: ${esc(w.last_error_message)}</span>` : '') +
      (w.pending_update_count ? `<br>Đang chờ: ${w.pending_update_count}` : '') +
      `<br><small>Dữ liệu: ${s.dbMode === 'supabase' ? 'Supabase' : '⚠️ bộ nhớ tạm (chưa cấu hình Supabase)'}</small>`;
  } catch (e) { $('#tgStatus').textContent = e.message; }
}
$('#btnTgSetup').onclick = async () => {
  try {
    const r = await call('telegramSetup');
    toast(r.ok ? '✅ Đã kết nối bot @' + r.bot : 'Lỗi: ' + (r.description || ''), !r.ok);
    loadSettings();
  } catch (e) { fail(e); }
};

let toastTimer;
function toast(msg, isErr) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = 'toast', 3000);
}
const fail = e => toast(e.message || String(e), true);

const isoOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dateOf = iso => { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };

// ---------- tabs ----------
document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
function showTab(t) {
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + t));
  if (t === 'so') loadSo();
  if (t === 'thang') loadMonth();
  if (t === 'nam') loadYear();
  if (t === 'no') loadDebts();
  if (t === 'caidat') loadSettings();
}

// ---------- khởi động (gọi lại sau khi đăng nhập) ----------
function boot() {
 return call('meta').then(meta => {
  S.meta = meta;
  S.loaded = {};
  $('#demoBanner').hidden = meta.dbMode !== 'memory';
  $('#soMonth').value = meta.month;
  $('#mMonth').value = meta.month;
  $('#soType').innerHTML = '<option value="">Tất cả loại</option>' + meta.types.map(t => `<option>${esc(t)}</option>`).join('');
  $('#yYear').innerHTML = meta.years.slice().reverse().map(y => `<option>${y}</option>`).join('');
  Q.person = meta.members[0];
  try { const p = localStorage.getItem('tc_person'); if (p && meta.members.includes(p)) Q.person = p; } catch (e) {}
  $('#qExamples').innerHTML = ['chi ăn sáng 50k', '15/3 chi đi chợ 350k', 'thu lương 25tr', 'hôm qua chi xăng 100k #mẹ',
    'chi sữa bỉm 450k #bé', 'trả nợ ngân hàng 10tr', 'trả lãi ngân hàng 4tr']
    .map(x => `<button type="button" class="chip" data-ex="${esc(x)}">${esc(x)}</button>`).join('');
  document.querySelectorAll('#qExamples .chip').forEach(b => b.onclick = () => { $('#qText').value = b.dataset.ex; resetOverrides(); renderQuick(); $('#qText').focus(); });
  renderQuick();
  loadRecent();
  $('#qText').focus();
 }).catch(e => { if (e.message !== 'Cần đăng nhập') fail(e); });
}

// ---------- NHẬP NHANH: 1 ô gõ, tự nhận diện, chọn danh mục bằng icon ----------
const Q = { person: null, type: null, cat: null, debt: null, result: null };
const DEFAULT_ICON = { 'Chi': '📦', 'Thu': '💰', 'Trả nợ': '🏦', 'Vay': '🤝', 'Cho vay': '📤', 'Thu hồi nợ': '📥' };
function resetOverrides() { Q.type = null; Q.cat = null; Q.debt = null; }

/** Đọc ô gõ + các lựa chọn bằng tay -> giao dịch hoàn chỉnh (hoặc lỗi) */
function parseQuick() {
  const text = $('#qText').value.trim();
  if (!text) return { empty: true, type: Q.type || 'Chi' };
  const m = S.meta;
  const cats = m.categories;
  const r = parseLine_(text, { person: Q.person, cats: cats, debts: m.debts, members: m.members.map(n => ({ name: n })), today: dateOf(m.today) });
  if (!r.tx) return { error: r.error, type: Q.type || 'Chi' };
  const tx = Object.assign({}, r.tx);
  let catMatched = r.info.catMatched;
  const noteN = norm_(tx.note);

  if (Q.type && Q.type !== tx.type) {          // đổi loại bằng tay -> đoán lại danh mục theo loại mới
    tx.type = Q.type;
    const ofType = cats.filter(c => c.type === tx.type);
    const hit = bestKeywordMatch_(noteN, ofType);
    catMatched = !!hit;
    tx.category = hit ? hit.name : tx.type === 'Trả nợ' ? 'Gốc' : ((ofType.find(c => norm_(c.name) === 'khac') || ofType[0] || { name: 'Khác' }).name);
  }
  if (Q.cat && cats.some(c => c.type === tx.type && c.name === Q.cat)) { tx.category = Q.cat; catMatched = true; }

  let needDebt = false;
  if (m.debtTypes.includes(tx.type)) {
    const hit = bestKeywordMatch_(noteN, m.debts);
    tx.debt = Q.debt || (hit && hit.code) || '';
    needDebt = !tx.debt;
  } else tx.debt = '';
  return { tx: tx, type: tx.type, catMatched: catMatched, needDebt: needDebt };
}

function renderQuick() {
  if (!S.meta) return;
  const r = Q.result = parseQuick();
  const m = S.meta, type = r.type;

  // Dòng xem trước
  let html = '';
  if (r.empty) html = '<span class="muted">Gõ theo mẫu: <b>[ngày] Thu/Chi + nội dung + số tiền</b> — VD: <i>chi ăn sáng 50k</i></span>';
  else if (r.error) html = `<span class="pill err">⚠️ ${esc(r.error)}</span>`;
  else {
    const t = r.tx, isToday = isoOf(t.date) === m.today;
    html = `<span class="pill type-${esc(t.type.replace(/ /g, '-'))}">${esc(t.type)}</span>
      <span class="pill amount">${fmt(t.amount)}</span>
      <span class="pill">📅 ${isToday ? 'Hôm nay' : viDate(isoOf(t.date)) + '/' + t.date.getFullYear()}</span>
      <span class="pill">👤 ${esc(t.person)}</span>
      ${t.note ? `<span class="pill">📝 ${esc(t.note)}</span>` : ''}
      ${r.needDebt ? '<span class="pill err">Chọn khoản nợ bên dưới</span>' : ''}`;
    const cat = m.categories.find(c => c.type === 'Chi' && c.name === t.category);
    if (t.type === 'Chi' && cat && cat.budget && isoOf(t.date).slice(0, 7) === m.month) {
      const spent = (m.spent[t.category] || 0), after = spent + t.amount, p = after / cat.budget;
      html += `<div class="q-budget">Tháng này ${esc(t.category)}: ${short(spent)} → <b class="${p > 1 ? 'bad' : p >= 0.8 ? 'warnc' : ''}">${short(after)}</b> / ${short(cat.budget)} (${pct(p)})${p > 1 ? ' · vượt ngân sách' : ''}</div>`;
    }
  }
  $('#qPreview').innerHTML = html;

  // Chọn loại (ghi đè chữ Thu/Chi trong câu)
  $('#qTypes').innerHTML = m.types.map(t => `<button type="button" class="chip ${t === type ? 'active' : ''}" data-type="${esc(t)}">${esc(t)}</button>`).join('');
  document.querySelectorAll('#qTypes .chip').forEach(b => b.onclick = () => { Q.type = b.dataset.type; Q.cat = null; Q.debt = null; renderQuick(); $('#qText').focus(); });

  // Khoản nợ (khi Trả nợ / Vay)
  const showDebt = m.debtTypes.includes(type);
  $('#qDebts').hidden = !showDebt;
  if (showDebt) {
    const cur = r.tx ? r.tx.debt : Q.debt;
    $('#qDebts').innerHTML = m.debts.map(d => `<button type="button" class="chip ${d.code === cur ? 'active' : ''} ${r.needDebt ? 'need' : ''}" data-debt="${esc(d.code)}">${esc(d.name)}</button>`).join('');
    document.querySelectorAll('#qDebts .chip').forEach(b => b.onclick = () => { Q.debt = b.dataset.debt; renderQuick(); $('#qText').focus(); });
  }

  // Lưới icon danh mục
  const selected = r.tx ? r.tx.category : Q.cat;
  $('#qCats').innerHTML = m.categories.filter(c => c.type === type).map(c => {
    const bud = c.budget || 0, spent = m.spent[c.name] || 0, p = bud ? spent / bud : 0;
    const active = c.name === selected;
    return `<button type="button" class="icon-tile ${active ? 'active' : ''}" data-cat="${esc(c.name)}" title="${esc(c.name)}">
      ${active && r.catMatched && !Q.cat ? '<span class="auto" title="Tự nhận theo từ khoá">✨</span>' : ''}
      <span class="ic">${esc(c.icon || DEFAULT_ICON[c.type] || '•')}</span>${esc(c.name)}
      ${type === 'Chi' && bud ? `<div class="mini ${p > 1 ? 'over' : p >= 0.8 ? 'warn' : ''}"><span style="width:${Math.min(100, p * 100)}%"></span></div>` : ''}
    </button>`;
  }).join('');
  document.querySelectorAll('#qCats .icon-tile').forEach(b => b.onclick = () => { Q.cat = b.dataset.cat; renderQuick(); $('#qText').focus(); });

  // Người ghi
  $('#qPeople').innerHTML = m.members.map(p => `<button type="button" class="chip ${p === (r.tx ? r.tx.person : Q.person) ? 'active' : ''}" data-p="${esc(p)}">👤 ${esc(p)}</button>`).join('');
  document.querySelectorAll('#qPeople .chip').forEach(b => b.onclick = () => {
    Q.person = b.dataset.p;
    try { localStorage.setItem('tc_person', Q.person); } catch (e) {}
    renderQuick(); $('#qText').focus();
  });

  $('#btnSave').disabled = !(r.tx && !r.needDebt);
}

$('#qText').addEventListener('input', () => { Q.cat = null; renderQuick(); });

$('#quickForm').addEventListener('submit', ev => {
  ev.preventDefault();
  const r = parseQuick();
  if (!r.tx || r.needDebt) { renderQuick(); return; }
  const t = r.tx;
  $('#btnSave').disabled = true;
  call('add', { type: t.type, amount: t.amount, date: isoOf(t.date), category: t.category, person: t.person, debt: t.debt, note: t.note })
    .then(tx => {
      toast(`✅ ${tx.type} ${fmt(tx.amount)} · ${tx.category}`);
      if (tx.type === 'Chi' && tx.date.slice(0, 7) === S.meta.month) S.meta.spent[tx.category] = (S.meta.spent[tx.category] || 0) + tx.amount;
      $('#qText').value = '';
      resetOverrides();
      S.loaded = {};
      renderQuick();
      loadRecent();
      $('#qText').focus();
    }).catch(e => { fail(e); renderQuick(); });
});

function txTable(rows, withDel) {
  if (!rows.length) return '<p class="muted">Chưa có giao dịch.</p>';
  return `<table><thead><tr><th>Ngày</th><th>Loại</th><th>Danh mục</th><th class="hide-sm">Người</th><th class="num">Số tiền</th><th class="hide-sm">Ghi chú</th>${withDel ? '<th></th>' : ''}</tr></thead><tbody>` +
    rows.map(t => `<tr>
      <td>${viDate(t.date)}</td>
      <td><span class="tag ${esc(t.type.replace(/ /g, '-'))}">${esc(t.type)}</span></td>
      <td>${esc(t.category)}${t.debt ? `<br><small class="muted">${esc(t.debtName)}</small>` : ''}</td>
      <td class="hide-sm">${esc(t.person)}</td>
      <td class="num">${fmt(t.amount)}</td>
      <td class="hide-sm">${esc(t.note)}</td>
      ${withDel ? `<td><button class="del" title="Xoá" data-id="${esc(t.id)}">✕</button></td>` : ''}
    </tr>`).join('') + '</tbody></table>';
}

function bindDelete(container, after) {
  container.querySelectorAll('.del').forEach(b => b.onclick = () => {
    if (!confirm('Xoá giao dịch này?')) return;
    call('delete', { id: b.dataset.id }).then(() => { toast('Đã xoá'); S.loaded = {}; after(); }).catch(fail);
  });
}

function loadRecent() {
  call('list', { month: S.meta.month }).then(rows => {
    const el = $('#recentList');
    el.innerHTML = txTable(rows.slice(0, 15), true);
    bindDelete(el, loadRecent);
    const chi = rows.filter(r => r.type === 'Chi').reduce((a, r) => a + r.amount, 0);
    $('#recentSum').textContent = `${rows.length} khoản · chi ${short(chi)}`;
  }).catch(fail);
}

// ---------- SỔ ----------
function loadSo() {
  call('list', { month: $('#soMonth').value }).then(rows => { S.soData = rows; renderSo(); }).catch(fail);
}
function renderSo() {
  const type = $('#soType').value, q = $('#soSearch').value.trim().toLowerCase();
  const rows = S.soData.filter(r => (!type || r.type === type) &&
    (!q || [r.note, r.category, r.person, r.debtName].join(' ').toLowerCase().includes(q)));
  const by = {}; rows.forEach(r => by[r.type] = (by[r.type] || 0) + r.amount);
  $('#soSummary').innerHTML = `${rows.length} khoản · ` + Object.keys(by).map(k => `${esc(k)}: <b>${fmt(by[k])}</b>`).join(' · ');
  const el = $('#soList'); el.innerHTML = txTable(rows, true); bindDelete(el, loadSo);
}
$('#soMonth').onchange = loadSo; $('#soType').onchange = renderSo; $('#soSearch').oninput = renderSo;

// ---------- THÁNG ----------
$('#mMonth').onchange = () => loadMonth(true);
function loadMonth(force) {
  const m = $('#mMonth').value;
  if (!force && S.loaded.month === m) return;
  call('month', { month: m }).then(r => { S.loaded.month = m; renderMonth(r); }).catch(fail);
}

function kpi(label, value, sub, cls) {
  return `<div class="kpi"><div class="label">${label}</div><div class="value ${cls || ''}">${value}</div><div class="sub">${sub || ''}</div></div>`;
}

function renderMonth(r) {
  const t = r.totals, b = r.baseline, p = r.prev;
  $('#mInfo').textContent = r.day ? `Ngày ${r.day}/${r.days} · đã qua ${pct(r.progress)} tháng` :
    (b ? `Baseline = TB ${b.months} tháng: ${r.baselineMonths.map(mLabel).join(', ')}` : '');
  const vs = (cur, k, up) => [b ? cmp(cur, b[k], up, 'vs TB3T') : '', p ? cmp(cur, p[k], up, 'vs T trước') : ''].filter(Boolean).join('<br>');
  $('#mKpis').innerHTML = [
    kpi('Thu nhập', short(t.thu), (t.thuPlan ? `${pct(t.thu / t.thuPlan)} kế hoạch ${short(t.thuPlan)}<br>` : '') + vs(t.thu, 'thu', true)),
    kpi('Chi tiêu', short(t.chi), (t.chiAnnual ? `Thường xuyên ${short(t.chiRegular)} + theo năm ${short(t.chiAnnual)}<br>` : '') +
      (r.day ? `Dự phóng thường xuyên ${short(t.projectedRegular)}<br>` : '') + vs(t.projectedRegular, 'chiRegular', false) +
      (r.budgetTotal ? `<br>${pct(t.chiRegular / r.budgetTotal)} ngân sách tháng` : '')),
    kpi('Trả nợ', short(t.traNo), `Gốc ${short(t.traGoc)} · Lãi ${short(t.traLai)}<br>` + vs(t.traNo, 'traNo', true)),
    kpi('Dư sau chi tiêu', short(t.surplus), 'Thu − Chi = sức trả nợ<br>' + (b ? cmp(t.surplus, b.surplus, true, 'vs TB3T') : ''), t.surplus < 0 ? 'bad' : ''),
    kpi('Dòng tiền ròng', short(t.net), 'Mọi tiền vào − mọi tiền ra' + (t.vay ? `<br>Có vay thêm ${short(t.vay)}` : ''), t.net < 0 ? 'bad' : 'good'),
    kpi('Tổng dư nợ', short(r.debts.totalRemaining), (t.debtRatio != null ? `Trả nợ = ${pct(t.debtRatio)} thu nhập<br>` : '') +
      (r.debts.etaMonths ? `Hết nợ sau ~${r.debts.etaMonths} tháng` : '')),
    r.assets.total ? kpi('Tài sản ròng', short(r.assets.netWorth), `Tài sản ${short(r.assets.total)} − nợ ${short(r.assets.debtTotal)}`,
      r.assets.netWorth < 0 ? 'bad' : '') : '',
  ].join('');

  $('#mAnnualCard').hidden = !r.annual.length;
  $('#mAnnualSave').textContent = r.annual.length ? `Nên để dành ~${short(r.annualSaving)}/tháng` : '';
  $('#mAnnual').innerHTML = `<table><thead><tr><th>Khoản</th><th class="num">Tháng này</th><th class="num">Từ đầu năm</th><th class="num">Ngân sách năm</th><th style="width:25%">Tiến độ</th></tr></thead><tbody>` +
    r.annual.map(a => `<tr><td>${esc(a.name)}</td><td class="num">${short(a.actual)}</td><td class="num">${fmt(a.ytd)}</td><td class="num">${fmt(a.budgetYear)}</td>
      <td><div class="bar ${a.status}"><span style="width:${Math.min(100, a.pct * 100)}%"></span></div><small>${pct(a.pct)}${a.remaining > 0 ? ' · còn ' + short(a.remaining) : ''}</small></td></tr>`).join('') + '</tbody></table>';

  $('#mAlerts').innerHTML = r.alerts.map(a => `<div class="alert ${a.level}">${a.level === 'bad' ? '🔴' : '🟡'} ${esc(a.text)}</div>`).join('') +
    (!b ? '<div class="alert info">Chưa có dữ liệu các tháng trước nên chưa so sánh baseline được.</div>' : '');

  $('#mBudgetSum').textContent = r.budgetTotal ? `${short(t.chiRegular)} / ${short(r.budgetTotal)}` : '';
  const cats = r.categories;
  $('#mCats').innerHTML = `<table><thead><tr><th>Danh mục</th><th class="num">Thực chi</th><th class="num">Ngân sách</th><th style="width:22%">Tiến độ</th>
    <th class="num hide-sm">TB3T</th><th class="num">${r.day ? 'Dự phóng vs TB3T' : 'vs TB3T'}</th><th class="num hide-sm">T trước</th></tr></thead><tbody>` +
    cats.map(c => `<tr>
      <td>${esc(c.name)}<br><small class="muted">${esc(c.group)}</small></td>
      <td class="num">${fmt(c.actual)}</td>
      <td class="num">${c.budget ? fmt(c.budget) : '—'}</td>
      <td><div class="bar ${c.status}"><span style="width:${Math.min(100, (c.pct || 0) * 100)}%"></span></div>
        <small><span class="badge ${c.status}">${STATUS_TXT[c.status]}</span> ${pct(c.pct)}${c.remaining > 0 ? ' · còn ' + short(c.remaining) : ''}</small></td>
      <td class="num hide-sm">${c.baseline != null ? short(c.baseline) : '—'}</td>
      <td class="num">${c.vsBaseline != null ? cmp(1 + c.vsBaseline, 1, false, '') : '—'}</td>
      <td class="num hide-sm">${short(c.prev)}</td></tr>`).join('') +
    `<tr class="total"><td>Tổng thường xuyên</td><td class="num">${fmt(t.chiRegular)}</td><td class="num">${fmt(r.budgetTotal)}</td><td></td>
      <td class="num hide-sm">${b ? short(b.chiRegular) : '—'}</td><td class="num">${b ? cmp(t.projectedRegular, b.chiRegular, false, '') : '—'}</td><td class="num hide-sm">${p ? short(p.chiRegular) : '—'}</td></tr></tbody></table>`;

  $('#mPeople').innerHTML = r.byPerson.length ? `<table><thead><tr><th>Người</th><th class="num">Thu</th><th class="num">Chi</th><th class="num">Trả nợ</th></tr></thead><tbody>` +
    r.byPerson.map(x => `<tr><td>${esc(x.name)}</td><td class="num">${short(x.thu)}</td><td class="num">${short(x.chi)}</td><td class="num">${short(x.traNo)}</td></tr>`).join('') + '</tbody></table>' : '<p class="muted">—</p>';
  $('#mIncome').innerHTML = r.income.length ? '<table><tbody>' + r.income.map(x => `<tr><td>${esc(x.name)}</td><td class="num">${fmt(x.amount)}</td></tr>`).join('') + '</tbody></table>' : '<p class="muted">Chưa ghi khoản thu nào.</p>';

  drawTrend(r.trend);
}

function chart(id, cfg) {
  if (typeof Chart === 'undefined') return;
  if (S.charts[id]) S.charts[id].destroy();
  S.charts[id] = new Chart(document.getElementById(id), cfg);
}
const COLORS = { thu: '#15803d', chi: '#dc2626', traNo: '#0f766e', net: '#1d4ed8', debt: '#7c3aed' };
const moneyAxis = { ticks: { callback: v => short(v) } };
const tip = { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.raw)}` } };

function drawTrend(tr) {
  chart('chTrend', {
    type: 'bar',
    data: { labels: tr.map(x => x.label), datasets: [
      { label: 'Thu', data: tr.map(x => x.thu), backgroundColor: COLORS.thu },
      { label: 'Chi', data: tr.map(x => x.chi), backgroundColor: COLORS.chi },
      { label: 'Trả nợ', data: tr.map(x => x.traNo), backgroundColor: COLORS.traNo },
      { label: 'Dư sau chi tiêu', data: tr.map(x => x.surplus), type: 'line', borderColor: COLORS.net, backgroundColor: COLORS.net, tension: .3 },
    ] },
    options: { maintainAspectRatio: false, scales: { y: moneyAxis }, plugins: { tooltip: tip } },
  });
  chart('chDebt', {
    type: 'line',
    data: { labels: tr.map(x => x.label), datasets: [{ label: 'Dư nợ', data: tr.map(x => x.debtEnd), borderColor: COLORS.debt, backgroundColor: 'rgba(124,58,237,.12)', fill: true, tension: .3 }] },
    options: { maintainAspectRatio: false, scales: { y: moneyAxis }, plugins: { legend: { display: false }, tooltip: tip } },
  });
}

// ---------- NĂM ----------
$('#yYear').onchange = () => loadYear(true);
function loadYear(force) {
  const y = $('#yYear').value;
  if (!force && S.loaded.year === y) return;
  call('year', { year: y }).then(r => { S.loaded.year = y; renderYear(r); }).catch(fail);
}

function renderYear(r) {
  const t = r.totals, a = r.avg;
  $('#yInfo').textContent = `${r.monthsWithData} tháng có dữ liệu`;
  $('#yKpis').innerHTML = [
    kpi('Tổng thu', short(t.thu), a ? `TB ${short(a.thu)}/tháng` : ''),
    kpi('Tổng chi', short(t.chi), a ? `TB ${short(a.chi)}/tháng` : ''),
    kpi('Tổng trả nợ', short(t.traNo), `Gốc ${short(t.traGoc)} · Lãi ${short(t.traLai)}`),
    kpi('Dư sau chi tiêu', short(t.surplus), t.thu ? `${pct(t.surplus / t.thu)} thu nhập` : '', t.surplus < 0 ? 'bad' : ''),
    kpi('Dư nợ cuối kỳ', short(r.debtEnd), r.debtStart ? `Đầu năm ${short(r.debtStart)}<br>` + cmp(r.debtEnd, r.debtStart, false, '') : 'Bắt đầu theo dõi giữa năm'),
  ].join('');

  const ms = r.months;
  $('#yMonths').innerHTML = `<table><thead><tr><th>Tháng</th><th class="num">Thu</th><th class="num">Chi</th><th class="num hide-sm">Ngân sách</th><th class="num">Trả nợ</th><th class="num">Dư</th><th class="num">Dư nợ cuối</th></tr></thead><tbody>` +
    ms.map(m => `<tr${m.count ? '' : ' class="muted"'}><td>${m.label}</td><td class="num">${short(m.thu)}</td>
      <td class="num ${m.budget && m.chi > m.budget ? 'bad' : ''}">${short(m.chi)}</td><td class="num hide-sm">${short(m.budget)}</td>
      <td class="num">${short(m.traNo)}</td><td class="num ${m.surplus < 0 ? 'bad' : ''}">${short(m.surplus)}</td>
      <td class="num">${m.debtEnd != null ? short(m.debtEnd) : ''}</td></tr>`).join('') +
    `<tr class="total"><td>Tổng</td><td class="num">${short(t.thu)}</td><td class="num">${short(t.chi)}</td><td class="hide-sm"></td><td class="num">${short(t.traNo)}</td><td class="num">${short(t.surplus)}</td><td></td></tr></tbody></table>`;

  const head = `<tr><th>Danh mục</th>${ms.map(m => `<th class="num">T${Number(m.month.slice(5))}</th>`).join('')}<th class="num">Tổng</th><th class="num">TB/th</th><th class="num">% NS</th></tr>`;
  $('#yMatrix').innerHTML = `<table><thead>${head}</thead><tbody>` + r.chiMatrix.map(c => `<tr><td>${esc(c.name)}${c.yearly ? ' <span class="tag">theo năm</span>' : ''}</td>` +
    c.values.map((v, i) => { const bud = c.budgets[i]; const cls = bud && v > bud ? 'heat-over' : bud && v >= bud * 0.8 ? 'heat-warn' : '';
      return `<td class="num ${cls}">${v ? short(v) : ''}</td>`; }).join('') +
    `<td class="num"><b>${short(c.total)}</b></td><td class="num">${short(c.avg)}</td><td class="num">${pct(c.pct)}</td></tr>`).join('') + '</tbody></table>';

  $('#yIncome').innerHTML = r.thuMatrix.length ? '<table><tbody>' + r.thuMatrix.map(c => `<tr><td>${esc(c.name)}</td><td class="num">${fmt(c.total)}</td><td class="num muted">TB ${short(c.avg)}</td></tr>`).join('') + '</tbody></table>' : '<p class="muted">—</p>';
  $('#yPeople').innerHTML = r.byPerson.length ? `<table><thead><tr><th>Người</th><th class="num">Thu</th><th class="num">Chi</th><th class="num">Trả nợ</th></tr></thead><tbody>` +
    r.byPerson.map(x => `<tr><td>${esc(x.name)}</td><td class="num">${short(x.thu)}</td><td class="num">${short(x.chi)}</td><td class="num">${short(x.traNo)}</td></tr>`).join('') + '</tbody></table>' : '<p class="muted">—</p>';

  chart('chYear', {
    type: 'bar',
    data: { labels: ms.map(m => 'T' + Number(m.month.slice(5))), datasets: [
      { label: 'Thu', data: ms.map(m => m.thu), backgroundColor: COLORS.thu },
      { label: 'Chi', data: ms.map(m => m.chi), backgroundColor: COLORS.chi },
      { label: 'Trả nợ', data: ms.map(m => m.traNo), backgroundColor: COLORS.traNo },
      { label: 'Dư nợ', data: ms.map(m => m.debtEnd), type: 'line', borderColor: COLORS.debt, backgroundColor: COLORS.debt, yAxisID: 'y2', tension: .3 },
    ] },
    options: { maintainAspectRatio: false, plugins: { tooltip: tip },
      scales: { y: moneyAxis, y2: { position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => short(v) } } } },
  });
}

// ---------- NỢ ----------
function loadDebts() {
  call('debts', { month: S.meta.month }).then(renderDebts).catch(fail);
}
function renderDebts(d) {
  const A = d.assets;
  $('#dAssets').innerHTML = A.list.length ? `<table><thead><tr><th>Tài sản</th><th class="hide-sm">Loại</th><th class="num">Số lượng</th><th class="num">Giá trị</th><th class="hide-sm">Cập nhật</th></tr></thead><tbody>` +
    A.list.map(a => `<tr${a.included ? '' : ' class="muted"'}><td>${esc(a.name)}${a.included ? '' : ' <small>(không tính)</small>'}${a.note ? `<br><small class="muted">${esc(a.note)}</small>` : ''}</td>
      <td class="hide-sm">${esc(a.type)}</td><td class="num">${a.qty ? String(a.qty).replace('.', ',') + ' ' + esc(a.unit) : ''}</td>
      <td class="num">${fmt(a.value)}</td><td class="hide-sm">${a.updated ? viDate(a.updated) : ''}</td></tr>`).join('') +
    `<tr class="total"><td>Tổng tài sản</td><td class="hide-sm"></td><td></td><td class="num">${fmt(A.total)}</td><td class="hide-sm"></td></tr>
     <tr><td>Tổng nợ</td><td class="hide-sm"></td><td></td><td class="num bad">−${fmt(A.debtTotal)}</td><td class="hide-sm"></td></tr>
     <tr class="total"><td>Tài sản ròng</td><td class="hide-sm"></td><td></td><td class="num">${fmt(A.netWorth)}</td><td class="hide-sm"></td></tr></tbody></table>` :
    '<p class="muted">Chưa nhập tài sản.</p>';
  $('#dKpis').innerHTML = [
    A.total ? kpi('Tài sản ròng', short(A.netWorth), `Nợ = ${pct(A.debtToAsset)} tài sản`, A.netWorth < 0 ? 'bad' : '') : '',
    kpi('Tổng dư nợ', short(d.totalRemaining), d.totalOriginal ? `Đã trả ${pct(1 - d.totalRemaining / d.totalOriginal)} tổng gốc` : ''),
    kpi('Tháng này đã trả', short(d.monthGoc + d.monthLai), `Gốc ${short(d.monthGoc)} · Lãi ${short(d.monthLai)}`),
    kpi('Lãi phát sinh ước tính', short(d.monthlyInterest) + '/th', 'Theo dư nợ hiện tại × lãi suất' +
      (d.interestDueSoon ? `<br><span class="warnc">Sắp đến hạn lãi năm: ${short(d.interestDueSoon)}</span>` : '') +
      (d.interestSavePerMonth ? `<br>Để dành lãi năm ~${short(d.interestSavePerMonth)}/th` : '')),
    kpi('Dự kiến hết nợ', d.etaMonths ? `~${d.etaMonths} tháng` : '—', d.avgGoc ? `Trả gốc TB 3T: ${short(d.avgGoc)}/tháng` : 'Chưa có lịch sử trả gốc'),
  ].join('');
  $('#dTip').innerHTML = d.priority ? `<div class="alert info">💡 Có tiền dư thì ưu tiên trả thêm vào <b>${esc(d.priority)}</b> (lãi suất cao nhất).${d.priorityAlt ? `<br>Nếu khoản này không nhận trả bớt gốc giữa kỳ thì trả thêm vào <b>${esc(d.priorityAlt)}</b>.` : ''}</div>` : '';
  $('#dList').innerHTML = d.list.map(x => `<div class="card debt">
    <div><b>${esc(x.name)}</b> <span class="muted">(${esc(x.code)}${x.creditor ? ' · ' + esc(x.creditor) : ''})</span><br>
      <small class="muted">${String(x.rate).replace('.', ',')}%/năm${x.minPay ? ' · tối thiểu ' + short(x.minPay) + '/th' : ''}</small></div>
    <div class="num"><div class="big">${short(x.remaining)}</div><small class="muted">còn lại / ${short(x.original)}</small></div>
    <div style="grid-column:1/-1"><div class="bar"><span style="width:${Math.min(100, (x.paidPct || 0) * 100)}%"></span></div>
      <small>Đã trả gốc ${pct(x.paidPct)} (${short(x.paidGoc)}) · lãi đã trả ${short(x.paidLai)}
      · tháng này: gốc ${short(x.monthGoc)}, lãi ${short(x.monthLai)}
      ${x.etaMonths ? ` · <b>dự kiến xong ${mLabel(x.etaMonth)}</b> (~${x.etaMonths} tháng)` : x.remaining <= 0 ? ' · ✅ Đã tất toán' : ''}
      ${x.belowMin ? ' · <span class="bad">trả chưa đủ tối thiểu</span>' : ''}</small>
      ${x.annualInterest ? `<div class="alert ${x.annualInterest.daysLeft < 0 ? 'bad' : x.annualInterest.daysLeft <= 30 ? 'warn' : 'info'}" style="margin:8px 0 0">
        🗓 Lãi năm kỳ tới: <b>${fmt(x.annualInterest.amount)}</b>${x.annualInterest.estimated ? ' (ước tính)' : ''}
        · hạn ${viDate(x.annualInterest.due)}/${x.annualInterest.due.slice(0, 4)} (còn ${x.annualInterest.daysLeft} ngày)
        · ${x.annualInterest.dueSoon ? '<b>cần chuẩn bị đủ tiền trước hạn</b>' : `cần để dành ~${short(x.annualInterest.savePerMonth)}/tháng`}</div>` : ''}</div>
  </div>`).join('') || '<p class="muted">Chưa có khoản nợ nào.</p>';
}

// Tên app lấy từ APP_NAME (public/js/shared.js) — đổi 1 chỗ là đủ
document.title = APP_NAME;
document.querySelectorAll('.app-name').forEach(el => { el.textContent = APP_NAME; });

// Chạy sau cùng, khi mọi hàm/biến ở trên đã sẵn sàng
boot();
