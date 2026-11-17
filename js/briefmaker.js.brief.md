Файл: briefmaker.js

# Константа: const fs = require('fs');
Стр: 3

# Константа: const path = require('path');
Стр: 4

# Константа: const Parser = require('tree-sitter');
Стр: 5

# Константа: const Cpp = require('tree-sitter-cpp');
Стр: 6

# Константа: const JavaScript = require('tree-sitter-javascript');
Стр: 7

# Константа: const STRINGS_EN = { fileLabel: 'File: ', classType: 'Class', methodType: 'Method', functionType: 'Function', macroType: 'Macro', constantType: 'Constant', typeAliasType: 'TypeAlias', fieldType: 'Field', lineSingle: 'Line: ', lineRange: 'Lines: ', returns: 'Returns: ', usage: 'Usage: briefmaker <input_file> [output_path] [-ru]', fileNotFound: 'File not found: ', unsupportedExt: 'Unsupported extension: ', briefCreated: 'Brief successfully created: ', error: 'Error: ', langEnabled: '' };
Стр: 12 - 30

# Константа: const STRINGS_RU = { fileLabel: 'Файл: ', classType: 'Класс', methodType: 'Метод', functionType: 'Функция', macroType: 'Макрос', constantType: 'Константа', typeAliasType: 'Псевдоним типа', fieldType: 'Поле', lineSingle: 'Стр: ', lineRange: 'Стр: ', returns: 'Возвращает: ', usage: 'Использование: briefmaker <входной_файл> [путь_вывода] [-ru]', fileNotFound: 'Файл не найден: ', unsupportedExt: 'Неподдерживаемое расширение: ', briefCreated: 'Бриф успешно создан: ', error: 'Ошибка: ', langEnabled: 'Включён русский язык интерфейса.' };
Стр: 32 - 50

# Функция: function readFileToUtf8String(filePath)
Стр: 55 - 62

# Функция: function trimString(s)
Стр: 64 - 66

# Функция: function removeInlineCommentsFromSignature(rawSig)
Стр: 68 - 93

# Функция: function cleanDoxygenLine(line, S)
Стр: 95 - 109

# Функция: function isFunctionDeclaration(node)
Стр: 111 - 122

# Класс: BriefGenerator
Стр: 127 - 509

## Метод: BriefGenerator.constructor(S)
Стр: 128 - 133

## Метод: BriefGenerator.collectComments(node)
Стр: 135 - 148

## Метод: BriefGenerator.processNode(node, currentPrefix)
Стр: 150 - 378

## Метод: BriefGenerator.attachComments()
Стр: 380 - 508

# Функция: function generateMarkdown(filePath, entities, S)
Стр: 511 - 532

# Функция: function main()
Стр: 537 - 614

