/** Tiện ích HTTP nhỏ, chạy được cả trên Vercel lẫn server chạy thử (không phụ thuộc helper riêng của Vercel). */

export function send(res, code, obj, headers = {}) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(obj));
}

/** Body JSON: Vercel đã parse sẵn vào req.body; server chạy thử thì tự đọc stream */
export async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  if (Buffer.isBuffer(req.body)) return req.body.length ? JSON.parse(req.body.toString('utf8')) : {};
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const s = Buffer.concat(chunks).toString('utf8');
  return s ? JSON.parse(s) : {};
}

export function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

/**
 * Địa chỉ gốc của app (dùng để đăng ký webhook Telegram).
 * Ưu tiên biến môi trường APP_URL, rồi VERCEL_PROJECT_PRODUCTION_URL (Vercel tự đặt), cuối cùng mới đọc header.
 */
export function origin(req) {
  if (process.env.APP_URL) return String(process.env.APP_URL).replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const proto = req.headers['x-forwarded-proto'] || (req.socket && req.socket.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return proto + '://' + host;
}

/**
 * Chống CSRF cho API mà trình duyệt gọi (ngoài lớp SameSite=Lax của cookie):
 *  - POST phải là Content-Type: application/json (form/text-plain từ site khác bị chặn)
 *  - trình duyệt hiện đại gửi Sec-Fetch-Site: chỉ nhận same-origin (hoặc none = gõ trực tiếp)
 *  - có Origin thì host phải trùng host của request
 * Trả về null nếu hợp lệ, hoặc {status, error}.
 */
export function guardBrowserRequest(req, { requireJson = true } = {}) {
  if (requireJson) {
    const ct = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (ct !== 'application/json') return { status: 415, error: 'Chỉ nhận Content-Type: application/json' };
  }
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return { status: 403, error: 'Yêu cầu từ trang khác bị chặn' };
  const o = req.headers.origin;
  if (o && o !== 'null') {
    let oh;
    try { oh = new URL(o).host; } catch (e) { return { status: 403, error: 'Origin không hợp lệ' }; }
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (oh !== host) return { status: 403, error: 'Yêu cầu từ trang khác bị chặn' };
  } else if (o === 'null') {
    return { status: 403, error: 'Origin không hợp lệ' };
  }
  return null;
}

export const isHttps = req => String(req.headers['x-forwarded-proto'] || '').includes('https');
