param(
  [string]$Time = "",
  [string]$TaskName = "MAGNETO Daily Gates Admin"
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runnerPath = (Resolve-Path (Join-Path $projectRoot "scripts\run-daily-gates-admin.cmd")).Path

$timeFromEnv = [string]$env:OPS_DAILY_TASK_TIME
if (-not $Time) {
  if ($timeFromEnv) {
    $Time = $timeFromEnv.Trim()
  } else {
    $Time = "08:00"
  }
}

if ($Time -notmatch "^([01]\d|2[0-3]):[0-5]\d$") {
  throw "Invalid time '$Time'. Use HH:mm in 24h format (example: 08:00, 21:30)."
}

if (-not (Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue)) {
  throw "ScheduledTasks module is not available on this system."
}

$triggerTime = [DateTime]::ParseExact($Time, "HH:mm", [System.Globalization.CultureInfo]::InvariantCulture)

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"`"$runnerPath`"`""
$trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Write-Host "Registering scheduled task '$TaskName' at $Time..."
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Scheduled task registered."
Get-ScheduledTask -TaskName $TaskName | Format-List TaskName,State
$info = Get-ScheduledTaskInfo -TaskName $TaskName
$nextRun = if ($info.NextRunTime -and $info.NextRunTime.Year -gt 1900) {
  $info.NextRunTime.ToString("yyyy-MM-dd HH:mm:ss")
} else {
  "N/A"
}
Write-Host "Next Run Time: $nextRun"
