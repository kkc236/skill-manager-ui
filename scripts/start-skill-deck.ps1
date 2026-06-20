$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AppUrl = "http://127.0.0.1:5173/"
$HealthUrl = "http://127.0.0.1:5174/api/health"
$LogDir = Join-Path $ProjectRoot ".logs"
$LogPath = Join-Path $LogDir "skill-deck-dev.log"
$BootstrapScript = Join-Path $PSScriptRoot "bootstrap.mjs"

node $BootstrapScript

function Test-LocalUrl {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

$appRunning = Test-LocalUrl $AppUrl
$apiRunning = Test-LocalUrl $HealthUrl

if ($appRunning -and $apiRunning) {
  Start-Process $AppUrl
  exit 0
}

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

$escapedProjectRoot = $ProjectRoot.Replace("'", "''")
$escapedLogPath = $LogPath.Replace("'", "''")

function Start-DeckProcess {
  param([string]$Command)

  $wrappedCommand = "Set-Location -LiteralPath '$escapedProjectRoot'; $Command *>> '$escapedLogPath'"

  Start-Process powershell.exe `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", $wrappedCommand) `
    -WindowStyle Minimized `
    -WorkingDirectory $ProjectRoot
}

if (-not $appRunning -and -not $apiRunning) {
  Start-DeckProcess "corepack pnpm dev -- --port 5173"
} elseif (-not $apiRunning) {
  Start-DeckProcess "corepack pnpm dev:api"
} elseif (-not $appRunning) {
  Start-DeckProcess "corepack pnpm dev:ui -- --port 5173"
}

for ($attempt = 0; $attempt -lt 45; $attempt++) {
  if ((Test-LocalUrl $AppUrl) -and (Test-LocalUrl $HealthUrl)) {
    Start-Process $AppUrl
    exit 0
  }

  Start-Sleep -Seconds 1
}

Start-Process $AppUrl
