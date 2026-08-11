@echo off
cd /d "%~dp0.."
echo Executant auditoria repartiment des de:
cd
echo.
call npx tsx scripts/audit-repartiment-principis.ts %*
echo.
pause
