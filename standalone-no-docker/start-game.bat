@echo off
chcp 65001 >nul
echo ========================================
echo   MUD Game Start (Standalone)
echo ========================================
echo.

cd /d "%~dp0"

REM 데이터베이스 디렉토리 확인
if not exist "data" (
    echo [1/4] Creating data directory...
    mkdir "data"
) else (
    echo [1/4] Data directory found
)

REM 데이터베이스 파일 확인
if exist "data\game.db" (
    echo [2/4] Database file found
) else (
    echo [2/4] Database file not found.
    echo        Server will create empty database automatically.
    echo        To include game data, run prepare-database.ps1 first.
)

REM 기존 서버 프로세스 종료 (포트 3000 사용 중인 경우)
echo [3/4] Checking for existing server processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Found existing server process: %%a
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 2 /nobreak >nul
)

REM 서버 시작 (server.exe 직접 실행)
echo [4/4] Starting server...
start /B server\server.exe

REM 서버 준비 대기
echo Waiting for server to start...
timeout /t 5 /nobreak >nul

REM 클라이언트 실행 (선택사항)
if exist "client\mud_client.exe" (
    echo Starting client...
    start client\mud_client.exe
) else (
    echo Client not found. You can access the web client at:
    echo http://localhost:3000/web/index.html
)

echo.
echo ========================================
echo   Game Started!
echo ========================================
echo.
echo Server URL: http://localhost:3000
echo Web Client: http://localhost:3000/web/index.html
echo WebSocket: ws://localhost:3000
echo.
echo To stop the server:
echo   Close this window or kill server.exe process in Task Manager
echo.
pause
