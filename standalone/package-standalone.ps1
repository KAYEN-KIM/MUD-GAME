# 독립 실행형 패키지 생성 스크립트

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  독립 실행형 패키지 생성" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$packageName = "mud-game-standalone"
$packageDir = "dist\$packageName"

# 기존 패키지 삭제
if (Test-Path $packageDir) {
    Write-Host "[1/6] 기존 패키지 삭제 중..." -ForegroundColor Yellow
    Remove-Item $packageDir -Recurse -Force
}

# 패키지 디렉토리 생성
Write-Host "[2/6] 패키지 디렉토리 생성 중..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
New-Item -ItemType Directory -Path "$packageDir\server" -Force | Out-Null
New-Item -ItemType Directory -Path "$packageDir\client" -Force | Out-Null

# 서버 파일 복사
Write-Host "[3/6] 서버 파일 복사 중..." -ForegroundColor Yellow
Copy-Item "standalone\*" -Destination "$packageDir\server" -Recurse -Exclude "*.md"
Copy-Item "apps\server" -Destination "$packageDir\server\apps" -Recurse

# 클라이언트 파일 복사
Write-Host "[4/6] 클라이언트 파일 복사 중..." -ForegroundColor Yellow
Copy-Item "dist\mud_client\*" -Destination "$packageDir\client" -Recurse

# README 복사
Write-Host "[5/6] 문서 파일 복사 중..." -ForegroundColor Yellow
Copy-Item "standalone\README.md" -Destination "$packageDir\README.md"

# 통합 시작 스크립트 생성
Write-Host "[6/6] 통합 시작 스크립트 생성 중..." -ForegroundColor Yellow

$startScript = @"
@echo off
chcp 65001 >nul
echo ========================================
echo   MUD 게임 독립 실행형 패키지
echo ========================================
echo.

REM Docker 확인
docker info >nul 2>&1
if errorlevel 1 (
    echo [오류] Docker Desktop이 실행되지 않았습니다.
    echo Docker Desktop을 설치하고 실행한 후 다시 시도하세요.
    echo.
    echo 다운로드: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [1/2] 서버 시작 중...
cd /d "%~dp0server"
call start-server.bat

echo.
echo [2/2] 클라이언트 실행 중...
echo 잠시 후 클라이언트가 자동으로 실행됩니다...
timeout /t 3 /nobreak >nul

cd /d "%~dp0client"
start mud_client.exe

echo.
echo 서버와 클라이언트가 시작되었습니다!
echo 서버를 중지하려면 server 폴더의 stop-server.bat를 실행하세요.
pause
"@

$startScript | Out-File -FilePath "$packageDir\start-game.bat" -Encoding UTF8

# 패키지 정보 파일 생성
$packageInfo = @{
    name = "MUD Game Standalone"
    version = "1.0.0"
    created = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    description = "독립 실행형 MUD 게임 패키지"
} | ConvertTo-Json

$packageInfo | Out-File -FilePath "$packageDir\package-info.json" -Encoding UTF8

Write-Host ""
Write-Host "✅ 패키지 생성 완료!" -ForegroundColor Green
Write-Host "위치: $((Resolve-Path $packageDir).Path)" -ForegroundColor Cyan
Write-Host ""
Write-Host "배포 방법:" -ForegroundColor Yellow
Write-Host "  1. $packageDir 폴더 전체를 ZIP으로 압축" -ForegroundColor White
Write-Host "  2. 사용자에게 배포" -ForegroundColor White
Write-Host "  3. 사용자는 Docker Desktop 설치 후 start-game.bat 실행" -ForegroundColor White
Write-Host ""
