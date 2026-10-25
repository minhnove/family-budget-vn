// Quét repo tìm bí mật lỡ đưa vào code (key Supabase, token Telegram/GitHub, file .env thật...).
// Chạy: npm run check   — CI chạy bước này cho mọi Pull Request.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SELF = 'scripts/check-secrets.js';

const RULES = [
  { name: 'JWT (Supabase anon/service_role key)', re: /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Supabase secret/publishable key', re: /\bsb_(secret|publishable)_[A-Za-z0-9_-]{16,}/ },
  { name: 'Telegram bot token', re: /\b\d{8,10}:AA[A-Za-z0-9_-]{30,}\b/ },
  { name: 'GitHub token', re: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { name: 'Postgres connection string có mật khẩu', re: /postgres(ql)?:\/\/[^:\s/]+:[^@\s]{6,}@/ },
  { name: 'URL project Supabase thật (dùng https://xxxx.supabase.co trong ví dụ)', re: /https:\/\/[a-z0-9]{20}\.supabase\.co/ },
  { name: 'Vercel OIDC/access token', re: /\bVERCEL_(OIDC_)?TOKEN\s*=\s*["']?[A-Za-z0-9._-]{20,}/ },
];

function listFiles() {
  try {
    const out = execSync('git ls-files -z --cached --others --exclude-standard', { cwd: root, encoding: 'utf8' });
    return out.split('\0').filter(Boolean);
  } catch {
    // Không có git: duyệt thư mục
    const files = [];
    const walk = dir => readdirSync(dir).forEach(name => {
      if (['node_modules', '.git', '.vercel'].includes(name)) return;
      const p = join(dir, name);
      statSync(p).isDirectory() ? walk(p) : files.push(relative(root, p).replace(/\\/g, '/'));
    });
    walk(root);
    return files;
  }
}

const problems = [];
for (const file of listFiles()) {
  if (file === SELF) continue;
  if (/(^|\/)\.env(\.|$)/.test(file) && !file.endsWith('.env.example')) {
    problems.push(`${file}: file môi trường thật không được commit (chỉ .env.example)`);
    continue;
  }
  let text;
  try { text = readFileSync(join(root, file), 'utf8'); } catch { continue; }
  if (text.includes('\u0000')) continue;   // bỏ qua file nhị phân (ảnh)
  text.split('\n').forEach((line, i) => {
    RULES.forEach(r => { if (r.re.test(line)) problems.push(`${file}:${i + 1}: nghi là ${r.name}`); });
  });
}

if (problems.length) {
  console.error('❌ Phát hiện thứ trông giống bí mật — xoá khỏi code (và đổi key/token đó nếu là thật):\n' +
    problems.map(p => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('✅ Không phát hiện key/token/bí mật trong repo');
