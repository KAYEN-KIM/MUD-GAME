# 독립 실행형 서버 빌드 스크립트 (pkg 사용)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  독립 실행형 서버 빌드 (실행 파일 생성)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 프로젝트 루트로 이동
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

$packageDir = "dist\mud-game-standalone-no-docker"
$serverDir = "$packageDir\server"

# 1. pkg 설치 확인
Write-Host "[1/5] pkg 설치 확인 중..." -ForegroundColor Yellow
$pkgInstalled = npm list -g pkg 2>$null
if (-not $pkgInstalled) {
    Write-Host "  pkg를 전역으로 설치합니다..." -ForegroundColor Yellow
    npm install -g pkg
}

# 2. 서버 빌드
Write-Host "[2/5] 서버 빌드 중..." -ForegroundColor Yellow
Set-Location "apps\server"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  오류: 서버 빌드 실패" -ForegroundColor Red
    exit 1
}
Set-Location $projectRoot

# 3. Prisma 클라이언트 생성 (SQLite용)
Write-Host "[3/5] Prisma 클라이언트 생성 중..." -ForegroundColor Yellow
Set-Location $serverDir

# 스키마 파일의 BOM 제거 및 UTF-8로 저장
if (Test-Path "prisma\schema.prisma") {
    $schemaContent = Get-Content "prisma\schema.prisma" -Raw -Encoding UTF8
    # BOM 제거
    $schemaContent = $schemaContent -replace '^\xEF\xBB\xBF', ''
    # UTF-8로 저장 (BOM 없이)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText("$serverDir\prisma\schema.prisma", $schemaContent, $utf8NoBom)
    
    npx prisma generate --schema=prisma/schema.prisma
} else {
    Write-Host "  경고: schema.prisma를 찾을 수 없습니다" -ForegroundColor Yellow
}
Set-Location $projectRoot

# 4. pkg로 실행 파일 생성
Write-Host "[4/5] 실행 파일 생성 중 (pkg)..." -ForegroundColor Yellow
Set-Location $serverDir

# package.json에 pkg 설정 추가
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
if (-not $packageJson.pkg) {
    $packageJson | Add-Member -MemberType NoteProperty -Name "pkg" -Value @{
        scripts = @("dist/**/*.js")
        assets = @("prisma/**/*", "content/**/*", "src/content/**/*")
        outputPath = "server.exe"
    } -Force
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
}

# pkg 실행
pkg dist/main.js --targets node20-win-x64 --output server.exe
Set-Location $projectRoot

# 5. 시작 스크립트 업데이트
Write-Host "[5/5] 시작 스크립트 업데이트 중..." -ForegroundColor Yellow
$startScript = @"
@echo off
chcp 65001 >nul
echo ========================================
echo   MUD 게임 시작 (완전 독립 실행형)
echo ========================================
echo.

cd /d "%~dp0"

REM 서버 시작
echo [1/2] 서버 시작 중...
start /B server\server.exe

REM 서버 준비 대기
echo 서버 준비 대기 중...
timeout /t 5 /nobreak >nul

REM 클라이언트 실행
echo [2/2] 클라이언트 실행 중...
start client\mud_client.exe

echo.
echo ========================================
echo   게임이 시작되었습니다!
echo ========================================
echo.
echo 서버를 중지하려면:
echo   작업 관리자에서 server.exe 프로세스를 종료하세요
echo.
pause
"@

Set-Content -Path "$packageDir\start-game.bat" -Value $startScript -Encoding UTF8

Write-Host ""
Write-Host "✅ 독립 실행형 서버 빌드 완료!" -ForegroundColor Green
Write-Host "위치: $((Resolve-Path $packageDir).Path)" -ForegroundColor Cyan
Write-Host ""
Write-Host "이제 다른 PC에서 추가 설치 없이 실행 가능합니다!" -ForegroundColor Green
Write-Host "  - Node.js 불필요" -ForegroundColor White
Write-Host "  - Docker 불필요" -ForegroundColor White
Write-Host "  - PostgreSQL 불필요" -ForegroundColor White
Write-Host "  - Redis 불필요" -ForegroundColor White
Write-Host ""
Write-Host "배포 방법:" -ForegroundColor Yellow
Write-Host "  1. $packageDir 폴더 전체를 ZIP으로 압축" -ForegroundColor White
Write-Host "  2. 다른 PC에 압축 해제" -ForegroundColor White
Write-Host "  3. start-game.bat 실행" -ForegroundColor White
Write-Host ""
