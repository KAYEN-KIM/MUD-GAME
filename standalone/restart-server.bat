@echo off
chcp 65001 >nul
echo ========================================
echo   MUD 게임 서버 재시작
echo ========================================
echo.

cd /d "%~dp0"
echo 서버 중지 중...
docker-compose down

echo.
echo 서버 시작 중...
docker-compose up -d

echo.
echo 서버가 재시작되었습니다.
echo 로그를 확인하려면: docker-compose logs -f server
pause
