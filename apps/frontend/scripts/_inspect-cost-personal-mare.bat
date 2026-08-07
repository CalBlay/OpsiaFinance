@echo off
REM Executa aquest .bat des d'un CMD fora de Cursor (Cylance bloqueja la shell de l'agent).
cd /d C:\dev\OpsiaFinance\apps\frontend
node scripts\_inspect-cost-personal-mare.js
pause
