File: test_js-editor.js

# Constant: const DEFAULT_SETTINGS = { theme: 'light', fontSize: 'medium', uiFont: 'Segoe UI', fieldFont: 'Consolas', lang: 'ru', showDeprecated: false, externalEditor: 'notepad', recentProjects: [], editorPaths: { notepad: 'C:/Windows/notepad.exe', npp: 'C:/Program Files/Notepad++/notepad++.exe', vscode: 'code' } };
Зашитые настройки редактора по умолчанию (фолбэк, если файл настроек
не найден или битый — см. loadSettings). Также источник структуры
для редактора путей внешних редакторов (editorPaths).
Lines: 28 - 42

## Field: editorApp.loaded = false
СОСТОЯНИЕ приложения (реактивное, читается/пишется всеми методами).
Ключевые поля:
- loaded/initializing/schemaLoading — флаги жизненного цикла
- mode ('global'|'project'), lang, theme, activeSection
- global/project — два ConfigSlot (параллельные конфиги)
- translations, models, timezones, schema — справочные данные
- showComments, fieldErrors, fieldWarnings — по-полю состояние
- _translationsVersion/_validationVersion — счётчики-триггеры: их
инкремент принудительно перерисовывает sidebar/content (x-effect)
Line: 76

## Field: editorApp.models = []
Line: 81

## Field: editorApp.timezones = []
Line: 82

## Field: editorApp.schema = null
Line: 83

## Field: editorApp.showModelDropdown = false
Line: 116

## Field: editorApp.showRecentMenu = false
Line: 117

## Field: editorApp.showSettingsModal = false
Line: 118

## Field: editorApp.notification = null
Line: 119

## Field: editorApp.errorModal = null
Line: 120

## Field: editorApp.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
Line: 121

## Field: editorApp.recentProjects = []
Line: 122

## Field: editorApp.initializing = false
Флаги-стражи для предотвращения повторной инициализации
Line: 128

## Field: editorApp.schemaLoading = false
Line: 129

## Field: editorApp._translationsVersion = 0
Триггер перерендера при смене переводов
Line: 131

## Field: editorApp._validationVersion = 0
Триггер перерендера при смене переводов
Line: 132

## Method (getter): editorApp.currentConfig()
Активный ConfigSlot в зависимости от режима.
Lines: 140 - 142

## Method (getter): editorApp.currentFilePath()
Путь к файлу активного конфига ('' если не загружен). @type {string}
Lines: 145 - 147

## Method (getter): editorApp.filteredModels()
Модели из models.txt, отфильтрованные по modelSearch и сгруппированные
по провайдеру для dropdown. @type {Array<{name:string, models:Array}>}
Lines: 153 - 167

## Method (getter): editorApp.filteredTimezones()
Часовые пояса, отфильтрованные по modelSearch. @type {string[]}
Lines: 170 - 175

## Method: editorApp.getProjectFolder()
Имя папки проекта (из project.path) для бейджа в тулбаре. @returns {string}
Lines: 178 - 181

## Method: editorApp.init()
Точка входа: последовательная загрузка всего и первый рендер.
Алгоритм: ждёт готовности jsonc-парсера → настройки → переводы →
модели → таймзоны → домашний путь → применяет настройки → схема →
автозагрузка глобального конфига и последнего проекта → loaded=true.
Защита от повторного запуска — флаги initializing/loaded.
Вызывается из index.html через @x-init="init()".
Ограничение: порядок важен — схема грузится после переводов, чтобы
отладочный вывод был на выбранном языке.
Lines: 197 - 268

## Method: editorApp.detectHomePath()
Запрашивает у сервера домашнюю папку (/api/home) → homePath. @async
Lines: 271 - 281

## Method: editorApp.autoLoadGlobalConfig()
Автозагрузка глобального конфига по стандартному пути
~/.config/opencode/opencode.json. Если файла нет — предупреждение.
Lines: 288 - 300

## Method: editorApp.autoLoadLastProject()
Автозагрузка последнего проекта (первый в recentProjects). @async
Lines: 303 - 314

## Method: editorApp.loadSettings()
Грузит настройки из occe_settings.json поверх DEFAULT_SETTINGS.
При ошибке/отсутствии — откат к дефолтам (зашитый фолбэк).
Lines: 323 - 335

