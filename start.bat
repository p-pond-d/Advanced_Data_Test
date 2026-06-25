@echo off
echo =========================================================
echo  Loymalila Analytics Dashboard Unified Startup Script
echo =========================================================
echo.

echo [1/3] Installing root runner tools...
call npm install --no-audit --no-fund

echo.
echo [2/3] Installing backend and frontend packages...
call npm run install:all --no-audit --no-fund

echo.
echo [3/3] Starting backend and frontend concurrently...
echo Connect to http://localhost:3000 to view your dashboard!
echo.
call npm start
