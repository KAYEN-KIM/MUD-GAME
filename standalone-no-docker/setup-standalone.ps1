# 독립 실행형 패키지 설정 스크립트

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  독립 실행형 패키지 설정" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 프로젝트 루트로 이동
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

$packageDir = "dist\mud-game-standalone-no-docker"
$dbSourcePath = "standalone-no-docker\temp-db\game.db"

# 1. 패키지 디렉토리 생성
Write-Host "[1/6] 패키지 디렉토리 생성 중..." -ForegroundColor Yellow
if (Test-Path $packageDir) {
    Remove-Item $packageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
New-Item -ItemType Directory -Path "$packageDir\server" -Force | Out-Null
New-Item -ItemType Directory -Path "$packageDir\client" -Force | Out-Null
New-Item -ItemType Directory -Path "$packageDir\data" -Force | Out-Null

# 2. SQLite 스키마 생성
Write-Host "[2/6] SQLite 스키마 생성 중..." -ForegroundColor Yellow
$postgresSchema = "apps\server\prisma\schema.prisma"
$sqliteSchema = "apps\server\prisma\schema.sqlite.prisma"

if (Test-Path $postgresSchema) {
    $schema = Get-Content $postgresSchema -Raw -Encoding UTF8
    $schema = $schema -replace 'provider = "postgresql"', 'provider = "sqlite"'
    $schema = $schema -replace '@db\.Text', ''
    $schema = $schema -replace 'Json\?', 'String?'
    $schema = $schema -replace 'Json ', 'String '
    Set-Content -Path $sqliteSchema -Value $schema -Encoding UTF8
    Write-Host "  SQLite 스키마 생성 완료" -ForegroundColor Green
} else {
    Write-Host "  경고: PostgreSQL 스키마를 찾을 수 없습니다: $postgresSchema" -ForegroundColor Yellow
}

# 3. 서버 빌드 및 실행 파일 생성
Write-Host "[3/7] 서버 빌드 중..." -ForegroundColor Yellow
Set-Location "apps\server"

# 서버 빌드
Write-Host "  Building server..." -ForegroundColor Yellow
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR Server build failed" -ForegroundColor Red
    Set-Location $projectRoot
    exit 1
}

# pkg로 실행 파일 생성 (선택사항)
Write-Host "  Creating executable with pkg..." -ForegroundColor Yellow
$pkgInstalled = $false
if (Get-Command pkg -ErrorAction SilentlyContinue) {
    $pkgInstalled = $true
} else {
    Write-Host "  WARNING pkg not found. Installing..." -ForegroundColor Yellow
    npm install -g pkg 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $pkgInstalled = $true
    }
}

if ($pkgInstalled) {
    # Prisma 엔진 파일 포함을 위한 assets 설정
    pkg dist/main.js --targets node18-win-x64 --output server.exe --assets "node_modules/.prisma/**/*" --assets "node_modules/@prisma/client/**/*"
    if ($LASTEXITCODE -eq 0 -and (Test-Path "server.exe")) {
        Write-Host "  OK server.exe created with pkg" -ForegroundColor Green
    } else {
        Write-Host "  WARNING pkg build failed, will use node instead" -ForegroundColor Yellow
        $pkgInstalled = $false
    }
} else {
    Write-Host "  WARNING pkg not available, will use node instead" -ForegroundColor Yellow
}

Set-Location $projectRoot

# 서버 파일 복사
Write-Host "[4/7] 서버 파일 복사 중..." -ForegroundColor Yellow
if (Test-Path "apps\server") {
    # node_modules와 dist 제외하고 복사
    Get-ChildItem "apps\server" -Exclude "node_modules", "dist", ".git" | ForEach-Object {
        Copy-Item $_.FullName -Destination "$packageDir\server\$($_.Name)" -Recurse -Force
    }
    
    # dist 폴더는 별도로 복사 (존재하는 경우)
    if (Test-Path "apps\server\dist") {
        Copy-Item "apps\server\dist" -Destination "$packageDir\server\dist" -Recurse -Force
    }
    
    # server.exe 복사 (pkg로 빌드된 경우)
    if (Test-Path "apps\server\server.exe") {
        Copy-Item "apps\server\server.exe" -Destination "$packageDir\server\server.exe" -Force
        Write-Host "  OK server.exe copied" -ForegroundColor Green
        
        # Prisma 엔진 파일 복사 (pkg 환경에서 필요)
        # 여러 위치에서 찾기 시도
        $prismaEnginePaths = @(
            "apps\server\node_modules\.prisma\client\query_engine-windows.dll.node",
            "node_modules\.pnpm\@prisma+client@*\node_modules\.prisma\client\query_engine-windows.dll.node",
            "node_modules\.prisma\client\query_engine-windows.dll.node"
        )
        
        $engineFound = $false
        foreach ($pattern in $prismaEnginePaths) {
            $found = Get-ChildItem -Path $pattern -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                Copy-Item $found.FullName -Destination "$packageDir\server\query_engine-windows.dll.node" -Force
                Write-Host "  OK Prisma engine file copied from: $($found.FullName)" -ForegroundColor Green
                $engineFound = $true
                break
            }
        }
        
        if (-not $engineFound) {
            Write-Host "  WARNING Prisma engine file not found. Trying to generate..." -ForegroundColor Yellow
            Set-Location "apps\server"
            pnpm prisma:generate 2>&1 | Out-Null
            Set-Location $projectRoot
            
            # 다시 찾기 시도
            $found = Get-ChildItem -Path "apps\server\node_modules" -Filter "query_engine-windows.dll.node" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                Copy-Item $found.FullName -Destination "$packageDir\server\query_engine-windows.dll.node" -Force
                Write-Host "  OK Prisma engine file copied after generation" -ForegroundColor Green
            } else {
                Write-Host "  ERROR Prisma engine file still not found" -ForegroundColor Red
                Write-Host "  NOTE: Server may fail to start. Make sure Prisma Client is generated." -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  WARNING server.exe not found - using node instead" -ForegroundColor Yellow
        Write-Host "  NOTE: Node.js will be required to run the server" -ForegroundColor Yellow
        
        # node_modules 복사 (server.exe가 없는 경우)
        Write-Host "  Copying node_modules for node execution..." -ForegroundColor Yellow
        if (Test-Path "apps\server\node_modules") {
            # 필요한 모듈만 복사 (선택적)
            Copy-Item "apps\server\node_modules" -Destination "$packageDir\server\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  OK node_modules copied" -ForegroundColor Green
        }
    }
    
    # SQLite 스키마로 교체
    if (Test-Path $sqliteSchema) {
        Copy-Item $sqliteSchema -Destination "$packageDir\server\prisma\schema.prisma" -Force
        Write-Host "  OK SQLite schema replaced" -ForegroundColor Green
    }
    Write-Host "  OK Server files copied" -ForegroundColor Green
} else {
    Write-Host "  ERROR apps\server folder not found" -ForegroundColor Red
}

