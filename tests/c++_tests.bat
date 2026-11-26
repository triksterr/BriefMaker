@echo off
chcp 65001 >nul

REM ..\out\build\x64-Debug\BriefMaker.exe


..\out\build\x64-Release\BriefMaker.exe test_comments.cpp -ru
..\out\build\x64-Release\BriefMaker.exe test_js.js -ru
..\out\build\x64-Release\BriefMaker.exe test_js-editor.js -ru

pause