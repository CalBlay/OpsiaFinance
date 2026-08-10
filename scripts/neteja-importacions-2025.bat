@echo off
cd /d C:\dev\OpsiaFinance
echo === Dry-run neteja 2025 ===
call npx tsx scripts/neteja-importacions-2025.ts --dry-run
if errorlevel 1 goto :err
echo.
echo === Aplicar neteja 2025 ===
call npx tsx scripts/neteja-importacions-2025.ts
if errorlevel 1 goto :err
echo.
echo OK.
exit /b 0
:err
echo.
echo ERROR. Revisa el missatge amunt.
exit /b 1
