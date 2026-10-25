/**
 * Đăng nhập bằng 1 mật khẩu gia đình (biến môi trường FAMILY_PASSWORD).
 * Đăng nhập đúng -> cookie HttpOnly ký HMAC (SESSION_SECRET), hiệu lực 180 ngày trên thiết bị đó.
 * Muốn đăng xuất mọi thiết bị: đổi SESSION_SECRET trên Vercel rồi Redeploy.
 */
import crypto from 'node:crypto';
import { cookies, isHttps } from './http.js';
import { DB_MODE, getState, setState } from './db.js';

const COOKIE = 'fb_session';
const MAX_AGE = 180 * 24 * 3600;
const DEV_PASSWORD = 'demo';   // chỉ dùng khi chạy thử TRÊN MÁY (npm run dev / npm test)
// Trên Vercel luôn bắt buộc mật khẩu + secret thật, kể cả ở chế độ xem thử (dữ liệu tài chính gia đình là thông tin nhạy cảm)
const LOCAL_ONLY = DB_MODE === 'memory' && !process.env.VERCEL;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (LOCAL_ONLY) return 'dev-only-secret-not-for-production';
  throw new Error('Chưa cấu hình SESSION_SECRET (tối thiểu 16 ký tự) trên Vercel');
}
function familyPassword() {
  const p = process.env.FAMILY_PASSWORD;
  if (p && (p.length >= 10 || LOCAL_ONLY)) return p;
  if (LOCAL_ONLY) return DEV_PASSWORD;
  throw new Error('Chưa cấu hình FAMILY_PASSWORD (tối thiểu 10 ký tự) trên Vercel');
}

const hmac = s => crypto.createHmac('sha256', secret()).update(s).digest('base64url');
const sha = s => crypto.createHash('sha256').update(String(s)).digest();

function makeToken() {
  const payload = String(Date.now() + MAX_AGE * 1000);
  return payload + '.' + hmac(payload);
}

export function isAuthed(req) {
  const tok = cookies(req)[COOKIE];
  if (!tok || tok.indexOf('.') < 0) return false;
  const [payload, sig] = tok.split('.');
  const good = hmac(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  return Number(payload) > Date.now();
}

/** Trả về header Set-Cookie nếu đúng mật khẩu, ném lỗi nếu sai / đang bị khoá */
export async function login(req, password) {
  const now = Date.now();
  const fail = (await getState('login_fail')) || { count: 0, since: now };
  if (now - fail.since > 15 * 60e3) { fail.count = 0; fail.since = now; }
  if (fail.count >= 10) throw new Error('Sai mật khẩu quá nhiều lần. Thử lại sau 15 phút.');

  const ok = crypto.timingSafeEqual(sha(password || ''), sha(familyPassword()));
  if (!ok) {
    fail.count++;
    await setState('login_fail', fail);
    await new Promise(r => setTimeout(r, 800));
    throw new Error('Sai mật khẩu');
  }
  if (fail.count) await setState('login_fail', { count: 0, since: now });
  return sessionCookie(req, makeToken(), MAX_AGE);
}

export function sessionCookie(req, value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` + (isHttps(req) ? '; Secure' : '');
}
