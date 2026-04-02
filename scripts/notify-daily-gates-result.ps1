param(
  [int]$ExitCode,
  [string]$LogFile = "",
  [string]$ReportPath = "data/backups/release-gate/latest-release-gate-admin.json",
  [switch]$ForceNotify
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

function Get-IntConfig {
  param(
    [string]$Raw,
    [int]$Fallback,
    [int]$Min,
    [int]$Max
  )

  $parsed = 0
  if (-not [int]::TryParse([string]$Raw, [ref]$parsed)) {
    return $Fallback
  }

  if ($parsed -lt $Min) {
    return $Min
  }

  if ($parsed -gt $Max) {
    return $Max
  }

  return $parsed
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedReportPath = Join-Path $projectRoot $ReportPath
$opsLogDir = Join-Path $projectRoot "data/backups/ops-logs"
if (-not (Test-Path $opsLogDir)) {
  New-Item -Path $opsLogDir -ItemType Directory -Force | Out-Null
}

$report = $null
if (Test-Path $resolvedReportPath) {
  $report = Get-Content -Path $resolvedReportPath -Raw | ConvertFrom-Json
}

$gateStatus = if ($report -and $report.goNoGo) { [string]$report.goNoGo } else { if ($ExitCode -eq 0) { "GO" } else { "NO-GO" } }
$mode = if ($report -and $report.mode) { [string]$report.mode } else { "unknown" }
$stepsPassed = if ($report -and $report.stepsPassed -ne $null) { [string]$report.stepsPassed } else { "?" }
$stepsTotal = if ($report -and $report.stepsTotal -ne $null) { [string]$report.stepsTotal } else { "?" }
$failedStep = if ($report -and $report.failedStep -and $report.failedStep.script) { [string]$report.failedStep.script } else { "" }

$summary = [ordered]@{
  timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")
  goNoGo = $gateStatus
  exitCode = $ExitCode
  mode = $mode
  stepsPassed = $stepsPassed
  stepsTotal = $stepsTotal
  failedStep = $failedStep
  logFile = $LogFile
  reportPath = $resolvedReportPath
}

$summaryPath = Join-Path $opsLogDir "latest-daily-gates-summary.json"
($summary | ConvertTo-Json -Depth 5) + "`n" | Set-Content -Path $summaryPath -Encoding UTF8
Write-Host "Summary written: $summaryPath"

$envPath = Join-Path $projectRoot ".env"
$webhookFromEnvVar = [string]$env:OPS_ALERT_WEBHOOK_URL
$webhookFromFile = Get-ConfigFromEnvFile -EnvPath $envPath -Key "OPS_ALERT_WEBHOOK_URL"
$enabledFromEnvVar = [string]$env:OPS_ALERT_WEBHOOK_ENABLED
$enabledFromFile = Get-ConfigFromEnvFile -EnvPath $envPath -Key "OPS_ALERT_WEBHOOK_ENABLED"
$notifySuccessFromEnvVar = [string]$env:OPS_ALERT_ON_SUCCESS
$notifySuccessFromFile = Get-ConfigFromEnvFile -EnvPath $envPath -Key "OPS_ALERT_ON_SUCCESS"
$retryCountFromEnvVar = [string]$env:OPS_ALERT_RETRY_COUNT
$retryCountFromFile = Get-ConfigFromEnvFile -EnvPath $envPath -Key "OPS_ALERT_RETRY_COUNT"
$timeoutFromEnvVar = [string]$env:OPS_ALERT_TIMEOUT_SECONDS
$timeoutFromFile = Get-ConfigFromEnvFile -EnvPath $envPath -Key "OPS_ALERT_TIMEOUT_SECONDS"

$webhookUrl = if ($webhookFromEnvVar) { $webhookFromEnvVar } else { $webhookFromFile }
$webhookEnabledRaw = if ($enabledFromEnvVar) { $enabledFromEnvVar } else { $enabledFromFile }
$notifySuccessRaw = if ($notifySuccessFromEnvVar) { $notifySuccessFromEnvVar } else { $notifySuccessFromFile }
$retryCountRaw = if ($retryCountFromEnvVar) { $retryCountFromEnvVar } else { $retryCountFromFile }
$timeoutRaw = if ($timeoutFromEnvVar) { $timeoutFromEnvVar } else { $timeoutFromFile }

$webhookEnabled = $true
if ($webhookEnabledRaw) {
  $webhookEnabled = $webhookEnabledRaw.Trim().ToLower() -eq "true"
}

$notifyOnSuccess = $false
if ($notifySuccessRaw) {
  $notifyOnSuccess = $notifySuccessRaw.Trim().ToLower() -eq "true"
}

$retryCount = Get-IntConfig -Raw $retryCountRaw -Fallback 2 -Min 1 -Max 5
$timeoutSeconds = Get-IntConfig -Raw $timeoutRaw -Fallback 10 -Min 2 -Max 60

$shouldNotify = $ForceNotify.IsPresent -or ($ExitCode -ne 0) -or $notifyOnSuccess
$summary.webhookEnabled = $webhookEnabled
$summary.webhookConfigured = [bool]$webhookUrl
$summary.notificationAttempted = $false
$summary.notificationSent = $false
$summary.webhookRetryCount = $retryCount
$summary.webhookTimeoutSeconds = $timeoutSeconds
if (-not $webhookEnabled) {
  ($summary | ConvertTo-Json -Depth 5) + "`n" | Set-Content -Path $summaryPath -Encoding UTF8
  Write-Host "Webhook notifications disabled (OPS_ALERT_WEBHOOK_ENABLED=false)."
  exit 0
}
if (-not $webhookUrl) {
  ($summary | ConvertTo-Json -Depth 5) + "`n" | Set-Content -Path $summaryPath -Encoding UTF8
  Write-Host "No webhook configured (OPS_ALERT_WEBHOOK_URL not set)."
  exit 0
}
if (-not $shouldNotify) {
  ($summary | ConvertTo-Json -Depth 5) + "`n" | Set-Content -Path $summaryPath -Encoding UTF8
  Write-Host "No notification sent (success and OPS_ALERT_ON_SUCCESS is not true)."
  exit 0
}

$statusText = if ($ExitCode -eq 0) { "SUCCESS" } else { "FAILURE" }
$failedStepText = if ($failedStep) { " failedStep=$failedStep" } else { "" }
$message = "MAGNETO Daily Gates Admin $statusText | goNoGo=$gateStatus | exitCode=$ExitCode | steps=$stepsPassed/$stepsTotal$failedStepText"

$payload = @{ text = $message } | ConvertTo-Json -Depth 3

$summary.notificationAttempted = $true

$sent = $false
for ($attempt = 1; $attempt -le $retryCount; $attempt++) {
  try {
    Invoke-RestMethod -Method Post -Uri $webhookUrl -ContentType "application/json" -Body $payload -TimeoutSec $timeoutSeconds | Out-Null
    Write-Host "Webhook notification sent (attempt $attempt/$retryCount)."
    $sent = $true
    break
  } catch {
    Write-Warning "Webhook notification attempt $attempt/$retryCount failed: $($_.Exception.Message)"
    if ($attempt -lt $retryCount) {
      Start-Sleep -Seconds 2
    }
  }
}

$summary.notificationSent = $sent
($summary | ConvertTo-Json -Depth 5) + "`n" | Set-Content -Path $summaryPath -Encoding UTF8
