@echo off
title Instalando Notas e Boletos
cd /d "%~dp0"

rem Instala o sistema em C:\notas-boletos (fora do OneDrive) e cria um atalho na Area de Trabalho.
set "DESTINO=C:\notas-boletos"
mkdir "%DESTINO%" >nul 2>&1
if not exist "%DESTINO%" set "DESTINO=%USERPROFILE%\notas-boletos"
mkdir "%DESTINO%" >nul 2>&1

echo.
echo  Copiando o sistema para %DESTINO% ...
robocopy "%~dp0." "%DESTINO%" /E /XD node_modules data .wwebjs_auth .wwebjs_cache /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo  Nao foi possivel copiar os arquivos.
  pause
  exit /b 1
)

echo  Criando atalho "Notas e Boletos" na Area de Trabalho...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Notas e Boletos.lnk'); $s.TargetPath='%DESTINO%\iniciar.bat'; $s.WorkingDirectory='%DESTINO%'; $s.Save()"

echo.
echo  Pronto! O sistema foi instalado em %DESTINO%
echo  Nas proximas vezes, abra pelo atalho "Notas e Boletos" na Area de Trabalho.
echo  Iniciando agora (na primeira vez demora alguns minutos)...
echo.
cd /d "%DESTINO%"
call iniciar.bat
