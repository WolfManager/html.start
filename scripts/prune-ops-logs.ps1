param(
  [string]$LogDir = "data/backups/ops-logs",
  [int]$KeepLatest = 30,
  [int]$MaxAgeDays = 30
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedLogDir = Join-Path $projectRoot $LogDir

if (-not (Test-Path $resolvedLogDir)) {
  Write-Host "Log directory not found: $resolvedLogDir"
  exit 0
}

$now = Get-Date
$threshold = $now.AddDays(-1 * $MaxAgeDays)

$files = Get-ChildItem -Path $resolvedLogDir -File | Sort-Object LastWriteTime -Descending
if (-not $files) {
  Write-Host "No log files to prune."
  exit 0
}

$toDeleteByCount = @()
if ($files.Count -gt $KeepLatest) {
  $toDeleteByCount = $files | Select-Object -Skip $KeepLatest
}

$toDeleteByAge = $files | Where-Object { $_.LastWriteTime -lt $threshold }
$toDelete = @($toDeleteByCount + $toDeleteByAge) | Sort-Object FullName -Unique

foreach ($file in $toDelete) {
  Remove-Item -Path $file.FullName -Force
}

Write-Host "Prune completed. Total: $($files.Count), Removed: $($toDelete.Count), Kept: $((Get-ChildItem -Path $resolvedLogDir -File).Count)"
