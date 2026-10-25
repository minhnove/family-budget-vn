// POST /api/login {password} -> đặt cookie đăng nhập · DELETE /api/login -> đăng xuất thiết bị này
import { send, readJson, guardBrowserRequest } from '../lib/http.js';
import { login, sessionCookie } from '../lib/auth.js';
import { publicError } from '../lib/errors.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return send(res, 405, { error: 'Method not allowed' });
  const bad = guardBrowserRequest(req, { requireJson: req.method === 'POST' });
  if (bad) return send(res, bad.status, { error: bad.error });
  try {
    if (req.method === 'DELETE') return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
    const { password } = await readJson(req);
    const cookie = await login(req, typeof password === 'string' ? password.slice(0, 200) : '');
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookie });
  } catch (err) {
    const { status, body } = publicError(err);
    return send(res, status, body);
  }
}
