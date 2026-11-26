@echo off
REM Первый запуск BriefMaker

REM Переходим в корень файлов с кодом
cd ../../src
REM или в корень всего проекта
REM cd ../..

REM Запускаем массовое выполнение.
call ../utils/briefmaker/all-briefs.bat
REM или из корня всего проекта
REM call utils/briefmaker/all-briefs.bat

REM Отвечаем на вопросы и сохраняем конфиг!

REM Переходим в корень всего проекта из папки с кодом
REM Если мы уже в корне, то переходить не надо!
cd ..
REM Удаляем разрозненные бриф-файлы 
call utils/briefmaker/del-briefs.bat

REM cd src
REM Запускаем массовое выполнение.
REM call ../utils/briefmaker/all-briefs.bat