// Chạy thử local:  npm run dev  → http://localhost:3000  (mật khẩu: demo)
// Không có SUPABASE_URL thì dùng dữ liệu trong bộ nhớ + giao dịch mẫu. Có thì nối thẳng Supabase thật.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DB_MODE } from '../lib/db.js';
import { APP_NAME } from '../public/js/shared.js';
import { readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
// Áp đúng header bảo mật trong vercel.json (CSP...) để lỗi hiện ra ngay khi chạy thử
const VERCEL_HEADERS = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')).headers[0].headers;
const PORT = Number(process.env.PORT) || Number(process.argv[2]) || 3000;   // npm run dev -- 3001
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };


http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  VERCEL_HEADERS.forEach(h => res.setHeader(h.key, h.value));
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z]/g, '');
      const mod = await import('../api/' + name + '.js');
      req.query = Object.fromEntries(url.searchParams);
      return await mod.default(req, res);
    }
    const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[\/\\])+/, '');
    const file = join(root, 'public', rel);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ERR_MODULE_NOT_FOUND') { res.writeHead(404); return res.end('Not found'); }
    console.error(err);
    res.writeHead(500); res.end(String(err.message));
  }
}).listen(PORT, () => console.log(`${APP_NAME}: http://localhost:${PORT}  (dữ liệu: ${DB_MODE}${DB_MODE === 'memory' ? ', mật khẩu: demo' : ''})`));
