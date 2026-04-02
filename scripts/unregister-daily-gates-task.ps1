param(
  [string]$TaskName = "MAGNETO Daily Gates Admin"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command Unregister-ScheduledTask -ErrorAction SilentlyContinue)) {
  throw "ScheduledTasks module is not available on this system."
}

Write-Host "Removing scheduled task '$TaskName'..."
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Scheduled task removed."
