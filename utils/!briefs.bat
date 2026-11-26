@echo off
REM Массовое создание брифов из папки с кодом. 

REM Переходим в корень файлов с кодом
cd ../../src
REM Запускаем массовое выполнение.
call ../utils/briefmaker/all-briefs.bat