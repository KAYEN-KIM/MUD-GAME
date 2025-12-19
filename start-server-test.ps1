# TEST_MODE=true로 서버 시작 스크립트
# 사용법: .\start-server-test.ps1

Write-Host "`n=== 서버 시작 (TEST_MODE=true) ===" -ForegroundColor Cyan

# 기존 서버 종료
Write-Host "`n1. 기존 서버 프로세스 종료 중..." -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($port3000) {
    foreach ($pid in $port3000) {
        Write-Host "   프로세스 종료: PID $pid" -ForegroundColor Gray
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    Write-Host "   ✅ 종료 완료`n" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  실행 중인 서버 없음`n" -ForegroundColor Gray
}

# TEST_MODE 설정
$env:TEST_MODE = "true"
Write-Host "2. TEST_MODE=$env:TEST_MODE 설정 완료`n" -ForegroundColor Green

# 서버 시작
Write-Host "3. 서버 시작 중...`n" -ForegroundColor Yellow
Write-Host "   명령: pnpm --filter server dev`n" -ForegroundColor Gray

# 현재 디렉토리로 이동
Set-Location "C:\Users\Kyung\Mud Game"

# 서버 시작 (현재 창에서)
pnpm --filter server dev

