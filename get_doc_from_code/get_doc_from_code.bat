@echo off
chcp 65001 >nul

node %~dp0get_doc_from_code.js %1

pause