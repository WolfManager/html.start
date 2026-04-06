param(
  [switch]$NoPull
)

$ErrorActionPreference = "Stop"
Push-Location (Split-Path -Path $PSScriptRoot -Parent)
try {
  $composeArgs = @("compose", "--env-file", ".env", "-f", "infra/langfuse/docker-compose.yml", "up", "-d")
  if (-not $NoPull) {
    $composeArgs += "--pull"
    $composeArgs += "missing"
  }
  docker @composeArgs
} finally {
  Pop-Location
}
