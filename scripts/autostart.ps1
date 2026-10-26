# Quản lý chạy ngầm trên Windows.
#   .\scripts\autostart.ps1 install    – tự chạy mỗi khi đăng nhập Windows + chạy ngay
#   .\scripts\autostart.ps1 stop       – tắt bot đang chạy ngầm
#   .\scripts\autostart.ps1 start      – bật lại
#   .\scripts\autostart.ps1 status     – xem đang chạy không + 20 dòng log cuối
#   .\scripts\autostart.ps1 uninstall  – gỡ tự chạy và tắt bot
param([ValidateSet("install", "uninstall", "start", "stop", "status")][string]$Action = "status")

$TaskName = "TelegramReminderBot"
$root = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $PSScriptRoot "start-hidden.vbs"

function Get-BotProcesses {
  # Vòng lặp run-forever.ps1 của project này + các tiến trình con (cmd → node), không đụng node khác
  $all = Get-CimInstance Win32_Process
  $found = @($all | Where-Object { $_.Name -eq "powershell.exe" -and $_.CommandLine -like "*$root\scripts\run-forever.ps1*" })
  $queue = [System.Collections.Generic.Queue[object]]::new()
  $found | ForEach-Object { $queue.Enqueue($_) }
  while ($queue.Count) {
    $parent = $queue.Dequeue()
    $all | Where-Object { $_.ParentProcessId -eq $parent.ProcessId } | ForEach-Object { $found += $_; $queue.Enqueue($_) }
  }
  $found
}

function Stop-Bot {
  # Dừng vòng lặp trước để nó không bật lại node
  Get-BotProcesses | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Start-Bot {
  if (Get-BotProcesses | Where-Object Name -eq "powershell.exe") { Write-Host "Bot đang chạy rồi."; return }
  Start-Process wscript.exe -ArgumentList "`"$vbs`""
  Write-Host "Đã bật bot chạy ngầm. Log: $root\data\bot.log"
}

switch ($Action) {
  "install" {
    $taskAction = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $root
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
      -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $trigger -Settings $settings `
      -Description "Bot nhắc việc Telegram ($root)" -Force -ErrorAction Stop | Out-Null
    Write-Host "Đã cài: bot sẽ tự chạy mỗi khi đăng nhập Windows."
    Start-Bot
  }
  "uninstall" {
    Stop-Bot
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Đã gỡ tự chạy và tắt bot."
  }
  "start" { Start-Bot }
  "stop" { Stop-Bot; Write-Host "Đã tắt bot." }
  "status" {
    $p = Get-BotProcesses
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Write-Host ("Tự chạy khi đăng nhập: " + $(if ($task) { "có" } else { "chưa cài" }))
    Write-Host ("Đang chạy: " + $(if ($p | Where-Object Name -eq "node.exe") { "có" } elseif ($p) { "đang khởi động lại" } else { "không" }))
    $log = Join-Path $root "data\bot.log"
    if (Test-Path $log) { Write-Host "`n--- log ---"; Get-Content $log -Tail 20 -Encoding utf8 }
  }
}
