// Webhook Telegram. Telegram gửi header X-Telegram-Bot-Api-Secret-Token = TELEGRAM_WEBHOOK_SECRET.
import crypto from 'node:crypto';
import { send, readJson } from '../lib/http.js';
import { handleUpdate } from '../lib/bot.js';
import { MIN_SECRET } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const got = String(req.headers['x-telegram-bot-api-secret-token'] || '');
  if (expected.length < MIN_SECRET) {
    console.error(`TELEGRAM_WEBHOOK_SECRET thiếu hoặc ngắn hơn ${MIN_SECRET} ký tự — webhook bị tắt`);
    return send(res, 401, { error: 'unauthorized' });
  }
  if (got.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return send(res, 401, { error: 'unauthorized' });
  }
  try {
    await handleUpdate(await readJson(req));
  } catch (err) {
    console.error(err);   // vẫn trả 200 để Telegram không gửi lại mãi
  }
  return send(res, 200, { ok: true });
}
