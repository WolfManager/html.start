param(
  [int]$MaxAgeHours = 26,
  [switch]$RequireGo
)

$ErrorActionPreference = "Stop"

function Get-JsonFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    return $null
  }
  try {
    return Get-Content -Path $Path -Raw | ConvertFrom-Json
  } catch {
    return $null
  }
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$artifacts = @(
  @{ Name = "health"; Path = Join-Path $projectRoot "data/backups/health-check/latest-gate.json" },
  @{ Name = "parity-admin"; Path = Join-Path $projectRoot "data/backups/parity/latest-critical-admin-gate.json" },
  @{ Name = "contract-admin"; Path = Join-Path $projectRoot "data/backups/contract/latest-contract-gate-admin.json" },
  @{ Name = "release-admin"; Path = Join-Path $projectRoot "data/backups/release-gate/latest-release-gate-admin.json" },
  @{ Name = "ops-summary"; Path = Join-Path $projectRoot "data/backups/ops-logs/latest-daily-gates-summary.json" }
)

$now = Get-Date
$maxAge = [TimeSpan]::FromHours($MaxAgeHours)
$errors = New-Object System.Collections.Generic.List[string]

foreach ($artifact in $artifacts) {
  $path = [string]$artifact.Path
  $name = [string]$artifact.Name

  if (-not (Test-Path $path)) {
    $errors.Add("$name missing: $path")
    continue
  }

  $file = Get-Item $path
  $age = $now - $file.LastWriteTime
  if ($age -gt $maxAge) {
    $errors.Add("$name stale: ageHours=$([Math]::Round($age.TotalHours,2)) > $MaxAgeHours")
  }

  if ($RequireGo.IsPresent) {
    $json = Get-JsonFile -Path $path
    if (-not $json) {
      $errors.Add("$name invalid JSON: $path")
      continue
    }

    if ($json.PSObject.Properties.Name -contains "goNoGo") {
      $goNoGo = [string]$json.goNoGo
      if ($goNoGo -ne "GO") {
        $errors.Add("$name goNoGo=$goNoGo")
      }
    }
  }
}

if ($errors.Count -gt 0) {
  Write-Host "Daily gates freshness check: FAIL"
  foreach ($err in $errors) {
    Write-Host "- $err"
  }
  exit 1
}

Write-Host "Daily gates freshness check: PASS"
Write-Host "- MaxAgeHours=$MaxAgeHours"
Write-Host "- RequireGo=$($RequireGo.IsPresent)"
exit 0
