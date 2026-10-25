# Cài đủ 7 biến môi trường lên Vercel (Production). Chạy trong thư mục gốc của project, sau "vercel link":
#   powershell -ExecutionPolicy Bypass -File scripts\add-secrets.ps1
# - 3 chuỗi bí mật (SESSION_SECRET, TELEGRAM_WEBHOOK_SECRET, CRON_SECRET) được tự sinh ngẫu nhiên 43 ký tự.
# - 4 biến còn lại bạn dán vào khi được hỏi.
$ErrorActionPreference = 'Stop'
$vercel = 'vercel@65.1.0'   # ghim phiên bản CLI, không dùng @latest

function New-Secret {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([Convert]::ToBase64String($bytes)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

foreach ($name in 'SESSION_SECRET', 'TELEGRAM_WEBHOOK_SECRET', 'CRON_SECRET') {
  Write-Host ''
  Write-Host ('=== ' + $name + ' (tự sinh ngẫu nhiên) ===') -ForegroundColor Cyan
  New-Secret | npx --yes $vercel env add $name production --sensitive
}

$items = @(
  @{ Name = 'SUPABASE_URL';              Hint = 'Supabase > Project Settings > Data API: Project URL (dang https://xxxx.supabase.co)' },
  @{ Name = 'SUPABASE_SERVICE_ROLE_KEY'; Hint = 'Supabase > Project Settings > API Keys > Legacy: service_role (bam Reveal)' },
  @{ Name = 'TELEGRAM_TOKEN';            Hint = 'Token tu @BotFather (dang 123456:ABC...). Khong dung bot thi bam Ctrl+C bo qua' },
  @{ Name = 'FAMILY_PASSWORD';           Hint = 'Mat khau chung cua gia dinh, toi thieu 10 ky tu' }
)
foreach ($it in $items) {
  Write-Host ''
  Write-Host ('=== ' + $it.Name + ' ===') -ForegroundColor Cyan
  Write-Host $it.Hint -ForegroundColor DarkGray
  npx --yes $vercel env add $it.Name production --sensitive
}
Write-Host ''
Write-Host 'Xong. Deploy lai: npx --yes vercel@65.1.0 deploy --prod' -ForegroundColor Green
