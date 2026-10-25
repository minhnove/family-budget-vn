// Test toàn luồng với dữ liệu trong bộ nhớ + Telegram giả lập.  Chạy: npm test
// Gồm cả các bài tái hiện finding của bản review bảo mật 25/10/2026 (đăng nhập song song, phiên, CSRF, validate, group chat).
process.env.TELEGRAM_TOKEN = 'test-token';
process.env.TELEGRAM_WEBHOOK_SECRET = 'hook-secret-hook-secret-hook-secret-0123';
process.env.CRON_SECRET = 'cron-secret-cron-secret-cron-secret-0123';
delete process.env.SUPABASE_URL;
delete process.env.VERCEL;
delete process.env.FAMILY_PASSWORD;
delete process.env.SESSION_SECRET;

const sent = [];   // tin nhắn bot đã "gửi"
globalThis.fetch = async (url, opt) => {
  const method = String(url).split('/').pop();
  const body = JSON.parse(opt.body || '{}');
  sent.push({ method, body });
  const result = method === 'getMe' ? { username: 'family_budget_bot' } : method === 'getWebhookInfo' ? { url: 'x' } : { message_id: 1 };
  return { json: async () => ({ ok: true, result }) };
};

const app = (await import('../api/app.js')).default;
const login = (await import('../api/login.js')).default;
const telegram = (await import('../api/telegram.js')).default;
const cron = (await import('../api/cron.js')).default;
const db = await import('../lib/db.js');
const auth = await import('../lib/auth.js');
const { SEED } = await import('../lib/seed.js');
const { readFileSync } = await import('node:fs');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

/** Giả lập request như trình duyệt cùng trang gửi (JSON, same-origin), có thể ghi đè header */
async function call(handler, { method = 'POST', body, headers = {}, ip = '10.0.0.1' } = {}) {
  const base = { host: 'localhost', 'x-real-ip': ip };
  if (method === 'POST') base['content-type'] = 'application/json';
  const req = { method, headers: { ...base, ...headers }, body };
  const res = { statusCode: 200, headers: {}, out: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(s) { this.out = s; } };
  await handler(req, res);
  return { status: res.statusCode, headers: res.headers, json: res.out ? JSON.parse(res.out) : null };
}
const cookieOf = r => (r.headers['set-cookie'] || '').split(';')[0];
const doLogin = (password, ip) => call(login, { body: { password }, ip });

// Thành viên "Bố" dùng Telegram ID 111 (để bot và cảnh báo có người nhận)
db.memoryUpdate('members', { name: 'Bố' }, { tg_id: '111' });

console.log('Đăng nhập');
ok((await call(app, { body: { action: 'meta' } })).status === 401, 'chưa đăng nhập -> 401');
ok((await doLogin('sai', '10.0.0.1')).status === 401, 'sai mật khẩu -> 401');
const good = await doLogin('demo', '10.0.0.1');
ok(good.status === 200 && /fb_session=/.test(good.headers['set-cookie']) && /Max-Age=2592000/.test(good.headers['set-cookie']), 'đúng mật khẩu -> cookie 30 ngày');
let cookie = cookieOf(good);
ok((await call(app, { body: { action: 'meta' }, headers: { cookie: 'fb_session=1.123.abc' } })).status === 401, 'cookie giả -> 401');
const A = (action, payload, extra = {}) => call(app, { body: { action, payload }, headers: { cookie, ...extra } });

