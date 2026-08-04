@echo off
cd /d "%~dp0"
echo === prisma migrate deploy ===
call npx prisma migrate deploy
if errorlevel 1 goto :err
echo === prisma generate ===
call npx prisma generate
if errorlevel 1 goto :err
echo.
echo OK. Ara reinicia el servidor (atura npm run dev i torna a engegar-lo).
echo Despres: torna a pujar Detall/Pack per omplir menjar/beguda.
pause
exit /b 0
:err
echo.
echo Ha fallat. Revisa el missatge d'error.
pause
exit /b 1
