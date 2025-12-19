# 서버 시작 스크립트
# 사용법: .\START_SERVER.ps1

cd "C:\Users\Kyung\Mud Game\apps\server"

# TEST_MODE 환경 변수 설정
$env:TEST_MODE = "true"

Write-Host "🚀 서버 시작 중... (TEST_MODE=true)" -ForegroundColor Green
Write-Host "서버가 시작되면 http://localhost:3000/health 에서 확인 가능합니다." -ForegroundColor Yellow
Write-Host ""

# 서버 시작
pnpm dev

