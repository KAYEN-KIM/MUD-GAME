# MUD Game 개발 환경 한 번에 실행 스크립트
# 인프라 → DB 준비 → 서버 → Flutter 앱

# 한글 인코딩 설정 (더 강력한 방법)
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

$ErrorActionPreference = "Stop"

Write-Host "Starting MUD Game Development Environment..." -ForegroundColor Cyan
Write-Host ""

# 현재 디렉토리 저장
$scriptDir = $PSScriptRoot
if (-not $scriptDir) {
    $scriptDir = Get-Location
}

# 1. 인프라 시작 (PostgreSQL, Redis)
Write-Host "[1/6] Starting Infrastructure (PostgreSQL, Redis)..." -ForegroundColor Yellow
Set-Location $scriptDir

# 기존 컨테이너 정리 (포트 충돌 방지)
Write-Host "[INFO] Cleaning up existing containers..." -ForegroundColor Cyan
try { docker rm -f mud-redis 2>&1 | Out-Null } catch { }
try { docker rm -f mud-postgres 2>&1 | Out-Null } catch { }
Start-Sleep -Seconds 2

pnpm infra:up
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Infrastructure start failed" -ForegroundColor Red
    Write-Host "[INFO] Try: docker rm -f mud-redis mud-postgres" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Infrastructure started" -ForegroundColor Green

# DATABASE_URL 환경 변수 설정 (포트 15432 사용)
$env:DATABASE_URL = "postgresql://mud:mudpass@localhost:15432/mud"
Write-Host "[INFO] DATABASE_URL set to port 15432" -ForegroundColor Cyan
Write-Host ""

# 2. DB 대기
Write-Host "[2/6] Waiting for PostgreSQL..." -ForegroundColor Yellow
pnpm db:wait
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] DB wait failed" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] DB ready" -ForegroundColor Green
Write-Host ""

# 3. 마이그레이션
Write-Host "[3/6] DB Migration..." -ForegroundColor Yellow
Set-Location "$scriptDir\apps\server"

# 마이그레이션 실행
$migrateOutput = npx prisma migrate deploy 2>&1 | Out-String
$migrateExitCode = $LASTEXITCODE

if ($migrateExitCode -ne 0) {
    Write-Host "[WARN] Migration failed, checking for failed migrations..." -ForegroundColor Yellow
    
    # 실패한 마이그레이션 resolve 시도
    if ($migrateOutput -match "failed migrations" -or $migrateOutput -match "P3009") {
        Write-Host "[INFO] Resolving failed migrations..." -ForegroundColor Cyan
        # 일반적인 실패 마이그레이션들 resolve 시도 (이미 적용된 경우 무시)
        npx prisma migrate resolve --applied 20251221000000_add_cosmetic_fields 2>&1 | Out-Null
        npx prisma migrate resolve --applied 20251222000000_add_party_code 2>&1 | Out-Null
        
        # 다시 시도
        Write-Host "[INFO] Retrying migration..." -ForegroundColor Cyan
        npx prisma migrate deploy
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Migration still failed after resolve." -ForegroundColor Red
            Write-Host "[INFO] You may need to manually resolve: npx prisma migrate resolve --applied <migration_name>" -ForegroundColor Yellow
            Set-Location $scriptDir
            exit 1
        }
    } elseif ($migrateOutput -match "No pending migrations" -or $migrateOutput -match "already recorded") {
        # 이미 적용된 경우는 성공으로 간주
        Write-Host "[OK] Migrations already applied" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Migration failed. Please check the error above." -ForegroundColor Red
        Set-Location $scriptDir
        exit 1
    }
} else {
    # 성공 또는 "No pending migrations" 메시지 확인
    if ($migrateOutput -match "No pending migrations") {
        Write-Host "[OK] All migrations already applied" -ForegroundColor Green
    } else {
        Write-Host "[OK] Migrations applied successfully" -ForegroundColor Green
    }
}

Set-Location $scriptDir
Write-Host ""

# 4. 시드
Write-Host "[4/6] Seeding database..." -ForegroundColor Yellow
Set-Location "$scriptDir\apps\server"
npx prisma db seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Seed failed" -ForegroundColor Red
    Set-Location $scriptDir
    exit 1
}
Set-Location $scriptDir
Write-Host "[OK] Seed completed" -ForegroundColor Green
Write-Host ""