## Method: editorApp.saveSettingsToFile()
Сохраняет настройки + recentProjects в occe_settings.json через /api/write. @async
Lines: 338 - 353

## Method: editorApp.loadTranslations()
Загружает словарь текущего языка (lang-{lang}.json) и инкрементирует
_translationsVersion → принудительный перерендер. @async @see t
Lines: 359 - 366

## Method: editorApp.loadModels()
Парсит CSV из models.txt в this.models (пропускает строку-заголовок). @async
Lines: 369 - 384

## Method: editorApp.loadTimezones()
Загружает список таймзон из timezones.txt (игнорирует пустые строки и #). @async
Lines: 387 - 406

## Method: editorApp.applyAllSettings()
Применяет тему, размер и гарнитуры шрифтов из настроек. @see applyTheme
Lines: 409 - 413

## Method: editorApp.applyTheme(theme)
Устанавливает тему на <html> через атрибут data-theme. @param {'light'|'dark'} theme
Lines: 416 - 419

## Method: editorApp.applyFontSize(size)
Пишет размер шрифта в CSS-переменную --font-size. @param {'small'|'medium'|'large'|'xlarge'} size
Lines: 422 - 425

## Method: editorApp.applyFonts()
Пишет гарнитуры в CSS-переменные --ui-font и --field-font.
Lines: 428 - 431

## Method: editorApp.loadSchema()
Загружает и валидирует schema_occe.json через schema.js. При ошибках —
предупреждения (битые $ref, отсутствующие поля), схема остаётся рабочей
по возможности. Защита от повторной загрузки — флаг schemaLoading.
Lines: 441 - 483

## Method: editorApp.setActiveSection(sectionId)
Устанавливает активную секцию (триггер перерендера контента). @param {string} sectionId
Lines: 488 - 490

## Method: editorApp.t(key)
Возвращает перевод по точечному ключу. Двухфазный поиск:
1) быстрый путь — стандартное вложенное разбиение;
2) медленный путь — рекурсивный поиск с объединением частей ключа,
чтобы поддерживать плоские ключи вида "sections.basic.description".
Fallback: возвращает сам ключ, если перевод не найден.
Returns: s {string} Переведённая строка или ключ
Lines: 503 - 555

## Method: editorApp.switchTab(tab)
Переключает режим global/project. @param {'global'|'project'} tab
Lines: 560 - 562

## Method: editorApp.toggleTheme()
Инвертирует тему, применяет и сохраняет в файл настроек.
Lines: 565 - 570

## Method: editorApp.changeLanguage(lang)
Меняет язык, перезагружает переводы и сохраняет настройку. @async @param {'ru'|'en'|'es'} lang
Lines: 573 - 578

## Method: editorApp.toggleComment(field)
Обёртка: переключает видимость/текст комментария поля. @see toggleComment (editor-logic.js)
Lines: 588 - 592

## Method: editorApp.getCurrentValue(field)
Обёртка: значение поля из активного конфига. @see getCurrentValue (editor-logic.js)
Lines: 595 - 597

## Method: editorApp.getStatusClass(field)
Обёртка: статус источника значения (⚪/🔵 - зелёный/жёлтый/серый/синий) с учётом второго файла конфига (глобального/локального).
Lines: 603 - 606

## Method: editorApp.getStatusText(field)
Текст статуса (через getStatusClass + перевод). @see getStatusText
Lines: 609 - 612

## Method: editorApp.getStatusTooltip(field)
Tooltip статуса с подстановкой значений обоих конфигов. @see getStatusTooltip
Lines: 615 - 619

## Method: editorApp.getFieldError(field)
Ошибка валидации поля в текущем режиме. @see getFieldError
Lines: 622 - 624

## Method: editorApp.getFieldWarning(field)
Предупреждение поля в текущем режиме. @see getFieldWarning
Lines: 627 - 629

## Method: editorApp.validateField(field, value)
Обёртка: валидирует значение поля, кладёт результат в fieldErrors/
fieldWarnings под ключом "{mode}.{field}" и инкрементирует
_validationVersion для перерендера. @see validateField (editor-logic.js)
Lines: 637 - 649

## Method: editorApp.selectModel(model)
Обёртка: выбирает модель в конфиг, сбрасывает поиск и валидирует. @see selectModel
Lines: 652 - 657

## Method: editorApp.hideModelDropdown()
Скрывает dropdown моделей с задержкой (чтобы успел сработать клик).
Lines: 660 - 662

