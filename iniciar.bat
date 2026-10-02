@echo off
title Notas e Boletos
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando pela primeira vez, aguarde...
  call npm install
)
start "" http://localhost:3000
node src/server.js
pause
