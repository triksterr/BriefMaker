@echo off

REM Clear ALL brief-files in project.
REM Start this file from project root.

REM Очистка проекта от брифов. 
REM Удаляет все .brief.md файлы во всем проекте.
REM Запускать из корня проекта.

REM Get-ChildItem -Path . -Filter "*.brief.md" -Recurse | Remove-Item -Force
del /s /q *.brief.md

REM pause