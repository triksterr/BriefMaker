File: briefmaker.js

# Constant: const fs = require('fs');
Line: 3

# Constant: const path = require('path');
Line: 4

# Constant: const Parser = require('tree-sitter');
Line: 5

# Constant: const Cpp = require('tree-sitter-cpp');
Line: 6

# Constant: const JavaScript = require('tree-sitter-javascript');
Line: 7

# Constant: const STRINGS_EN = { fileLabel: 'File: ', classType: 'Class', methodType: 'Method', functionType: 'Function', macroType: 'Macro', constantType: 'Constant', typeAliasType: 'TypeAlias', fieldType: 'Field', lineSingle: 'Line: ', lineRange: 'Lines: ', returns: 'Returns: ', usage: 'Usage: briefmaker <input_file> [output_path] [-ru]', fileNotFound: 'File not found: ', unsupportedExt: 'Unsupported extension: ', briefCreated: 'Brief successfully created: ', error: 'Error: ', langEnabled: '' };
==========================================
Lines: 12 - 30

# Constant: const STRINGS_RU = { fileLabel: 'Файл: ', classType: 'Класс', methodType: 'Метод', functionType: 'Функция', macroType: 'Макрос', constantType: 'Константа', typeAliasType: 'Псевдоним типа', fieldType: 'Поле', lineSingle: 'Стр: ', lineRange: 'Стр: ', returns: 'Возвращает: ', usage: 'Использование: briefmaker <входной_файл> [путь_вывода] [-ru]', fileNotFound: 'Файл не найден: ', unsupportedExt: 'Неподдерживаемое расширение: ', briefCreated: 'Бриф успешно создан: ', error: 'Ошибка: ', langEnabled: 'Включён русский язык интерфейса.' };
Lines: 32 - 50

# Function: function readFileToUtf8String(filePath)
==========================================
Lines: 55 - 62

# Function: function trimString(s)
Lines: 64 - 66

# Function: function removeInlineCommentsFromSignature(rawSig)
Lines: 68 - 93

# Function: function cleanDoxygenLine(line, S)
Lines: 95 - 107

# Function: function isFunctionDeclaration(node)
Lines: 109 - 120

# Class: BriefGenerator
==========================================
Lines: 125 - 499

## Method: BriefGenerator.constructor(S)
Lines: 126 - 131

## Method: BriefGenerator.collectComments(node)
Lines: 133 - 146

## Method: BriefGenerator.processNode(node, currentPrefix)
Lines: 148 - 376

## Method: BriefGenerator.attachComments()
Lines: 378 - 498

# Function: function generateMarkdown(filePath, entities, S)
Lines: 501 - 522

# Function: function main()
==========================================
Lines: 527 - 604