console.log('[P1] Giới hạn đăng nhập theo IP, nguyên tử');
for (let i = 0; i < 10; i++) await doLogin('sai-' + i, '10.1.1.1');
const lockedA = await doLogin('demo', '10.1.1.1');
ok(lockedA.status === 429, 'IP A sai 10 lần -> chính IP A bị khoá 15 phút (kể cả nhập đúng)');
ok((await doLogin('demo', '10.2.2.2')).status === 200, 'IP B vẫn đăng nhập bình thường (hết lỗi khoá cả nhà)');
process.env.MEMORY_LATENCY_MS = '80';   // giả lập Supabase trễ 80ms/lệnh như bản review
const t0 = Date.now();
const burst = await Promise.all(Array.from({ length: 100 }, (_, i) => doLogin('doan-' + i, '10.3.3.3')));
delete process.env.MEMORY_LATENCY_MS;
const compared = burst.filter(r => r.status === 401).length, blocked = burst.filter(r => r.status === 429).length;
ok(compared <= 10 && compared + blocked === 100, `100 lần đoán song song: ${compared} lần được so mật khẩu, ${blocked} lần bị chặn (${Date.now() - t0}ms)`);
sent.length = 0;
for (let i = 0; i < 12; i++) await doLogin('x' + i, '10.4.4.' + i);   // tổng số lần sai toàn hệ thống vượt 30/giờ
await wait(50);
ok(sent.some(s => s.method === 'sendMessage' && /Cảnh báo bảo mật/.test(s.body.text)), 'quá 30 lần sai/giờ -> bot cảnh báo cả nhà');

console.log('[P2] Phiên đăng nhập thu hồi được');
ok((await A('meta')).status === 200, 'cookie hợp lệ dùng được');
const oldCookie = cookie;
ok((await A('logoutAll')).status === 200, 'bấm "Đăng xuất mọi thiết bị"');
ok((await call(app, { body: { action: 'meta' }, headers: { cookie: oldCookie } })).status === 401, 'cookie cũ hết hiệu lực sau "Đăng xuất mọi thiết bị"');
cookie = cookieOf(await doLogin('demo', '10.0.0.1'));
ok((await A('meta')).status === 200, 'đăng nhập lại được');
process.env.FAMILY_PASSWORD = 'mat-khau-moi-dai-hon-10';
ok((await A('meta')).status === 401, 'đổi FAMILY_PASSWORD -> cookie cũ tự hết hiệu lực');
delete process.env.FAMILY_PASSWORD;
ok((await A('meta')).status === 200, '(trả mật khẩu cũ -> cookie cũ dùng lại được, đúng thiết kế)');
const v = await db.getSessionVersion();
const oldTok = auth.makeToken(v, Date.now() + 28 * 864e5);   // token đã dùng 2 ngày
const renew = await call(app, { body: { action: 'meta' }, headers: { cookie: 'fb_session=' + oldTok } });
ok(renew.status === 200 && /fb_session=/.test(renew.headers['set-cookie'] || ''), 'token đã dùng > 1 ngày -> tự gia hạn (sliding 30 ngày)');
const expired = auth.makeToken(v, Date.now() - 1000);
ok((await call(app, { body: { action: 'meta' }, headers: { cookie: 'fb_session=' + expired } })).status === 401, 'token hết hạn -> 401');

console.log('[P3] Chống CSRF');
ok((await A('meta', {}, { 'content-type': 'text/plain' })).status === 415, 'Content-Type text/plain -> 415');
ok((await A('meta', {}, { 'sec-fetch-site': 'cross-site' })).status === 403, 'Sec-Fetch-Site: cross-site -> 403');
ok((await A('meta', {}, { 'sec-fetch-site': 'same-site' })).status === 403, 'Sec-Fetch-Site: same-site (subdomain khác) -> 403');
ok((await A('meta', {}, { origin: 'https://evil.example' })).status === 403, 'Origin trang khác -> 403');
ok((await A('meta', {}, { origin: 'http://localhost', 'sec-fetch-site': 'same-origin' })).status === 200, 'cùng origin -> 200');
ok((await call(login, { body: { password: 'demo' }, headers: { 'content-type': 'text/plain' } })).status === 415, 'đăng nhập bằng text/plain -> 415');