## Method: editorApp.addArrayItem(field, defaultValue)
Обёртка: добавляет элемент в массив поля. @see addArrayItem (editor-logic.js)
Lines: 665 - 667

## Method: editorApp.removeArrayItem(field, idx)
Обёртка: удаляет элемент массива по индексу. @see removeArrayItem
Lines: 670 - 672

## Method: editorApp.getByPath(path)
Читает значение по пути (для вложенных полей).
Обёртка над utils.js:getByPath для использования в Alpine-биндингах.
Returns: s {*} значение по пути или undefined
Lines: 683 - 686

## Method: editorApp.setByPath(path, value)
Записывает значение по пути (иммутабельно).
Обёртка над utils.js:setByPath с обновлением стейта.
Lines: 695 - 698

## Method: editorApp.validateFieldByPath(path, value)
Валидирует поле по пути (для вложенных полей).
Использует последние сегменты пути как ключ для validateField.
Lines: 707 - 712

## Method: editorApp.toggleCommentByPath(path)
Переключает комментарий для поля по пути.
Lines: 719 - 724

## Method: editorApp.loadFile()
Запрашивает путь (prompt с подсказкой) и грузит файл. @async @see loadFileByPath
Lines: 729 - 739

## Method: editorApp.loadFileByPath(path, mode)
Основная загрузка конфига: читает файл через /api/read, парсит JSONC,
извлекает комментарии, заполняет целевой ConfigSlot и раскрывает
непустые комментарии. При ошибке парсинга — модальное окно с текстом
файла (сценарий A из ТЗ). Для проекта добавляет папку в недавние.
Lines: 751 - 805

## Method: editorApp.selectProjectFolder()
Выбирает папку проекта. Если конфига нет — создаёт дефолтный
(создание файла, см. ТЗ п.17). @async @see createDefaultConfig
Lines: 811 - 842

## Method: editorApp.addToRecentProjects(path)
Добавляет папку файла в recentProjects (макс. 10, без дублей) и сохраняет.
Lines: 845 - 855

## Method: editorApp.loadRecentProject(folder)
Загружает opencode.json из папки недавнего проекта. @async @see loadFileByPath
Lines: 858 - 862

## Method: editorApp.save()
Сохраняет активный конфиг в JSONC с комментариями.
Алгоритм: чистка пустых значений → валидация всех полей (при ошибках —
блок и список) → computeEdits (минимальная правка исходного текста) →
применение изменённых комментариев → запись через /api/write (backup=true)
→ обновление снимков. @async @see computeEdits @see applyCommentChanges
Lines: 873 - 926

## Method: editorApp.saveWithoutComments()
Сохраняет чистый JSON без комментариев. Сначала создаёт бэкап JSONC-версию
с комментариями (opencode_comments.json.bak), затем пишет чистый JSON.
Lines: 933 - 1006

## Method: editorApp.reset()
Откатывает активный конфиг к снимкам (с подтверждением).
Lines: 1009 - 1016

## Method: editorApp.saveSettings()
Применяет настройки из модалки, сохраняет файл, закрывает окно. @async
Lines: 1019 - 1024

## Method: editorApp.showErrorModal(title, message, content, filePath)
Открывает модалку критичной ошибки (сценарий A из ТЗ).
Lines: 1027 - 1029

## Method: editorApp.openInEditor()
Открывает файл из errorModal во внешнем редакторе через /api/open-editor. @async
Lines: 1032 - 1054

## Method: editorApp.showNotification(message, type)
Показывает уведомление и гасит его по таймеру (ошибки дольше). @param {string} message @param {'success'|'error'|'warning'} [type]
Lines: 1057 - 1062

## Method: editorApp.initSidebar()
Перерисовывает левую панель (список секций). Триггерится через x-effect
в index.html. Использует renderSidebar из renderer.js; при изменении
HTML пересоздаёт Alpine-дерево (destroyTree/initTree).
Lines: 1072 - 1088

## Method: editorApp.initContent()
Перерисовывает область контента (поля активной секции). Строит
renderStateFn для каждого поля (статус, ошибки, комментарий) и вызывает
renderContent из renderer.js; при изменении HTML пересоздаёт дерево.
Триггерится через x-effect в index.html. @see renderContent
Lines: 1096 - 1187

