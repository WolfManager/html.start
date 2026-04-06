param(
  [switch]$WithLangfuse
)

$ErrorActionPreference = "Stop"
Push-Location (Split-Path -Path $PSScriptRoot -Parent)
try {
  docker compose --env-file ".env" -f "infra/ai-stack/docker-compose.yml" down
  if ($WithLangfuse) {
    docker compose --env-file ".env" -f "infra/langfuse/docker-compose.yml" down
  }
} finally {
  Pop-Location
}
