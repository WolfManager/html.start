param(
  [string]$TaskName = "MAGNETO Daily Gates Admin",
  [int]$LogTailLines = 20
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logDir = Join-Path $projectRoot "data/backups/ops-logs"

if (-not (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
  throw "ScheduledTasks module is not available on this system."
}

$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName

Write-Host "Task: $($task.TaskName)"
Write-Host "State: $($task.State)"
Write-Host "NextRunTime: $($info.NextRunTime)"
Write-Host "LastRunTime: $($info.LastRunTime)"
Write-Host "LastTaskResult: $($info.LastTaskResult)"

if (-not (Test-Path $logDir)) {
  Write-Host "Log directory not found: $logDir"
  exit 0
}

$latestLog = Get-ChildItem -Path $logDir -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latestLog) {
  Write-Host "No log files found in $logDir"
  exit 0
}

Write-Host "LatestLog: $($latestLog.FullName)"
Write-Host "LatestLogUpdated: $($latestLog.LastWriteTime)"
Write-Host "--- LOG TAIL START ---"
Get-Content -Path $latestLog.FullName -Tail $LogTailLines
Write-Host "--- LOG TAIL END ---"
