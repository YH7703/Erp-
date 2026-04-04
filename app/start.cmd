@echo off
chcp 65001 > nul
echo ============================================
echo  SI 계약 관리 ERP 시작
echo ============================================
echo.

set "NODE=C:\Program Files\nodejs\node.exe"

REM MySQL 서비스 시작
echo [DB] MySQL 서비스 시작 중...
net start MySQL84 > nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [DB] MySQL 시작 완료
) else (
    echo [DB] MySQL 이미 실행 중
)
timeout /t 2 /nobreak > nul

REM 백엔드 시작
echo [백엔드] 서버 시작 (포트 3001)...
start "ERP-Backend" cmd /k "cd /d "%~dp0backend" && "%NODE%" server.js"

timeout /t 2 /nobreak > nul

REM 프론트엔드 시작
echo [프론트엔드] 시작 (포트 5173)...
start "ERP-Frontend" cmd /k "cd /d "%~dp0frontend" && "%NODE%" node_modules\vite\bin\vite.js --host --port 5173"

timeout /t 3 /nobreak > nul

echo.
echo ============================================
echo  접속 주소: http://localhost:5173
echo ============================================
echo.
start "" http://localhost:5173
