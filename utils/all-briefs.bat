@echo off

chcp 65001 >nul

REM Передаем все аргументы (%*) в PowerShell-скрипт, лежащий рядом с этим .bat файлом
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0all-briefs.ps1" %*

REM pause