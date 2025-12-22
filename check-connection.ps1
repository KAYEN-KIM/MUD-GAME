# 서버 연결 테스트 스크립트
$ErrorActionPreference = "Continue"

Write-Host "=== MUD Game 서버 연결 테스트 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 로컬 서버 확인
Write-Host "[1] 로컬 서버 확인 (localhost:3000)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  [OK] 로컬 서버 정상 (Status: $($response.StatusCode))" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | Format-List
} catch {
    Write-Host "  [ERROR] 로컬 서버 연결 실패: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 2. PC IP 서버 확인
$pcIp = "192.168.219.112"
Write-Host "[2] PC IP 서버 확인 ($pcIp:3000)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://$pcIp:3000/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    Write-Host "  [OK] PC IP 서버 정상 (Status: $($response.StatusCode))" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | Format-List
} catch {
    Write-Host "  [ERROR] PC IP 서버 연결 실패: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  [INFO] 방화벽 규칙이 필요할 수 있습니다." -ForegroundColor Yellow
    Write-Host "  [INFO] 관리자 권한으로 실행: netsh advfirewall firewall add rule name=`"MUD Game Server Port 3000`" dir=in action=allow protocol=TCP localport=3000" -ForegroundColor Yellow
}
Write-Host ""

# 3. 포트 리스닝 확인
Write-Host "[3] 포트 3000 리스닝 확인..." -ForegroundColor Yellow
$listening = netstat -ano | Select-String ":3000.*LISTENING"
if ($listening) {
    Write-Host "  [OK] 포트 3000 리스닝 중" -ForegroundColor Green
    $listening | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
} else {
    Write-Host "  [ERROR] 포트 3000이 리스닝되지 않음" -ForegroundColor Red
}
Write-Host ""

# 4. Android 기기 확인
Write-Host "[4] Android 기기 확인..." -ForegroundColor Yellow
$devices = flutter devices --machine 2>&1 | ConvertFrom-Json
$androidDevice = $devices | Where-Object { $_.id -eq "R3CT80GM39T" }
if ($androidDevice) {
    Write-Host "  [OK] Android 기기 연결됨: $($androidDevice.name)" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Android 기기(R3CT80GM39T)를 찾을 수 없음" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== 테스트 완료 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "로그 확인 방법:" -ForegroundColor Yellow
Write-Host "  adb -s R3CT80GM39T logcat | Select-String -Pattern 'ApiClient|SessionState|AuthScreen|NetworkDetector'" -ForegroundColor White

