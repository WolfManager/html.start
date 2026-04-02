param(
  [switch]$Strict,
  [switch]$Json,
  [string]$Out = ""
)

$ErrorActionPreference = "Stop"

function Get-ConfigFromEnvFile {
  param(
    [string]$EnvPath,
    [string]$Key
  )

  if (-not (Test-Path $EnvPath)) {
    return ""
  }

  $pattern = "^\s*" + [Regex]::Escape($Key) + "\s*=\s*(.*)$"
  $match = Get-Content -Path $EnvPath | Where-Object { $_ -match $pattern } | Select-Object -First 1
  if (-not $match) {
    return ""
  }

  $value = ($match -replace $pattern, '$1').Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    return $value.Trim('"')
  }
  return $value
}

function Add-WarningItem {
  param([string]$Message)
  $script:warnings.Add($Message)
}

function Add-ErrorItem {
  param([string]$Message)
  $script:errors.Add($Message)
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $projectRoot ".env"
$resolvedOutPath = ""
if ($Out) {
  $resolvedOutPath = if ([System.IO.Path]::IsPathRooted($Out)) {
    $Out
  } else {
    Join-Path $projectRoot $Out
  }
}

$warnings = New-Object System.Collections.Generic.List[string]
$errors = New-Object System.Collections.Generic.List[string]

if (-not (Test-Path $envPath)) {
  Add-ErrorItem "Missing .env file at $envPath"
} else {
  $jwtSecret = Get-ConfigFromEnvFile -EnvPath $envPath -Key "JWT_SECRET"
  $adminUser = Get-ConfigFromEnvFile -EnvPath $envPath -Key "ADMIN_USER"
  $adminPassword = Get-ConfigFromEnvFile -EnvPath $envPath -Key "ADMIN_PASSWORD"
  $webhookEnabled = (Get-ConfigFromEnvFile -EnvPath $envPath -Key "OPS_ALERT_WEBHOOK_ENABLED").ToLower()
  $webhookUrl = Get-ConfigFromEnvFile -EnvPath $envPath -Key "OPS_ALERT_WEBHOOK_URL"

  if (-not $jwtSecret) {
    Add-ErrorItem "JWT_SECRET is missing"
  } elseif ($jwtSecret -eq "change-this-secret") {
    Add-ErrorItem "JWT_SECRET still uses placeholder value"
  }

  if (-not $adminPassword) {
    Add-ErrorItem "ADMIN_PASSWORD is missing"
  } elseif ($adminPassword -eq "change-this-password") {
    Add-ErrorItem "ADMIN_PASSWORD still uses placeholder value"
  }

  if (-not $adminUser) {
    Add-ErrorItem "ADMIN_USER is missing"
  } elseif ($adminUser -eq "admin") {
    Add-WarningItem "ADMIN_USER uses default value 'admin'"
  }

  if ($webhookEnabled -eq "true" -and -not $webhookUrl) {
    Add-WarningItem "OPS_ALERT_WEBHOOK_ENABLED=true but OPS_ALERT_WEBHOOK_URL is empty"
  }
}

if (-not (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
  Add-WarningItem "ScheduledTasks module is unavailable; skipping task checks"
} else {
  try {
    $task = Get-ScheduledTask -TaskName "MAGNETO Daily Gates Admin" -ErrorAction Stop
    $taskInfo = Get-ScheduledTaskInfo -TaskName "MAGNETO Daily Gates Admin"

    if ($task.State -eq "Disabled") {
      Add-ErrorItem "Scheduled task is disabled"
    }

    if ($taskInfo.LastTaskResult -ne 0) {
      Add-WarningItem "LastTaskResult is $($taskInfo.LastTaskResult)"
    }

    if (-not $taskInfo.NextRunTime -or $taskInfo.NextRunTime.Year -le 1900) {
      Add-WarningItem "Task does not have a valid NextRunTime"
    }
  } catch {
    Add-ErrorItem "Scheduled task 'MAGNETO Daily Gates Admin' is not registered"
  }
}

$freshnessScript = Join-Path $projectRoot "scripts/check-daily-gates-freshness.ps1"
if (Test-Path $freshnessScript) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $freshnessScript -RequireGo | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Add-ErrorItem "Freshness strict check failed"
  }
} else {
  Add-ErrorItem "Missing freshness script: $freshnessScript"
}

$exitCode = 0
if ($errors.Count -gt 0) {
  $exitCode = 1
} elseif ($Strict.IsPresent -and $warnings.Count -gt 0) {
  $exitCode = 2
}

$status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
$report = [ordered]@{
  generatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")
  strict = $Strict.IsPresent
  status = $status
  exitCode = $exitCode
  errors = @($errors)
  warnings = @($warnings)
}

if ($resolvedOutPath) {
  New-Item -Path (Split-Path -Parent $resolvedOutPath) -ItemType Directory -Force | Out-Null
  ($report | ConvertTo-Json -Depth 5) + "`n" | Set-Content -Path $resolvedOutPath -Encoding UTF8
}

if ($Json.IsPresent) {
  Write-Output ($report | ConvertTo-Json -Depth 5)
}

Write-Host ""
Write-Host "Ops readiness summary:"
Write-Host "- Errors: $($errors.Count)"
Write-Host "- Warnings: $($warnings.Count)"

foreach ($err in $errors) {
  Write-Host "ERROR: $err"
}

foreach ($warn in $warnings) {
  Write-Host "WARN: $warn"
}

if ($exitCode -eq 2) {
  Write-Host "Strict mode failed because warnings are present."
}

Write-Host "Ops readiness check: $status"
exit $exitCode
