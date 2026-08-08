@echo off
cd /d C:\dev\OpsiaFinance
echo === Prisma migrate deploy ===
call npx prisma migrate deploy
if errorlevel 1 goto :err
echo.
echo === Prisma generate ===
call npx prisma generate
if errorlevel 1 goto :err
echo.
echo OK. Reinicia el servidor Next (npm run dev) i torna a obrir /settings/consolidacio
pause
exit /b 0
:err
echo.
echo ERROR. Revisa el missatge amunt.
pause
exit /b 1
