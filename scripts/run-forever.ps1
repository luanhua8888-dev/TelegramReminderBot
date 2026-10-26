# Chạy bot liên tục: crash thì 10 giây sau tự chạy lại. Log ghi vào data\bot.log.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force data | Out-Null
$log = Join-Path $root "data\bot.log"

while ($true) {
  # Log quá 5MB thì đổi tên thành bot.old.log để không đầy ổ
  if ((Test-Path $log) -and (Get-Item $log).Length -gt 5MB) {
    Move-Item -Force $log (Join-Path $root "data\bot.old.log")
  }
  Add-Content -Encoding utf8 $log "`n===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') khởi động bot ====="
  & cmd /c "node --env-file-if-exists=.env src/index.ts >> `"$log`" 2>&1"
  Add-Content -Encoding utf8 $log "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') bot dừng (exit $LASTEXITCODE), chạy lại sau 10s ====="
  Start-Sleep -Seconds 10
}
