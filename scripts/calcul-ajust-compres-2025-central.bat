@echo off
cd /d C:\dev\OpsiaFinance
call npx tsx scripts/calcul-ajust-compres-2025-central.ts
exit /b %ERRORLEVEL%
