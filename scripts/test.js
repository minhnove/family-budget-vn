// Test toàn luồng với dữ liệu trong bộ nhớ + Telegram giả lập.  Chạy: npm test
process.env.TELEGRAM_TOKEN = 'test-token';
process.env.TELEGRAM_WEBHOOK_SECRET = 'hook-secret';
process.env.CRON_SECRET = 'cron-secret';
delete process.env.SUPABASE_URL;

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
const { SEED } = await import('../lib/seed.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fails++; };

async function call(handler, { method = 'POST', body, headers = {} } = {}) {
  const req = { method, headers: { host: 'localhost', ...headers }, body };
  const res = { statusCode: 200, headers: {}, out: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(s) { this.out = s; } };
  await handler(req, res);
  return { status: res.statusCode, headers: res.headers, json: res.out ? JSON.parse(res.out) : null };
}

console.log('Đăng nhập');
ok((await call(app, { body: { action: 'meta' } })).status === 401, 'chưa đăng nhập -> 401');
ok((await call(login, { body: { password: 'sai' } })).status === 401, 'sai mật khẩu -> 401');
const good = await call(login, { body: { password: 'demo' } });
ok(good.status === 200 && /fb_session=/.test(good.headers['set-cookie']), 'đúng mật khẩu -> có cookie');
const cookie = good.headers['set-cookie'].split(';')[0];
ok((await call(app, { body: { action: 'meta' }, headers: { cookie: 'fb_session=123.abc' } })).status === 401, 'cookie giả -> 401');
const A = (action, payload) => call(app, { body: { action, payload }, headers: { cookie } });

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
// trả lãi năm đúng hạn -> tự chuyển sang kỳ năm sau
const due = debts.annualDues[0].due;
await A('add', { type: 'Trả nợ', category: 'Lãi', amount: 5e6, date: due, debt: 'NGUOI-THAN', person: 'Bố', note: 'lãi năm' });
const nt = (await A('debts', {})).json.list.find(d => d.code === 'NGUOI-THAN');
ok(nt.annualInterest.due === (Number(due.slice(0, 4)) + 1) + due.slice(4) && nt.annualInterest.amount === 5e6, 'trả lãi năm -> hạn chuyển sang năm sau (' + nt.annualInterest.due + ')');

console.log('Telegram');
const hook = (update, secret = 'hook-secret') => call(telegram, { body: update, headers: { 'x-telegram-bot-api-secret-token': secret } });
ok((await hook({ update_id: 1 }, 'sai')).status === 401, 'sai secret -> 401');
const msg = (id, text, from = 111) => ({ update_id: id, message: { chat: { id: from }, from: { id: from }, text } });
sent.length = 0; await hook(msg(2, '/start'));
ok(sent.some(s => /111/.test(s.body.text)), '/start trả về ID');
sent.length = 0; await hook(msg(3, 'chi ăn sáng 50k'));
ok(sent.some(s => /chưa được cấp quyền/.test(s.body.text)), 'người lạ bị chặn');
// cấp quyền cho "Bố"
db.memoryUpdate('members', { name: 'Bố' }, { tg_id: '111' });
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
// nút Đổi danh mục -> chọn danh mục -> tự học từ khoá
sent.length = 0; await hook(msg(20, 'chi 120k bánh tráng'));
const newTx = (await A('list', {})).json.find(t => t.note === 'bánh tráng');
ok(newTx && newTx.category === 'Khác', 'không nhận ra -> Khác');
const cats = (await A('meta')).json.categories.filter(c => c.type === 'Chi');
const idx = cats.findIndex(c => c.name === 'Ăn ngoài');
await hook({ update_id: 21, callback_query: { id: 'q', from: { id: 111 }, data: 'set:' + newTx.id + ':' + idx, message: { chat: { id: 111 }, message_id: 9, text: '' } } });
ok((await A('list', {})).json.find(t => t.id === newTx.id).category === 'Ăn ngoài', 'đổi danh mục qua nút');
sent.length = 0; await hook(msg(22, 'chi bánh tráng 80k'));
ok(sent.some(s => /Ăn ngoài/.test(s.body.text)), 'lần sau tự nhận "bánh tráng" -> Ăn ngoài');
sent.length = 0; await hook(msg(23, '/xoa'));
ok(sent.some(s => /Đã xoá/.test(s.body.text)), '/xoa xoá khoản vừa ghi');

console.log('Cron');
ok((await call(cron, { method: 'GET', headers: { authorization: 'Bearer sai' } })).status === 401, 'sai CRON_SECRET -> 401');
sent.length = 0;
const cr = await call(cron, { method: 'GET', headers: { authorization: 'Bearer cron-secret' } });
ok(cr.status === 200 && cr.json.ok, 'cron chạy: ' + JSON.stringify(cr.json.sent));
ok(sent.every(s => !/undefined|NaN/.test(s.body.text || '')), 'tin nhắn cron không lỗi hiển thị');

console.log(fails ? '\n❌ ' + fails + ' lỗi' : '\n✅ Tất cả đều đạt');
process.exit(fails ? 1 : 0);
