// POST /api/app  {action, payload}  — mọi thao tác của giao diện web (cần đăng nhập)
import { send, readJson, origin } from '../lib/http.js';
import { isAuthed } from '../lib/auth.js';
import { handleAction } from '../lib/api.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    if (!isAuthed(req)) return send(res, 401, { error: 'Cần đăng nhập', needLogin: true });
    const body = await readJson(req);
    return send(res, 200, await handleAction(body.action, body.payload, { origin: origin(req) }));
  } catch (err) {
    console.error(err);
    return send(res, 400, { error: err.message || String(err) });
  }
}
