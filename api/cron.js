// Vercel Cron gọi mỗi ngày (xem vercel.json). Vercel tự gửi header Authorization: Bearer <CRON_SECRET>.
import crypto from 'node:crypto';
import { send } from '../lib/http.js';
import { dailyJob } from '../lib/bot.js';
import { publicError } from '../lib/errors.js';
import { MIN_SECRET } from '../lib/auth.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET || '';
  const got = String(req.headers.authorization || '');
  const want = 'Bearer ' + secret;
  if (secret.length < MIN_SECRET) {
    console.error(`CRON_SECRET thiếu hoặc ngắn hơn ${MIN_SECRET} ký tự — cron bị tắt`);
    return send(res, 401, { error: 'unauthorized' });
  }
  if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return send(res, 401, { error: 'unauthorized' });
  }
  try {
    return send(res, 200, await dailyJob());
  } catch (err) {
    const { status, body } = publicError(err);
    return send(res, status, body);
  }
}