console.log('Web');
const meta = (await A('meta')).json;
ok(meta.categories.length === SEED.categories.length && meta.debts.length === SEED.debts.length && meta.members.length === SEED.members.length,
  'meta: ' + meta.categories.length + ' danh mục, ' + meta.debts.length + ' khoản nợ, ' + meta.members.length + ' thành viên');
ok(meta.dbMode === 'memory', 'không có Supabase -> chế độ xem thử');
const added = (await A('add', { type: 'Chi', amount: 50000, date: meta.today, category: 'Cafe', person: 'Mẹ', note: 'cafe test' })).json;
ok(added.id && added.amount === 50000, 'thêm giao dịch');
ok((await A('list', { month: meta.month })).json.some(t => t.id === added.id), 'giao dịch có trong sổ');
const month = (await A('month', { month: meta.month })).json;
ok(month.totals.thu > 0 && month.debts.totalRemaining > 0 && month.assets.netWorth > 0 && month.trend.length === 12, 'báo cáo tháng có thu, nợ, tài sản ròng, xu hướng 12 tháng');
ok(month.baseline && month.baselineMonths.length === 3, 'có baseline trung bình 3 tháng trước');
const year = (await A('year', { year: Number(meta.today.slice(0, 4)) })).json;
ok(year.monthsWithData >= 1 && year.chiMatrix.length > 5, 'báo cáo năm');
const debts = (await A('debts', {})).json;
ok(debts.list.length === SEED.debts.length && debts.assets.list.length === SEED.assets.length, 'nợ & tài sản');
ok(debts.annualDues.length === 1 && debts.annualDues[0].code === 'NGUOI-THAN', 'có 1 khoản trả lãi theo năm');
ok((await A('delete', { id: added.id })).json.ok, 'xoá giao dịch');
ok((await A('add', { type: 'Trả nợ', amount: 1000, date: meta.today })).status === 400, 'trả nợ thiếu khoản nợ -> lỗi');
const due = debts.annualDues[0].due;
await A('add', { type: 'Trả nợ', category: 'Lãi', amount: 5e6, date: due, debt: 'NGUOI-THAN', person: 'Bố', note: 'lãi năm' });
const nt = (await A('debts', {})).json.list.find(d => d.code === 'NGUOI-THAN');
ok(nt.annualInterest.due === (Number(due.slice(0, 4)) + 1) + due.slice(4) && nt.annualInterest.amount === 5e6, 'trả lãi năm -> hạn chuyển sang năm sau (' + nt.annualInterest.due + ')');

console.log('[P3] Validate dữ liệu ở máy chủ');
const before = (await A('month', { month: meta.month })).json.totals.chi;
const bad = [
  [{ type: 'Chi', amount: 1000, category: 'Danh mục bịa' }, 'danh mục bịa'],
  [{ type: 'Chi', amount: 1000, category: '__proto__' }, 'danh mục __proto__'],
  [{ type: 'Chi', amount: 1000, category: 'constructor' }, 'danh mục constructor'],
  [{ type: 'Chi', amount: 1000, category: 'Cafe', person: 'Người lạ' }, 'người không có trong thành viên'],
  [{ type: 'Chi', amount: 1000, category: 'Cafe', note: 'x'.repeat(501) }, 'ghi chú 501 ký tự'],
  [{ type: 'Chi', amount: 9e15, category: 'Cafe' }, 'số tiền 9×10^15'],
  [{ type: 'Chi', amount: -5, category: 'Cafe' }, 'số tiền âm'],
  [{ type: 'Trả nợ', amount: 1000, category: 'Gốc', debt: 'KHONG-CO' }, 'khoản nợ không tồn tại'],
  [{ type: 'Hack', amount: 1000 }, 'loại giao dịch lạ'],
  [{ type: 'Chi', amount: { x: 1 }, category: 'Cafe' }, 'số tiền kiểu object'],
];
for (const [p, label] of bad) {
  const r = await A('add', { date: meta.today, ...p });
  ok(r.status === 400 && r.json.error, label + ' -> 400 (' + r.json.error + ')');
}
ok((await A('month', { month: meta.month })).json.totals.chi === before, 'báo cáo không bị ảnh hưởng bởi các lần ghi sai');
ok((await A('month', { month: "2026-13" })).status === 400 && (await A('list', { month: { $gt: '' } })).status === 400, 'tham số tháng sai định dạng -> 400');
ok((await A('delete', { id: '../x' })).status === 400, 'mã giao dịch lạ -> 400');
ok((await A('doesNotExist')).status === 400, 'thao tác lạ -> 400');

