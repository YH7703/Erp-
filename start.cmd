@echo off
chcp 65001 > nul
echo ============================================
echo  SI 계약 관리 ERP 시작
echo ============================================
echo.

set "NODE=C:\Users\Administrator\node\node-v20.18.1-win-x64\node.exe"

REM MariaDB 서비스 시작
echo [DB] MariaDB 서비스 시작 중...
net start MariaDB-ERP > nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [DB] MariaDB 시작 완료
) else (
    echo [DB] MariaDB 이미 실행 중
)
timeout /t 2 /nobreak > nul

REM 백엔드 시작
echo [백엔드] 서버 시작 (포트 3001)...
start "ERP-Backend" cmd /k ""%NODE%" "%~dp0backend\server.js""

timeout /t 2 /nobreak > nul

REM 프론트엔드 시작
echo [프론트엔드] 시작 (포트 5173)...
start "ERP-Frontend" cmd /k ""%NODE%" "%~dp0frontend\node_modules\vite\bin\vite.js" --host --port 5173 --root "%~dp0frontend""

timeout /t 3 /nobreak > nul

echo.
echo ============================================
echo  접속 주소: http://localhost:5173
echo ============================================
echo.
start "" http://localhost:5173
