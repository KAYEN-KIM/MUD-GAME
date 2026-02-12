# 독립 실행형 패키지를 위한 데이터베이스 준비 스크립트
# 개발 환경에서 SQLite 데이터베이스를 생성하고 시드 데이터를 삽입합니다.

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  데이터베이스 준비 (SQLite)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 프로젝트 루트로 이동
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

$dbDir = "standalone-no-docker\temp-db"
$dbPath = "$dbDir\game.db"
$serverDir = "apps\server"

# 1. 임시 데이터베이스 디렉토리 생성
Write-Host "[1/5] 임시 데이터베이스 디렉토리 생성 중..." -ForegroundColor Yellow
if (Test-Path $dbDir) {
    Remove-Item $dbDir -Recurse -Force
}
New-Item -ItemType Directory -Path $dbDir -Force | Out-Null
Write-Host "  ✅ 디렉토리 생성 완료" -ForegroundColor Green

# 2. SQLite 스키마 생성
Write-Host "[2/5] SQLite 스키마 생성 중..." -ForegroundColor Yellow
Set-Location $projectRoot

# schema.sqlite.prisma가 없으면 변환 스크립트 실행
$sqliteSchema = "$serverDir\prisma\schema.sqlite.prisma"
if (-not (Test-Path $sqliteSchema)) {
    Write-Host "  SQLite 스키마 파일이 없습니다. 변환 스크립트 실행 중..." -ForegroundColor Yellow
    $convertScript = "standalone-no-docker\convert-to-sqlite-complete.js"
    if (Test-Path $convertScript) {
        node $convertScript
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR SQLite schema conversion failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "  OK SQLite schema created" -ForegroundColor Green
    } else {
        Write-Host "  ERROR Conversion script not found: $convertScript" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  OK SQLite schema file found" -ForegroundColor Green
}

Set-Location $serverDir

# Prisma 클라이언트 생성 (SQLite 스키마 사용)
$env:DATABASE_URL = "file:$($projectRoot -replace '\\', '/')/$($dbPath -replace '\\', '/')"
$schemaRelativePath = "prisma\schema.sqlite.prisma"
npx prisma generate --schema=$schemaRelativePath
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR Prisma client generation failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK Prisma client generated" -ForegroundColor Green

# 3. 데이터베이스 스키마 생성
Write-Host "[3/5] 데이터베이스 스키마 생성 중..." -ForegroundColor Yellow
npx prisma db push --schema=$schemaRelativePath --accept-data-loss
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR Database schema creation failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK Database schema created" -ForegroundColor Green

# 4. 시드 데이터 삽입
Write-Host "[4/5] 시드 데이터 삽입 중..." -ForegroundColor Yellow
# 시드 스크립트가 SQLite를 사용하도록 DATABASE_URL 설정
$env:DATABASE_URL = "file:$($projectRoot -replace '\\', '/')/$($dbPath -replace '\\', '/')"
npx tsx prisma\seed.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR Seed data insertion failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK Seed data inserted" -ForegroundColor Green

# 5. 데이터베이스 파일 확인
Write-Host "[5/5] 데이터베이스 파일 확인 중..." -ForegroundColor Yellow
Set-Location $projectRoot
$fullDbPath = Join-Path $projectRoot $dbPath
if (Test-Path $fullDbPath) {
    $dbSize = (Get-Item $fullDbPath).Length
    $dbSizeKB = [math]::Round($dbSize/1024, 2)
    Write-Host "  OK Database file created: $fullDbPath ($dbSizeKB KB)" -ForegroundColor Green
} else {
    Write-Host "  ERROR Database file not found: $fullDbPath" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Database preparation complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database file: $dbPath" -ForegroundColor Green
Write-Host "This file will be copied to standalone package by setup-standalone.ps1" -ForegroundColor Yellow
Write-Host ""
