param(
  [switch]$WithLangfuse,
  [switch]$NoPull
)

$ErrorActionPreference = "Stop"
Push-Location (Split-Path -Path $PSScriptRoot -Parent)
try {
  if ($WithLangfuse) {
    $langfuseArgs = @("compose", "--env-file", ".env", "-f", "infra/langfuse/docker-compose.yml", "up", "-d")
    if (-not $NoPull) {
      $langfuseArgs += "--pull"
      $langfuseArgs += "missing"
    }
    docker @langfuseArgs
    $env:LITELLM_CONFIG_FILE = "litellm.langfuse.config.yaml"
  } else {
    $env:LITELLM_CONFIG_FILE = "litellm.config.yaml"
  }

  $composeArgs = @("compose", "--env-file", ".env", "-f", "infra/ai-stack/docker-compose.yml", "up", "-d")
  if (-not $NoPull) {
    $composeArgs += "--pull"
    $composeArgs += "missing"
  }
  docker @composeArgs
} finally {
  Remove-Item Env:LITELLM_CONFIG_FILE -ErrorAction SilentlyContinue
  Pop-Location
}
