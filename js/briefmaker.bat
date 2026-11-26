@echo off
chcp 65001 >nul

node %~dp0briefmaker.js -ru %*

REM pause

REM node "%~dp0..\briefmaker.js" %*