console.log('Lỗi không lộ chi tiết');
process.env.VERCEL = '1';   // giả lập chạy trên Vercel mà thiếu cấu hình
const cfg = await doLogin('demo', '10.9.9.9');
ok(cfg.status === 500 && !/FAMILY_PASSWORD|SESSION_SECRET/.test(cfg.json.error), 'thiếu cấu hình -> 500, không nêu tên biến (' + cfg.json.error.slice(0, 40) + '…)');
delete process.env.VERCEL;

console.log('Telegram');
const hook = (update, secret = process.env.TELEGRAM_WEBHOOK_SECRET) => call(telegram, { body: update, headers: { 'x-telegram-bot-api-secret-token': secret } });
ok((await hook({ update_id: 1 }, 'sai')).status === 401, 'sai secret -> 401');
const msg = (id, text, from = 111, type = 'private') => ({ update_id: id, message: { chat: { id: type === 'private' ? from : -500, type }, from: { id: from }, text } });
sent.length = 0; await hook(msg(2, '/start', 999));
ok(sent.some(s => /999/.test(s.body.text)), '/start trả về ID');
sent.length = 0; await hook(msg(3, 'chi ăn sáng 50k', 999));
ok(sent.some(s => /chưa được cấp quyền/.test(s.body.text)), 'người lạ bị chặn');
sent.length = 0; await hook(msg(4, ['15/3 chi ăn sáng 50k', 'thu thưởng 2tr5', 'trả nợ 5tr'].join(String.fromCharCode(10))));
const texts = sent.filter(s => s.method === 'sendMessage').map(s => s.body.text);
ok(texts.length === 3, 'gửi 3 dòng -> 3 phản hồi');
ok(texts[0].includes('Chi 50.000đ') && texts[0].includes('Ăn ngoài') && texts[0].includes('15/03'), 'dòng 1: Chi 50k Ăn ngoài 15/03');
ok(texts[1].includes('Thu 2.500.000đ'), 'dòng 2: Thu 2,5tr');
ok(/Chưa rõ khoản nợ/.test(texts[2]), 'dòng 3: báo thiếu khoản nợ');
sent.length = 0; await hook(msg(4, 'chi ăn sáng 50k'));
ok(sent.length === 0, 'update trùng (Telegram gửi lại) bị bỏ qua');
sent.length = 0; await hook(msg(5, 'trả nợ ngân hàng 10tr'));
ok(sent.some(s => s.body.text.includes('Trả nợ 10.000.000đ') && /ngân hàng/i.test(s.body.text)), 'trả nợ ngân hàng ghi đúng khoản');
sent.length = 0; await hook(msg(6, 'chi sữa bỉm 450k #bé'));
ok(sent.some(s => /Con cái/.test(s.body.text) && /Bé/.test(s.body.text)), '#bé -> ghi cho Bé, danh mục Con cái');
for (const [i, c] of ['/bc', '/ns', '/no', '/hom', '/dm', '/help'].entries()) {
  sent.length = 0; await hook(msg(10 + i, c));
  ok(sent.length === 1 && sent[0].body.text.length > 30 && !/undefined|NaN/.test(sent[0].body.text), 'lệnh ' + c);
}
sent.length = 0; await hook(msg(20, 'chi 120k bánh tráng'));
const newTx = (await A('list', {})).json.find(t => t.note === 'bánh tráng');
ok(newTx && newTx.category === 'Khác', 'không nhận ra -> Khác');
const cats = (await A('meta')).json.categories.filter(c => c.type === 'Chi');
const idx = cats.findIndex(c => c.name === 'Ăn ngoài');
await hook({ update_id: 21, callback_query: { id: 'q', from: { id: 111 }, data: 'set:' + newTx.id + ':' + idx, message: { chat: { id: 111, type: 'private' }, message_id: 9, text: '' } } });
ok((await A('list', {})).json.find(t => t.id === newTx.id).category === 'Ăn ngoài', 'đổi danh mục qua nút');
sent.length = 0; await hook(msg(22, 'chi bánh tráng 80k'));
ok(sent.some(s => /Ăn ngoài/.test(s.body.text)), 'lần sau tự nhận "bánh tráng" -> Ăn ngoài');
sent.length = 0; await hook(msg(23, '/xoa'));
ok(sent.some(s => /Đã xoá/.test(s.body.text)), '/xoa xoá khoản vừa ghi');

