// POST /api/app  {action, payload}  — mọi thao tác của giao diện web (cần đăng nhập)
import { send, readJson, origin, guardBrowserRequest } from '../lib/http.js';
import { checkSession } from '../lib/auth.js';
import { handleAction } from '../lib/api.js';
import { publicError } from '../lib/errors.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const bad = guardBrowserRequest(req);
  if (bad) return send(res, bad.status, { error: bad.error });
  try {
    const session = await checkSession(req);
    if (!session.ok) return send(res, 401, { error: 'Cần đăng nhập', needLogin: true });
    const body = await readJson(req);
    const out = await handleAction(body.action, body.payload, { origin: origin(req), req });
    return send(res, 200, out, session.setCookie ? { 'Set-Cookie': session.setCookie } : {});
  } catch (err) {
    const { status, body } = publicError(err);
    return send(res, status, body);
  }
}