# 5. 환경 변수 파일 생성
Write-Host "[5/7] 환경 변수 파일 생성 중..." -ForegroundColor Yellow
$envContent = @"
NODE_ENV=production
PORT=3000
DATABASE_URL=file:../data/game.db
REDIS_URL=
JWT_SECRET=mud-game-secret-key-change-in-production
"@
Set-Content -Path "$packageDir\server\.env" -Value $envContent -Encoding UTF8
Write-Host "  환경 변수 파일 생성 완료" -ForegroundColor Green

# 6. 클라이언트 파일 복사
Write-Host "[6/7] 클라이언트 파일 복사 중..." -ForegroundColor Yellow
if (Test-Path "dist\mud_client") {
    Copy-Item "dist\mud_client\*" -Destination "$packageDir\client" -Recurse -Force
    Write-Host "  클라이언트 복사 완료" -ForegroundColor Green
} else {
    Write-Host "  경고: 클라이언트 빌드를 찾을 수 없습니다: dist\mud_client" -ForegroundColor Yellow
    Write-Host "  클라이언트를 먼저 빌드하세요: cd mud_client && flutter build windows --release" -ForegroundColor Yellow
}

# 7. 데이터베이스 파일 복사
Write-Host "[7/8] 데이터베이스 파일 복사 중..." -ForegroundColor Yellow
if (Test-Path $dbSourcePath) {
    Copy-Item $dbSourcePath -Destination "$packageDir\data\game.db" -Force
    $dbSize = (Get-Item "$packageDir\data\game.db").Length
    $dbSizeKB = [math]::Round($dbSize/1024, 2)
    Write-Host "  OK Database file copied ($dbSizeKB KB)" -ForegroundColor Green
} else {
    Write-Host "  WARNING Database file not found: $dbSourcePath" -ForegroundColor Yellow
    Write-Host "  WARNING Run prepare-database.ps1 first to create database" -ForegroundColor Yellow
    Write-Host "  WARNING Or empty database will be created automatically on server start" -ForegroundColor Yellow
}

# 8. 시작 스크립트 및 문서 복사
Write-Host "[8/8] 시작 스크립트 및 문서 복사 중..." -ForegroundColor Yellow
$scriptDir = "standalone-no-docker"
if (Test-Path "$scriptDir\start-game.bat") {
    Copy-Item "$scriptDir\start-game.bat" -Destination "$packageDir\start-game.bat" -Force
    Write-Host "  시작 스크립트 복사 완료" -ForegroundColor Green
} else {
    Write-Host "  경고: start-game.bat를 찾을 수 없습니다" -ForegroundColor Yellow
}

if (Test-Path "$scriptDir\README.md") {
    Copy-Item "$scriptDir\README.md" -Destination "$packageDir\README.md" -Force
    Write-Host "  README 복사 완료" -ForegroundColor Green
} else {
    Write-Host "  경고: README.md를 찾을 수 없습니다" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ 패키지 설정 완료!" -ForegroundColor Green
Write-Host "위치: $((Resolve-Path $packageDir).Path)" -ForegroundColor Cyan
Write-Host ""
if (Test-Path "$packageDir\data\game.db") {
    Write-Host "OK Database file included. Ready to run!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next step:" -ForegroundColor Yellow
    Write-Host "  Run $packageDir\start-game.bat" -ForegroundColor White
} else {
    Write-Host "WARNING Database file not found." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Run standalone-no-docker\prepare-database.ps1" -ForegroundColor White
    Write-Host "  2. Run this script again to include database file" -ForegroundColor White
    Write-Host "  Or empty database will be created automatically on server start" -ForegroundColor White
}
Write-Host ""
