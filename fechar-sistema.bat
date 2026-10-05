@echo off
echo Fechando o sistema Notas e Boletos...
taskkill /F /IM node.exe >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*wwebjs_auth*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
echo Pronto. Agora abra o sistema novamente.
pause