console.log('[P3] Bot trong group chat');
const nTx = (await A('list', {})).json.length;
sent.length = 0; await hook(msg(30, '/bc', 111, 'group'));
ok(sent.length === 1 && /chỉ dùng trong chat riêng/.test(sent[0].body.text) && !/Thu|Chi:/.test(sent[0].body.text), '/bc trong group -> chỉ nhắc dùng chat riêng, không lộ báo cáo');
sent.length = 0; await hook(msg(31, 'chi 50k cafe', 111, 'supergroup'));
ok(sent.length === 0 && (await A('list', {})).json.length === nTx, 'tin thường trong group -> không trả lời, không ghi');
sent.length = 0;
await hook({ update_id: 32, callback_query: { id: 'q2', from: { id: 111 }, data: 'del:' + newTx.id, message: { chat: { id: -500, type: 'group' }, message_id: 9, text: '' } } });
ok(sent.some(s => s.method === 'answerCallbackQuery') && (await A('list', {})).json.some(t => t.id === newTx.id), 'nút Xoá bấm trong group -> bị từ chối');

console.log('Cron');
ok((await call(cron, { method: 'GET', headers: { authorization: 'Bearer sai' } })).status === 401, 'sai CRON_SECRET -> 401');
const goodCron = 'Bearer ' + process.env.CRON_SECRET;
const saved = process.env.CRON_SECRET; process.env.CRON_SECRET = 'ngan';
ok((await call(cron, { method: 'GET', headers: { authorization: 'Bearer ngan' } })).status === 401, 'CRON_SECRET < 32 ký tự -> cron tắt');
process.env.CRON_SECRET = saved;
sent.length = 0;
const cr = await call(cron, { method: 'GET', headers: { authorization: goodCron } });
ok(cr.status === 200 && cr.json.ok, 'cron chạy: ' + JSON.stringify(cr.json.sent));
ok(sent.every(s => !/undefined|NaN/.test(s.body.text || '')), 'tin nhắn cron không lỗi hiển thị');

console.log('[P2] CSP & thư viện tự host');
const vj = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const csp = (vj.headers[0].headers.find(h => h.key === 'Content-Security-Policy') || {}).value || '';
ok(/script-src 'self'(;|$)/.test(csp) && /frame-ancestors 'none'/.test(csp) && /connect-src 'self'/.test(csp), 'vercel.json có CSP chỉ cho script cùng origin');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
ok(!/<script[^>]+src="https?:/.test(html) && /src="\/vendor\/chart\.umd\.js"/.test(html), 'index.html không tải script từ bên ngoài (Chart.js tự host)');
ok(!/<script>(?!\s*<\/script>)/.test(html) && !/ on[a-z]+="/.test(html), 'không có inline script / inline event handler');

console.log(fails ? '\n❌ ' + fails + ' lỗi' : '\n✅ Tất cả đều đạt');
process.exit(fails ? 1 : 0);
