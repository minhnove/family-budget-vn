# Hỏi lần lượt 4 biến bí mật và lưu thẳng vào Vercel (Production). Chạy trong thư mục gốc của project:
#   powershell -ExecutionPolicy Bypass -File scripts\add-secrets.ps1
$items = @(
  @{ Name = 'SUPABASE_URL';              Hint = 'Supabase > Project Settings > API: Project URL (dang https://xxxx.supabase.co)' },
  @{ Name = 'SUPABASE_SERVICE_ROLE_KEY'; Hint = 'Supabase > Project Settings > API: service_role key (bam Reveal)' },
  @{ Name = 'TELEGRAM_TOKEN';            Hint = 'Token tu @BotFather (dang 123456:ABC...)' },
  @{ Name = 'FAMILY_PASSWORD';           Hint = 'Mat khau chung cua gia dinh de vao app (tu dat, nen dai)' }
)
foreach ($it in $items) {
  Write-Host ''
  Write-Host ('=== ' + $it.Name + ' ===') -ForegroundColor Cyan
  Write-Host $it.Hint -ForegroundColor DarkGray
  npx --yes vercel@latest env add $it.Name production --sensitive
}
Write-Host ''
Write-Host 'Xong. Quay lai cua so Claude va bam "Da nhap xong".' -ForegroundColor Green
