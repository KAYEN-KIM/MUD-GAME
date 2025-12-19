# Smoke 테스트 실행 스크립트
# 사용법: .\run-smoke-test.ps1

Write-Host "`n=== Smoke 테스트 실행 ===" -ForegroundColor Cyan

# TEST_MODE 설정
$env:TEST_MODE = "true"
Write-Host "TEST_MODE=$env:TEST_MODE 설정 완료`n" -ForegroundColor Green

# Health 확인
Write-Host "1. 서버 Health 확인 중...`n" -ForegroundColor Yellow
$health = node -e "fetch('http://localhost:3000/health').then(r=>r.json()).then(j=>console.log(JSON.stringify(j))).catch(e=>console.log('{}'))" 2>&1 | Out-String

if ($health -match '"testMode":true') {
    Write-Host "   ✅ 서버가 TEST_MODE=true로 실행 중입니다!`n" -ForegroundColor Green
} elseif ($health -match '"status":"ok"') {
    Write-Host "   ⚠️  서버는 실행 중이지만 testMode=false입니다.`n" -ForegroundColor Red
    Write-Host "   서버를 TEST_MODE=true로 재시작하세요:`n" -ForegroundColor Yellow
    Write-Host "   .\start-server-test.ps1`n" -ForegroundColor White
    exit 1
} else {
    Write-Host "   ❌ 서버가 실행되지 않았습니다.`n" -ForegroundColor Red
    Write-Host "   서버를 먼저 시작하세요:`n" -ForegroundColor Yellow
    Write-Host "   .\start-server-test.ps1`n" -ForegroundColor White
    exit 1
}

# 현재 디렉토리로 이동
Set-Location "C:\Users\Kyung\Mud Game"

# Smoke 테스트 실행
Write-Host "2. Smoke 테스트 실행 중...`n" -ForegroundColor Yellow
pnpm smoke

