@echo off
title Liberar acesso pela rede - Notas e Boletos
rem Precisa de permissao de administrador para mexer no firewall: pede ao Windows se ainda nao tiver.
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
echo.
echo  Liberando o acesso ao sistema pelos outros computadores da rede...
netsh advfirewall firewall delete rule name="Notas e Boletos" >nul 2>&1
netsh advfirewall firewall add rule name="Notas e Boletos" dir=in action=allow protocol=TCP localport=3000 profile=any >nul
if errorlevel 1 (
  echo  Nao foi possivel liberar. Tente clicar com o botao direito e "Executar como administrador".
) else (
  echo  Pronto! Os outros computadores ja podem abrir o link do sistema.
)
echo.
pause
