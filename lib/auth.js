/**
 * Đăng nhập bằng 1 mật khẩu gia đình (biến môi trường FAMILY_PASSWORD).
 *
 * Phiên đăng nhập (cookie HttpOnly):
 *  - token = "<phiên bản>.<hết hạn>.<chữ ký>", ký HMAC bằng SESSION_SECRET + băm của FAMILY_PASSWORD
 *    → đổi mật khẩu gia đình là mọi cookie cũ tự hết hiệu lực.
 *  - "phiên bản" lưu trong app_state.session_version → nút "Đăng xuất mọi thiết bị" tăng số này.
 *  - sống 30 ngày, tự gia hạn (tối đa 1 lần/ngày) khi còn dùng app.
 *
 * Chống dò mật khẩu:
 *  - mỗi IP tối đa 10 lần thử / 15 phút, đếm NGUYÊN TỬ trong database TRƯỚC khi so mật khẩu
 *    (bắn request song song cũng không vượt được; kẻ tấn công chỉ tự khoá chính IP của mình).
 *  - toàn hệ thống > 30 lần sai / giờ → bot nhắn cảnh báo cho cả nhà.
 */
import crypto from 'node:crypto';
import { cookies, isHttps } from './http.js';
import { DB_MODE, getSessionVersion, loginAttempt, loginReset, bumpSessionVersion } from './db.js';
import { UserError, ConfigError } from './errors.js';
import { broadcast } from './bot.js';

const COOKIE = 'fb_session';
const TTL = 30 * 24 * 3600 * 1000;          // 30 ngày
const RENEW_AFTER = 24 * 3600 * 1000;       // gia hạn khi token đã dùng hơn 1 ngày
const IP_LIMIT = 10, IP_WINDOW = 15 * 60;   // 10 lần / 15 phút / IP
const GLOBAL_ALERT_AT = 31, GLOBAL_WINDOW = 3600;
const DEV_PASSWORD = 'demo';                // chỉ dùng khi chạy thử TRÊN MÁY (npm run dev / npm test)
export const MIN_SECRET = 32;

// Trên Vercel luôn bắt buộc mật khẩu + secret thật, kể cả ở chế độ xem thử (dữ liệu tài chính là thông tin nhạy cảm)
const localOnly = () => DB_MODE === 'memory' && !process.env.VERCEL;

function sessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= MIN_SECRET) return s;
  if (localOnly()) return 'dev-only-secret-not-for-production-0000';
  throw new ConfigError(`SESSION_SECRET thiếu hoặc ngắn hơn ${MIN_SECRET} ký tự`);
}
function familyPassword() {
  const p = process.env.FAMILY_PASSWORD;
  if (p && (p.length >= 10 || localOnly())) return p;
  if (localOnly()) return DEV_PASSWORD;
  throw new ConfigError('FAMILY_PASSWORD thiếu hoặc ngắn hơn 10 ký tự');
}

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const signingKey = () => sessionSecret() + ':' + sha(familyPassword()).toString('hex');
const sign = payload => crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');
const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Tạo token (xuất ra để test) */
export function makeToken(version, expiresAt = Date.now() + TTL) {
  const payload = `${version}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function sessionCookie(req, value, maxAgeSeconds) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}` + (isHttps(req) ? '; Secure' : '');
}
const freshCookie = (req, version) => sessionCookie(req, makeToken(version), TTL / 1000);

/**
 * Kiểm tra phiên. Trả về {ok, setCookie?}. setCookie có khi cần gia hạn.
 */
export async function checkSession(req) {
  const tok = cookies(req)[COOKIE];
  if (!tok) return { ok: false };
  const parts = tok.split('.');
  if (parts.length !== 3) return { ok: false };
  const [v, exp, sig] = parts;
  if (!safeEqual(sig, sign(`${v}.${exp}`))) return { ok: false };
  const expiresAt = Number(exp);
  if (!(expiresAt > Date.now())) return { ok: false };
  const version = await getSessionVersion();
  if (Number(v) !== version) return { ok: false };
  return { ok: true, setCookie: expiresAt - Date.now() < TTL - RENEW_AFTER ? freshCookie(req, version) : undefined };
}

/** IP người gọi: Vercel tự đặt x-real-ip / x-forwarded-for. Chỉ lưu bản băm, không lưu IP thật. */
export function clientKey(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = req.headers['x-real-ip'] || xff || (req.socket && req.socket.remoteAddress) || 'unknown';
  return 'ip:' + sha('fb-ip:' + ip).toString('hex').slice(0, 32);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Trả về header Set-Cookie nếu đúng mật khẩu; ném UserError nếu sai / đang bị khoá */
export async function login(req, password) {
  const expected = familyPassword();   // thiếu cấu hình thì báo lỗi trước, không tính là lần thử
  sessionSecret();
  const key = clientKey(req);
  const n = await loginAttempt(key, IP_WINDOW);          // đếm TRƯỚC khi so mật khẩu, nguyên tử
  if (n > IP_LIMIT) throw new UserError('Sai mật khẩu quá nhiều lần từ thiết bị / mạng này. Thử lại sau 15 phút.', 429);

  if (!crypto.timingSafeEqual(sha(password || ''), sha(expected))) {
    const total = await loginAttempt('global', GLOBAL_WINDOW);
    if (total === GLOBAL_ALERT_AT) {
      broadcast(`🚨 <b>Cảnh báo bảo mật</b>: có hơn ${GLOBAL_ALERT_AT - 1} lần nhập sai mật khẩu vào app trong 1 giờ qua. ` +
        'Nếu không phải người nhà, hãy đổi FAMILY_PASSWORD trên Vercel rồi deploy lại.').catch(e => console.error(e));
    }
    await sleep(Math.min(400 * n, 2000));                // chậm dần theo số lần sai
    throw new UserError('Sai mật khẩu', 401);
  }
  await loginReset(key);
  return freshCookie(req, await getSessionVersion());
}

/** Đăng xuất mọi thiết bị: tăng phiên bản phiên → mọi cookie cũ hết hiệu lực */
export async function logoutEverywhere() { return bumpSessionVersion(); }