# 5. 서버 실행 (새 창)
Write-Host "[5/6] Starting server..." -ForegroundColor Yellow

# DATABASE_URL 환경 변수 설정 (포트 15432 사용)
$env:DATABASE_URL = "postgresql://mud:mudpass@localhost:15432/mud"

# 기존 서버 프로세스 종료 (포트 3000 사용 중인 프로세스)
Write-Host "[INFO] Checking for existing server processes on port 3000..." -ForegroundColor Cyan
try {
    $port3000Processes = netstat -ano | Select-String ":3000.*LISTENING" | ForEach-Object {
        if ($_ -match '\s+(\d+)$') {
            $matches[1]
        }
    } | Select-Object -Unique
    
    if ($port3000Processes) {
        Write-Host "[INFO] Found processes using port 3000: $($port3000Processes -join ', ')" -ForegroundColor Yellow
        foreach ($pid in $port3000Processes) {
            try {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Host "[OK] Stopped process $pid" -ForegroundColor Green
            } catch {
                Write-Host "[WARN] Could not stop process $pid" -ForegroundColor Yellow
            }
        }
        Start-Sleep -Seconds 2
    } else {
        Write-Host "[OK] No existing processes on port 3000" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARN] Could not check for existing processes" -ForegroundColor Yellow
}

Write-Host "Server will run in a new PowerShell window." -ForegroundColor Cyan
$serverCommand = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `$OutputEncoding = [System.Text.Encoding]::UTF8; chcp 65001 | Out-Null; `$env:DATABASE_URL='postgresql://mud:mudpass@localhost:15432/mud'; cd '$scriptDir'; pnpm dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $serverCommand
Start-Sleep -Seconds 3

# 서버 시작 대기 (Health check)
Write-Host "Waiting for server to start..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$serverReady = $false

while ($attempt -lt $maxAttempts -and -not $serverReady) {
    Start-Sleep -Seconds 2
    $attempt++
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
            Write-Host "[OK] Server ready!" -ForegroundColor Green
        }
    } catch {
        if ($attempt % 5 -eq 0) {
            Write-Host "." -NoNewline -ForegroundColor Gray
        }
    }
}

if (-not $serverReady) {
    Write-Host "`n[WARN] Server may not be ready, but continuing..." -ForegroundColor Yellow
    Write-Host "Please check the server window." -ForegroundColor Yellow
}
Write-Host ""

# 6. Flutter 앱 실행
Write-Host "[6/6] Running Flutter app..." -ForegroundColor Yellow
Write-Host "Connected devices:" -ForegroundColor Cyan
Set-Location $scriptDir
flutter devices
Write-Host ""

# Android 기기 자동 선택 (flutter devices --machine 사용)
$androidDeviceId = $null
$androidDeviceName = $null

try {
    $jsonOutput = flutter devices --machine 2>&1 | ConvertFrom-Json
    # Android 모바일 디바이스 찾기 (targetPlatform에 android 포함)
    $androidDevice = $jsonOutput | Where-Object { 
        $_.targetPlatform -like "*android*" -and 
        $_.category -eq "mobile" 
    } | Select-Object -First 1
    
    if ($androidDevice) {
        $androidDeviceName = $androidDevice.name
        $androidDeviceId = $androidDevice.id
        Write-Host "[OK] Android device found: $androidDeviceName ($androidDeviceId)" -ForegroundColor Green
    } else {
        # 모바일 카테고리 없이도 android 플랫폼이면 사용
        $androidDevice = $jsonOutput | Where-Object { 
            $_.targetPlatform -like "*android*" 
        } | Select-Object -First 1
        
        if ($androidDevice) {
            $androidDeviceName = $androidDevice.name
            $androidDeviceId = $androidDevice.id
            Write-Host "[OK] Android device found: $androidDeviceName ($androidDeviceId)" -ForegroundColor Green
        } else {
            Write-Host "[WARN] Could not auto-detect Android device." -ForegroundColor Yellow
            Write-Host "Please select a device manually." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "[WARN] Could not auto-detect Android device." -ForegroundColor Yellow
    Write-Host "Please select a device manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting Flutter app... (Press Ctrl+C to stop)" -ForegroundColor Cyan
Write-Host ""

Set-Location "$scriptDir\mud_client"

if ($androidDeviceId) {
    flutter run -d $androidDeviceId
} else {
    flutter run
}

