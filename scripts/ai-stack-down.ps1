$ErrorActionPreference = "Stop"
Push-Location (Split-Path -Path $PSScriptRoot -Parent)
try {
  docker compose -f "infra/ai-stack/docker-compose.yml" down
} finally {
  Pop-Location
}
