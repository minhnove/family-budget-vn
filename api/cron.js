// Vercel Cron gọi mỗi ngày (xem vercel.json). Vercel tự gửi header Authorization: Bearer <CRON_SECRET>.
import { send } from '../lib/http.js';
import { dailyJob } from '../lib/bot.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) return send(res, 401, { error: 'unauthorized' });
  try {
    return send(res, 200, await dailyJob());
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: err.message });
  }
}
