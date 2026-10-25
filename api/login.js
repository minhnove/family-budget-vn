// POST /api/login {password} -> đặt cookie đăng nhập · DELETE /api/login -> đăng xuất
import { send, readJson } from '../lib/http.js';
import { login, sessionCookie } from '../lib/auth.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'DELETE') return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const { password } = await readJson(req);
    const cookie = await login(req, password);
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookie });
  } catch (err) {
    return send(res, 401, { error: err.message || String(err) });
  }
}
