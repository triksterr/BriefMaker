# BriefMaker 🗺️
**AI-Friendly Code Indexer & AST Summarizer for C++ and JavaScript**

[🇷🇺 Русская версия](#-проблема) | [🇬🇧 English](#-the-problem)

---

<a id="en"></a>
## 🇬🇧 BriefMaker: AI-Friendly Code Indexer & AST Summarizer

### 🤔 The Problem
Modern AI coding assistants (like Cursor, Cline, Aider, or custom LLM agents) are incredibly powerful, but they face a massive bottleneck: **Context Window Limits and Token Costs**. 
Feeding a 5,000-line C++ or JavaScript file to an AI just to change one function is expensive, slow, and often leads to hallucinations or imprecise code patches.

### 💡 The Solution
**BriefMaker** is a lightning-fast CLI utility that reads your source code, builds an accurate Abstract Syntax Tree (AST) using [Tree-sitter](https://tree-sitter.github.io/), and generates a lightweight **Table of Contents (`.brief.md`)**. 

Instead of reading the whole file, your AI agent reads the brief, understands the architecture, and asks your IDE/Script to inject *only* the specific lines it needs to modify.

### ✨ Key Features
* 🧠 **AI-Optimized Output:** Every class, method, and function includes exact **Start and End line numbers** for precise code patching.
* 🌳 **100% Accurate Parsing:** Powered by Tree-sitter. No fragile Regex. It perfectly understands nested scopes, macros, and strings.
* 💬 **Smart Comment Extraction:** Automatically extracts and cleans Doxygen tags (`@brief`, `@param`, `@return`), block comments, and inline comments.
* 🏗️ **Context Aware:** Tracks C++ namespaces/class prefixes (`MyClass::method`) and JS scopes/exports.
* ⚡ **Zero Runtime Dependencies:** Statically linked C++ runtime. Just download the `.exe` and run it anywhere (no `vcruntime140.dll` required).
* 📦 **Multi-Language:** Supports modern **C++** (classes, macros, templates, `using`) and **JavaScript/TypeScript** (arrow functions, classes, exports).
* 🔤 **UTF-8 Safe:** Correctly handles files with or without BOM.

### 🖼️ Example Output

**Input (`user.js`):**
```javascript
/**
 * Represents a system user
 * @param {string} name User's full name
 */
class User {
    constructor(name) { this.name = name; }
    
    // Returns formatted greeting
    getGreeting() { return `Hello, ${this.name}`; }
}
```

**Generated (`user.js.brief.md`):**
```markdown
File: user.js

# Class: User
Represents a system user
name: User's full name
Lines: 5 - 10

## Method: User.constructor(name)
Lines: 6

## Method: User.getGreeting()
Returns formatted greeting
Lines: 9
```

### 🚀 Usage

```bash
# Generate a brief next to the source file
BriefMaker.exe path/to/MyClass.cpp

# Specify an output directory
BriefMaker.exe path/to/script.js out/
```

### 🛠️ Building from Source

**Prerequisites:** CMake 3.15+, C++17 Compiler (MSVC, GCC, or Clang), Git.

```bash
# 1. Clone the repository with submodules
git clone --recursive https://github.com/yourusername/BriefMaker.git
cd BriefMaker

# 2. Configure and Build (Release mode)
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```
*Note for MSVC users: The `CMakeLists.txt` is configured to statically link the runtime (`/MT`), ensuring the resulting `.exe` is fully portable.*

---
---

<h2 id="ru">🇷🇺 BriefMaker: Генератор структурных брифов файлов кода для ИИ-агентов</h2>

### 🤔 Проблема
Современные ИИ-ассистенты для разработчиков (Cursor, Cline, Aider или кастомные LLM-агенты) невероятно мощны, но они сталкиваются с серьезным ограничением: **лимиты контекстного окна и стоимость токенов**.
Скармливать ИИ файл на 5000 строк C++ или JavaScript только ради того, чтобы изменить одну функцию — дорого, медленно и часто приводит к галлюцинациям или неточным патчам.

### 💡 Решение
**BriefMaker** — это быстрая консольная утилита, которая читает исходный код, строит точное Абстрактное Синтаксическое Дерево (AST) с помощью [Tree-sitter](https://tree-sitter.github.io/) и генерирует легковесное **Оглавление (`.brief.md`)**.

Вместо чтения всего файла, ваш ИИ-агент читает бриф, понимает архитектуру и запрашивает у IDE/скрипта *только* те конкретные строки, которые нужно изменить.

### ✨ Ключевые особенности
* 🧠 **Оптимизация для ИИ:** Каждый класс, метод и функция сопровождаются точными **номерами начальной и конечной строки** для хирургически точного патчинга кода.
* 🌳 **100% точность парсинга:** Работает на базе Tree-sitter. Никаких хрупких регулярных выражений. Программа идеально понимает вложенные скоупы, макросы и строковые литералы.
* 💬 **Умное извлечение комментариев:** Автоматически находит и очищает Doxygen-теги (`@brief`, `@param`, `@return`), блочные и инлайн-комментарии.
* 🏗️ **Понимание контекста:** Отслеживает C++ неймспейсы и префиксы классов (`MyClass::method`), а также JS-скоупы и экспорты.
* ⚡ **Ноль зависимостей при запуске:** Статически слинкованный рантайм C++. Достаточно скачать `.exe` и запустить его где угодно (не требует установки `vcruntime140.dll`).
* 📦 **Мультиязычность:** Поддерживает современный **C++** (классы, макросы, `using`/`typedef`) и **JavaScript** (стрелочные функции, классы, `export`).
* 🔤 **Безопасная работа с UTF-8:** Корректно обрабатывает файлы как с BOM, так и без него.

### 🖼️ Пример работы

**Входной файл (`user.js`):**
```javascript
/**
 * Представляет пользователя системы
 * @param {string} name Полное имя пользователя
 */
class User {
    constructor(name) { this.name = name; }
    
    // Возвращает форматированное приветствие
    getGreeting() { return `Hello, ${this.name}`; }
}
```

**Сгенерированный бриф (`user.js.brief.md`):**
```markdown
File: user.js

# Class: User
Представляет пользователя системы
name: Полное имя пользователя
Стр: 5 - 10

## Method: User.constructor(name)
Стр: 6

## Method: User.getGreeting()
Возвращает форматированное приветствие
Стр: 9
```

### 🚀 Использование

```powershell
# Создать бриф рядом с исходным файлом с именем MyClass.brief.md
BriefMaker.exe path/to/MyClass.cpp

# Указать папку out/ для сохранения брифа script.brief.md
BriefMaker.exe path/to/script.js out/
```

### 🛠️ Сборка из исходников

**Требования:** CMake 3.15+, компилятор с поддержкой C++17 (MSVC, GCC или Clang), Git.

```powershell
# 1. Клонируем репозиторий вместе с субмодулями (Tree-sitter)
git clone --recursive https://github.com/yourusername/BriefMaker.git
cd BriefMaker

# 2. Конфигурируем и собираем (в Release-режиме)
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```
*Примечание для пользователей MSVC: `CMakeLists.txt` настроен на статическую линковку рантайма (`/MT`), что делает итоговый `.exe` файл полностью автономным и переносимым.*

---

## 🤝 Contributing / Вклад
Feel free to open issues or submit pull requests if you want to add support for more languages (like Python or Rust) or improve the AST extraction logic!
*Открывайте Issues или присылайте Pull Request, если хотите добавить поддержку новых языков (например, Python или Rust) или улучшить логику извлечения AST!*

## 📄 License / Лицензия
MIT License. Free for personal and commercial use. / *Свободно для личного и коммерческого использования.*