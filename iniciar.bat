@echo off
title Notas e Boletos - NAO FECHE ESTA JANELA
cd /d "%~dp0"

echo %~dp0 | find /i "OneDrive" >nul
if not errorlevel 1 (
  echo.
  echo  AVISO: esta pasta esta dentro do OneDrive. O OneDrive pode corromper os
  echo  arquivos do sistema. Recomendado: mova a pasta inteira para C:\notas-boletos
  echo.
)

rem Confere se a instalacao esta completa; se faltar algo, reinstala sozinho.
node -e "require('express');require('multer');require('qrcode');require('whatsapp-web.js')" >nul 2>&1
if errorlevel 1 (
  echo Instalando/reparando o sistema, aguarde alguns minutos...
  if exist node_modules rmdir /s /q node_modules
  call npm install
  if errorlevel 1 (
    echo.
    echo  Nao foi possivel instalar. Verifique a internet e tente novamente.
    pause
    exit /b 1
  )
)

node src/server.js
echo.
echo O sistema foi encerrado. Se apareceu algum erro acima, tire um print desta tela.
pause
