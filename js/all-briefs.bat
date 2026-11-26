@echo off
chcp 65001 >nul

node %~dp0all-briefs.js %*

REM pause
