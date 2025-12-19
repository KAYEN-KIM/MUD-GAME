param(
  [switch]$SkipDocker,
  [switch]$SkipMigrate,
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

# 터미널에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 강제 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Info($m){ Write-Host "==> $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Die($m){ Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }

# Resolve repo root (script location -> repo root)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $repoRoot

Info "Repo root: $repoRoot"

# (A) Optional: Docker compose up -d (if compose file exists)
if (-not $SkipDocker) {
  # 우선순위: 루트 docker-compose.yml/compose.yml → infra/docker-compose.yml/compose.yml
  $composeCandidates = @(
    (Join-Path $repoRoot "docker-compose.yml"),
    (Join-Path $repoRoot "compose.yml"),
    (Join-Path $repoRoot "infra/docker-compose.yml"),
    (Join-Path $repoRoot "infra/compose.yml")
  )

  $composeFile = $null
  foreach ($candidate in $composeCandidates) {
    if (Test-Path $candidate) {
      $composeFile = $candidate
      break
    }
  }

  if ($composeFile) {
    $composeDir = Split-Path -Parent $composeFile
    Info "Docker compose detected at $composeFile. Starting services (db) ..."
    Push-Location $composeDir
    try {
      docker compose -f $composeFile up -d | Out-Host
    } catch {
      Warn "Docker compose failed or not installed. Continuing without docker. Details: $($_.Exception.Message)"
    } finally {
      Pop-Location
    }
  } else {
    Warn "No docker-compose.yml/compose.yml found in repo root or infra/. Skipping docker."
  }
} else {
  Warn "SkipDocker enabled."
}

# (B) Server: migrate + seed + start (TEST_MODE=false)
$serverDir = Join-Path $repoRoot "apps/server"
if (-not (Test-Path $serverDir)) { Die "apps/server not found." }

Info "Server dir: $serverDir"

if (-not $SkipMigrate) {
  Info "Running prisma migrate deploy ..."
  Push-Location $serverDir
  try {
    pnpm prisma migrate deploy | Out-Host
  } catch {
    Die "Prisma migrate deploy failed. Check database connection and migrations. Details: $($_.Exception.Message)"
  }
  Pop-Location
} else {
  Warn "SkipMigrate enabled."
}

if (-not $SkipSeed) {
  Info "Running prisma seed ..."
  Push-Location $serverDir
  pnpm prisma:seed | Out-Host
  Pop-Location
} else {
  Warn "SkipSeed enabled."
}

# Start server in a separate process so flutter can run in this terminal
Info "Starting server (TEST_MODE=false) ..."
$env:TEST_MODE = "false"
$serverCmd = "Set-Location -Path '$serverDir'; pnpm dev"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", $serverCmd | Out-Null

# (C) Flutter: pick first android device and run
$clientDir = Join-Path $repoRoot "mud_client"
if (-not (Test-Path $clientDir)) { Die "mud_client not found." }

Info "Client dir: $clientDir"

Push-Location $clientDir
Info "flutter pub get ..."
flutter pub get | Out-Host

Info "Detecting flutter devices ..."
$devicesJson = flutter devices --machine | Out-String
if (-not $devicesJson -or $devicesJson.Trim().Length -lt 5) {
  Die "No flutter devices output. Is Flutter installed and on PATH?"
}

try {
  $devices = $devicesJson | ConvertFrom-Json
} catch {
  Die "Failed to parse flutter devices --machine output."
}

# Flutter JSON 스키마 변경을 고려해서 targetPlatform / platformType 기준으로 안드로이드 디바이스 탐색
$androidCandidates = $devices | Where-Object {
  ($_.targetPlatform -like "android*" -or $_.platformType -eq "android") -and
  ($_.isSupported -ne $false)
}

# 에뮬레이터 우선 선택, 없으면 아무 안드로이드 디바이스나 선택
$android = $androidCandidates | Where-Object { $_.emulator -eq $true } | Select-Object -First 1
if (-not $android) {
  $android = $androidCandidates | Select-Object -First 1
}

if (-not $android) {
  Warn "flutter devices --machine raw output (for debug):"
  Warn $devicesJson
  Die "No Android device found. Start an emulator in Android Studio (Device Manager) then rerun: powershell -ExecutionPolicy Bypass -File tools/run_manual_verify.ps1"
}

Info "Selected device: $($android.name) ($($android.id))"
Info "Starting Flutter app ..."
flutter run -d $android.id
Pop-Location



