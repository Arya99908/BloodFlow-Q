@echo off
cd /d "%~dp0"
echo ==========================================================
echo Starting BloodFlow-Q Dev Servers...
echo ==========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1"
pause
