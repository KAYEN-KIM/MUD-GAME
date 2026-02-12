@echo off
chcp 65001 >nul
echo ========================================
echo   MUD 게임 서버 중지
echo ========================================
echo.

cd /d "%~dp0"
docker-compose down

echo.
echo 서버가 중지되었습니다.
pause
