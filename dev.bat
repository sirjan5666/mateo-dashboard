@echo off
setlocal
cd /d "%~dp0"

echo Mateo Dashboard - dev launcher
echo.

rem MongoDB is installed as a Windows service named "MongoDB"
sc query MongoDB | find "RUNNING" >nul
if errorlevel 1 (
    echo [!] MongoDB service is not running. Start it first:
    echo     net start MongoDB   ^(needs an administrator prompt^)
    pause
    exit /b 1
)

if not exist "server\.env" (
    echo [!] server\.env is missing. Copy server\.env.example to server\.env and fill it in.
    pause
    exit /b 1
)

if not exist "server\node_modules" (
    echo Installing server dependencies...
    pushd server
    call npm install
    popd
)

if not exist "client\node_modules" (
    echo Installing client dependencies...
    pushd client
    call npm install
    popd
)

start "Mateo API - localhost:4000" cmd /k "cd server && npm run dev"
start "Mateo Client - localhost:5173" cmd /k "cd client && npm run dev"

rem give Vite a moment to bind before opening the browser
timeout /t 3 /nobreak >nul
start "" http://localhost:5173

echo.
echo Both dev servers are running in their own windows. Close those windows to stop.
endlocal
