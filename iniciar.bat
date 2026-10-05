@echo off
title Notas e Boletos - NAO FECHE ESTA JANELA
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando pela primeira vez, aguarde alguns minutos...
  call npm install
)
node src/server.js
echo.
echo O sistema foi encerrado. Se apareceu algum erro acima, tire um print desta tela.
pause
