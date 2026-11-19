# BriefMaker 🗺️
**AI-Friendly Code Indexer & AST Summarizer for C++ and JavaScript**

[🇷🇺 Русская версия](#briefmaker-генератор-структурных-брифов-файлов-кода-для-ии-агентов) | [🇬🇧 English](#briefmaker-ai-friendly-code-indexer--ast-summarizer)

---
# 🇬🇧 
## BriefMaker: AI-Friendly Code Indexer & AST Summarizer

### 🤔 The Problem
Modern AI coding assistants (like Cursor, Cline, Aider, or custom LLM agents) are incredibly powerful, but they face a massive bottleneck: **Context Window Limits and Token Costs**.
Feeding a 5,000-line C++ or JavaScript file to an AI just to change one function is expensive, slow, and often leads to hallucinations or imprecise code patches.

### 💡 The Solution
**BriefMaker** is a lightning-fast CLI utility that reads your source code, builds an accurate Abstract Syntax Tree (AST) using [Tree-sitter](https://tree-sitter.github.io/), and generates a lightweight **Table of Contents (`.brief.md`)**.

Instead of reading the whole file, your AI agent reads the brief, understands the architecture, and asks your IDE/Script to inject *only* the specific lines it needs to modify.

The tool is available in **two identical versions**:
- **C++ version** (`BriefMaker.exe`) — a standalone, ultra-fast executable with zero runtime dependencies.
- **Node.js version** (`briefmaker.js`) — a cross-platform JavaScript implementation with identical logic.

### ✨ Key Features
- 🧠 **AI-Optimized Output:** Every class, method, and function includes exact **Start and End line numbers** for precise code patching.
- 🌳 **100% Accurate Parsing:** Powered by Tree-sitter. No fragile Regex. It perfectly understands nested scopes, macros, and strings.
- 💬 **Smart Comment Extraction:** Automatically extracts and cleans Doxygen tags (`@brief`, `@param`, `@return`), block comments, and inline comments.
- 🧹 **Noise Reduction:** Automatically filters out decorative separators (like `// ====`, `// ----`) from comments.
- 🏗️ **Context Aware:** Tracks C++ namespaces/class prefixes (`MyClass::method`) and JS scopes/exports.
- ⚡ **Zero Runtime Dependencies (C++ version):** Statically linked C++ runtime. Just download the `.exe` and run it anywhere.
- 🌐 **Cross-Platform (Node.js version):** Run on Windows, Linux, or macOS using Node.js.
- 📦 **Multi-Language:** Supports modern **C++** (classes, macros, templates, `using`) and **JavaScript/TypeScript** (arrow functions, classes, exports).
- 🚀 **Mass Generation Scripts:** Included PowerShell and Node.js scripts to index entire projects in one command.
- 🛡️ **Safety First:** Built-in protection against running in system directories (e.g., `C:\Windows`).
- 🌍 **Localized Output:** English by default, with a Russian interface and output via the `-ru` flag.

### 🖼️ Example Output

**Input (`user.js`):**
```javascript
/**
 * Represents a system user
 * @param {string} name User's full name
 */
class User {
    // ==========================================
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
Lines: 5 - 11

## Method: User.constructor(name)
Lines: 7

## Method: User.getGreeting()
Returns formatted greeting
Lines: 10
```
*Note how the decorative `// ====` separator is automatically filtered out.*

---

### 🚀 Usage: Single File

**C++ Version (Windows/Linux/macOS binary):**
```bash
BriefMaker.exe path/to/MyClass.cpp           # English output
BriefMaker.exe path/to/MyClass.cpp -ru       # Russian output
BriefMaker.exe path/to/script.js out/        # Save to specific directory
```

**Node.js Version:**
```bash
node js/briefmaker.js path/to/MyClass.cpp
node js/briefmaker.js path/to/script.js -ru
```

---

### 📂 Usage: Mass Project Indexing

BriefMaker includes powerful scripts (`all-briefs.ps1` / `all-briefs.js`) to scan entire projects, respecting `.gitignore`-like rules and avoiding `node_modules` or build folders.

#### 1. Interactive Mode (First Run)
Simply run the script without arguments. It will ask for the project root and offer to save a configuration file.

```powershell
# Windows (PowerShell or CMD via .bat wrapper)
.\all-briefs.ps1
# or
all-briefs.bat

# Cross-platform (Node.js)
node js/all-briefs.js
```

#### 2. Mirror Mode (Shadow Directory)
Use the `-out` flag to generate a clean "mirror" of your project structure containing **only** the brief files. This is ideal for feeding context to AI agents without exposing source code.

```powershell
.\all-briefs.ps1 -out .briefs
# Creates a .briefs/ folder mirroring your src/ structure
```

#### 3. Configuration (`.briefmaker.json`)
On the first interactive run, the script creates a `.briefmaker.json` file in your project root. Subsequent runs will automatically use these settings (no questions asked), making it perfect for CI/CD or AI-agent automation.

```json
{
  "root": ".",
  "extensions": [".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts"],
  "ignore": ["node_modules", "build", "out", "libs", ".git", ".briefs"],
  "lang": "en",
  "outDir": null
}
```

#### 4. Clear ALL brief-files in project

Use `utils/del-briefs.bat` conmmsnd from project root.

Start this file from project root or only from source folder of you project.

---

### 🛠️ Building from Source

**Prerequisites:** 
- CMake 3.15+, C++17 Compiler (MSVC, GCC, or Clang), Git (for C++ version)
- Node.js 18+ (for Node.js version)

#### C++ Version
```bash
git clone --recursive https://github.com/triksterr/BriefMaker.git
cd BriefMaker
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```
*Note: The `CMakeLists.txt` is configured to statically link the runtime (`/MT` on MSVC), ensuring the resulting `.exe` is fully portable.*

#### Node.js Version
```bash
cd js
# Use --legacy-peer-deps to resolve tree-sitter version conflicts
npm install --legacy-peer-deps
```



### 🤖 Automated Releases (GitHub Actions)
This project uses **GitHub Actions** to automatically build and publish binaries for **Windows (x64)**, **macOS (Intel)**, and **macOS (Apple Silicon)** whenever a new version tag (e.g., `v1.0.0`) is pushed. You can download the ready-to-use executables from the [Releases Page](../../releases).

---
# 🇷🇺 
## BriefMaker: Генератор структурных брифов файлов кода для ИИ-агентов

### 🤔 Проблема
Современные ИИ-ассистенты для разработчиков (Cursor, Cline, Aider или кастомные LLM-агенты) невероятно мощны, но они сталкиваются с серьезным ограничением: **лимиты контекстного окна и стоимость токенов**.
Скармливать ИИ файл на 5000 строк C++ или JavaScript только ради того, чтобы изменить одну функцию — дорого, медленно и часто приводит к галлюцинациям или неточным патчам.

### 💡 Решение
**BriefMaker** — это быстрая консольная утилита, которая читает исходный код, строит точное Абстрактное Синтаксическое Дерево (AST) с помощью [Tree-sitter](https://tree-sitter.github.io/) и генерирует легковесное **Оглавление (`.brief.md`)**.

Вместо чтения всего файла, ваш ИИ-агент читает бриф, понимает архитектуру и запрашивает у IDE/скрипта *только* те конкретные строки, которые нужно изменить.

Инструмент доступен в **двух идентичных версиях**:
- **C++ версия** (`BriefMaker.exe`) — автономный, сверхбыстрый исполняемый файл без внешних зависимостей.
- **Node.js версия** (`briefmaker.js`) — кроссплатформенная JavaScript-реализация с идентичной логикой.

### ✨ Ключевые особенности
- 🧠 **Оптимизация для ИИ:** Каждый класс, метод и функция сопровождаются точными **номерами начальной и конечной строки** для хирургически точного патчинга кода.
- 🌳 **100% точность парсинга:** Работает на базе Tree-sitter. Никаких хрупких регулярных выражений. Программа идеально понимает вложенные скоупы, макросы и строковые литералы.
- 💬 **Умное извлечение комментариев:** Автоматически находит и очищает Doxygen-теги (`@brief`, `@param`, `@return`), блочные и инлайн-комментарии.
- 🧹 **Устранение шума:** Автоматически фильтрует декоративные разделители (вроде `// ====`, `// ----`) из комментариев.
- 🏗️ **Понимание контекста:** Отслеживает C++ неймспейсы и префиксы классов (`MyClass::method`), а также JS-скоупы и экспорты.
- ⚡ **Ноль зависимостей при запуске (C++):** Статически слинкованный рантайм C++. Достаточно скачать `.exe` и запустить его где угодно.
- 🌐 **Кроссплатформенность (Node.js):** Работает на Windows, Linux и macOS через Node.js.
- 📦 **Мультиязычность:** Поддерживает современный **C++** и **JavaScript/TypeScript**.
- 🚀 **Скрипты массовой генерации:** Включены PowerShell и Node.js скрипты для индексации целых проектов одной командой.
- 🛡️ **Безопасность:** Встроенная защита от запуска в системных директориях (например, `C:\Windows`).
- 🌍 **Локализация:** Английский язык по умолчанию, русский интерфейс и метки через флаг `-ru`.

---

### 🚀 Использование: Одиночный файл

**C++ Версия (Бинарник для Windows/Linux/macOS):**
```powershell
BriefMaker.exe path/to/MyClass.cpp           # Английский вывод
BriefMaker.exe path/to/MyClass.cpp -ru       # Русский вывод
BriefMaker.exe path/to/script.js out/        # Сохранить в конкретную папку
```

**Node.js Версия:**
```powershell
node js/briefmaker.js path/to/MyClass.cpp
node js/briefmaker.js path/to/script.js -ru
```

---

### 📂 Использование: Массовая индексация проекта

BriefMaker включает мощные скрипты (`all-briefs.ps1` / `all-briefs.js`) для сканирования целых проектов, с уважением правил игнорирования (пропуская `node_modules`, `build` и т.д.).

#### 1. Интерактивный режим (Первый запуск)
Просто запустите скрипт без аргументов. Он спросит путь к корню проекта и предложит сохранить файл конфигурации.

```powershell
# Windows (PowerShell или CMD через .bat wrapper)
.\all-briefs.ps1
# или
all-briefs.bat

# Кроссплатформенно (Node.js)
node js/all-briefs.js
```

#### 2. Режим "Зеркало" (Mirror Mode)
Используйте флаг `-out`, чтобы создать чистое "зеркало" структуры вашего проекта, содержащее **только** файлы брифов. Это идеально для передачи контекста ИИ-агентам без раскрытия исходного кода.

```powershell
.\all-briefs.ps1 -out .briefs
# Создает папку .briefs/, зеркалящую структуру src/
```

#### 3. Конфигурация (`.briefmaker.json`)
При первом интерактивном запуске скрипт создает файл `.briefmaker.json` в корне проекта. Последующие запуски будут автоматически использовать эти настройки (без лишних вопросов), что идеально для CI/CD или автоматизации ИИ-агентами.

```json
{
  "root": ".",
  "extensions": [".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts"],
  "ignore": ["node_modules", "build", "out", "libs", ".git", ".briefs"],
  "lang": "en",
  "outDir": null
}
```

#### 4. Очистка проекта от брифов. 

Команда `utils/del-briefs.bat`  удаляет все .brief.md файлы во всем проекте, если выполнить её из корня проекта.
Вы также можете очистить бриф-файлы только в выбранной папке и её подпапках, запустив эту команду в этой папке.

---

### 🛠️ Сборка из исходников

**Требования:**
- CMake 3.15+, компилятор C++17 (MSVC, GCC или Clang), Git (для C++ версии)
- Node.js 18+ (для Node.js версии)

#### C++ версия
```powershell
git clone --recursive https://github.com/triksterr/BriefMaker.git
cd BriefMaker
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```
*Примечание: `CMakeLists.txt` настроен на статическую линковку рантайма (`/MT`), что делает итоговый `.exe` файл полностью автономным.*

#### Node.js версия
```powershell
cd js
# Используем --legacy-peer-deps для разрешения конфликтов версий tree-sitter
npm install --legacy-peer-deps
```

### 🤖 Автоматические релизы (GitHub Actions)
Этот проект использует **GitHub Actions** для автоматической сборки и публикации бинарников для **Windows (x64)**, **macOS (Intel)** и **macOS (Apple Silicon)** при пуше нового тега версии (например, `v1.0.0`). Вы можете скачать готовые исполняемые файлы на [Странице Релизов](../../releases).

---

## 🤝 Contributing / Вклад
Feel free to open issues or submit pull requests!
*Открывайте Issues или присылайте Pull Request!*

## 📄 License / Лицензия
MIT License. Free for personal and commercial use.
*Свободно для личного и коммерческого использования.*