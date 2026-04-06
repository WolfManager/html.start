$ErrorActionPreference = "Stop"
Push-Location (Split-Path -Path $PSScriptRoot -Parent)
try {
  docker compose --env-file ".env" -f "infra/langfuse/docker-compose.yml" down
} finally {
  Pop-Location
}
