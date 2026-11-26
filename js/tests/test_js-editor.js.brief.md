Файл: test_js-editor.js

# Константа: const DEFAULT_SETTINGS = { theme: 'light', fontSize: 'medium', uiFont: 'Segoe UI', fieldFont: 'Consolas', lang: 'ru', showDeprecated: false, externalEditor: 'notepad', recentProjects: [], editorPaths: { notepad: 'C:/Windows/notepad.exe', npp: 'C:/Program Files/Notepad++/notepad++.exe', vscode: 'code' } };
Зашитые настройки редактора по умолчанию (фолбэк, если файл настроек
не найден или битый — см. loadSettings). Также источник структуры
для редактора путей внешних редакторов (editorPaths).
Стр: 28 - 42

# Функция: function editorApp()
Фабрика корневого компонента приложения. Возвращает объект состояния
и методов, который монтируется на `x-data="editorApp()"` в index.html.
Оркестратор: сам логику не реализует — делегирует чистым функциям
и управляет общим стейтом (конфиги, переводы, валидация,
флаги перерендера). Экземпляр доступен как window.editorInstance.
Зависимости: все модули загружаются тегами <script> в index.html
до этого файла; порядок важен. См. заголовок файла.
Возвращает: s {Object} Реактивное состояние + методы для Alpine
Стр: 61 - 1189

## Поле: editorApp.loaded = false
СОСТОЯНИЕ приложения (реактивное, читается/пишется всеми методами).
Ключевые поля:
- loaded/initializing/schemaLoading — флаги жизненного цикла
- mode ('global'|'project'), lang, theme, activeSection
- global/project — два ConfigSlot (параллельные конфиги)
- translations, models, timezones, schema — справочные данные
- showComments, fieldErrors, fieldWarnings — по-полю состояние
- _translationsVersion/_validationVersion — счётчики-триггеры: их
инкремент принудительно перерисовывает sidebar/content (x-effect)
Стр: 76

## Поле: editorApp.translations = {}
Стр: 80

## Поле: editorApp.models = []
Стр: 81

## Поле: editorApp.timezones = []
Стр: 82

## Поле: editorApp.schema = null
Стр: 83

## Поле: editorApp.global = { raw: {}, originalRaw: {}, originalText: '{}', comments: {}, originalComments: {}, path: '' }
Слот конфигурации (по одному на режим global/project). Хранит данные
файла и снимки для сравнения/сброса и сохранения.
Стр: 97 - 104

## Поле: editorApp..global.raw = {}
Стр: 98

## Поле: editorApp..global.originalRaw = {}
Стр: 99

## Поле: editorApp..global.comments = {}
Стр: 101

## Поле: editorApp..global.originalComments = {}
Стр: 102

## Поле: editorApp.project = { raw: {}, originalRaw: {}, originalText: '{}', comments: {}, originalComments: {}, path: '' }
Стр: 105 - 112

## Поле: editorApp..project.raw = {}
Стр: 106

## Поле: editorApp..project.originalRaw = {}
Стр: 107

## Поле: editorApp..project.comments = {}
Стр: 109

## Поле: editorApp..project.originalComments = {}
Стр: 110

## Поле: editorApp.showComments = {}
Стр: 114

## Поле: editorApp.showModelDropdown = false
Стр: 116

## Поле: editorApp.showRecentMenu = false
Стр: 117

## Поле: editorApp.showSettingsModal = false
Стр: 118

## Поле: editorApp.notification = null
Стр: 119

## Поле: editorApp.errorModal = null
Стр: 120

## Поле: editorApp.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
Стр: 121

## Поле: editorApp.recentProjects = []
Стр: 122

## Поле: editorApp.fieldErrors = {}
Стр: 124

## Поле: editorApp.fieldWarnings = {}
Стр: 125

## Поле: editorApp.initializing = false
Флаги-стражи для предотвращения повторной инициализации
Стр: 128

## Поле: editorApp.schemaLoading = false
Стр: 129

## Поле: editorApp._translationsVersion = 0
Триггер перерендера при смене переводов
Стр: 131

## Поле: editorApp._validationVersion = 0
Триггер перерендера при смене переводов
Стр: 132

## Метод (геттер): editorApp.currentConfig()
Активный ConfigSlot в зависимости от режима.
Стр: 140 - 142

## Метод (геттер): editorApp.currentFilePath()
Путь к файлу активного конфига ('' если не загружен). @type {string}
Стр: 145 - 147

## Метод (геттер): editorApp.filteredModels()
Модели из models.txt, отфильтрованные по modelSearch и сгруппированные
по провайдеру для dropdown. @type {Array<{name:string, models:Array}>}
Стр: 153 - 167

## Метод (геттер): editorApp.filteredTimezones()
Часовые пояса, отфильтрованные по modelSearch. @type {string[]}
Стр: 170 - 175

## Метод: editorApp.getProjectFolder()
Имя папки проекта (из project.path) для бейджа в тулбаре. @returns {string}
Стр: 178 - 181

## Метод: editorApp.init()
Точка входа: последовательная загрузка всего и первый рендер.
Алгоритм: ждёт готовности jsonc-парсера → настройки → переводы →
модели → таймзоны → домашний путь → применяет настройки → схема →
автозагрузка глобального конфига и последнего проекта → loaded=true.
Защита от повторного запуска — флаги initializing/loaded.
Вызывается из index.html через @x-init="init()".
Ограничение: порядок важен — схема грузится после переводов, чтобы
отладочный вывод был на выбранном языке.
Стр: 197 - 268

## Метод: editorApp.detectHomePath()
Запрашивает у сервера домашнюю папку (/api/home) → homePath. @async
Стр: 271 - 281

## Метод: editorApp.autoLoadGlobalConfig()
Автозагрузка глобального конфига по стандартному пути
~/.config/opencode/opencode.json. Если файла нет — предупреждение.
Стр: 288 - 300

## Метод: editorApp.autoLoadLastProject()
Автозагрузка последнего проекта (первый в recentProjects). @async
Стр: 303 - 314

## Метод: editorApp.loadSettings()
Грузит настройки из occe_settings.json поверх DEFAULT_SETTINGS.
При ошибке/отсутствии — откат к дефолтам (зашитый фолбэк).
Стр: 323 - 335

## Метод: editorApp.saveSettingsToFile()
Сохраняет настройки + recentProjects в occe_settings.json через /api/write. @async
Стр: 338 - 353

## Метод: editorApp.loadTranslations()
Загружает словарь текущего языка (lang-{lang}.json) и инкрементирует
_translationsVersion → принудительный перерендер. @async @see t
Стр: 359 - 366

## Метод: editorApp.loadModels()
Парсит CSV из models.txt в this.models (пропускает строку-заголовок). @async
Стр: 369 - 384

## Метод: editorApp.loadTimezones()
Загружает список таймзон из timezones.txt (игнорирует пустые строки и #). @async
Стр: 387 - 406

## Метод: editorApp.applyAllSettings()
Применяет тему, размер и гарнитуры шрифтов из настроек. @see applyTheme
Стр: 409 - 413

## Метод: editorApp.applyTheme(theme)
Устанавливает тему на <html> через атрибут data-theme. @param {'light'|'dark'} theme
Стр: 416 - 419

## Метод: editorApp.applyFontSize(size)
Пишет размер шрифта в CSS-переменную --font-size. @param {'small'|'medium'|'large'|'xlarge'} size
Стр: 422 - 425

## Метод: editorApp.applyFonts()
Пишет гарнитуры в CSS-переменные --ui-font и --field-font.
Стр: 428 - 431

## Метод: editorApp.loadSchema()
Загружает и валидирует schema_occe.json через schema.js. При ошибках —
предупреждения (битые $ref, отсутствующие поля), схема остаётся рабочей
по возможности. Защита от повторной загрузки — флаг schemaLoading.
Стр: 441 - 483

## Метод: editorApp.setActiveSection(sectionId)
Устанавливает активную секцию (триггер перерендера контента). @param {string} sectionId
Стр: 488 - 490

## Метод: editorApp.t(key)
Возвращает перевод по точечному ключу. Двухфазный поиск:
1) быстрый путь — стандартное вложенное разбиение;
2) медленный путь — рекурсивный поиск с объединением частей ключа,
чтобы поддерживать плоские ключи вида "sections.basic.description".
Fallback: возвращает сам ключ, если перевод не найден.
Возвращает: s {string} Переведённая строка или ключ
Стр: 503 - 555

## Метод: editorApp.switchTab(tab)
Переключает режим global/project. @param {'global'|'project'} tab
Стр: 560 - 562

## Метод: editorApp.toggleTheme()
Инвертирует тему, применяет и сохраняет в файл настроек.
Стр: 565 - 570

## Метод: editorApp.changeLanguage(lang)
Меняет язык, перезагружает переводы и сохраняет настройку. @async @param {'ru'|'en'|'es'} lang
Стр: 573 - 578

## Метод: editorApp.toggleComment(field)
Обёртка: переключает видимость/текст комментария поля. @see toggleComment (editor-logic.js)
Стр: 588 - 592

## Метод: editorApp.getCurrentValue(field)
Обёртка: значение поля из активного конфига. @see getCurrentValue (editor-logic.js)
Стр: 595 - 597

## Метод: editorApp.getStatusClass(field)
Обёртка: статус источника значения (⚪/🔵 - зелёный/жёлтый/серый/синий) с учётом второго файла конфига (глобального/локального).
Стр: 603 - 606

## Метод: editorApp.getStatusText(field)
Текст статуса (через getStatusClass + перевод). @see getStatusText
Стр: 609 - 612

## Метод: editorApp.getStatusTooltip(field)
Tooltip статуса с подстановкой значений обоих конфигов. @see getStatusTooltip
Стр: 615 - 619

## Метод: editorApp.getFieldError(field)
Ошибка валидации поля в текущем режиме. @see getFieldError
Стр: 622 - 624

## Метод: editorApp.getFieldWarning(field)
Предупреждение поля в текущем режиме. @see getFieldWarning
Стр: 627 - 629

## Метод: editorApp.validateField(field, value)
Обёртка: валидирует значение поля, кладёт результат в fieldErrors/
fieldWarnings под ключом "{mode}.{field}" и инкрементирует
_validationVersion для перерендера. @see validateField (editor-logic.js)
Стр: 637 - 649

## Метод: editorApp.selectModel(model)
Обёртка: выбирает модель в конфиг, сбрасывает поиск и валидирует. @see selectModel
Стр: 652 - 657

## Метод: editorApp.hideModelDropdown()
Скрывает dropdown моделей с задержкой (чтобы успел сработать клик).
Стр: 660 - 662

## Метод: editorApp.addArrayItem(field, defaultValue)
Обёртка: добавляет элемент в массив поля. @see addArrayItem (editor-logic.js)
Стр: 665 - 667

## Метод: editorApp.removeArrayItem(field, idx)
Обёртка: удаляет элемент массива по индексу. @see removeArrayItem
Стр: 670 - 672

## Метод: editorApp.getByPath(path)
Читает значение по пути (для вложенных полей).
Обёртка над utils.js:getByPath для использования в Alpine-биндингах.
Возвращает: s {*} значение по пути или undefined
Стр: 683 - 686

## Метод: editorApp.setByPath(path, value)
Записывает значение по пути (иммутабельно).
Обёртка над utils.js:setByPath с обновлением стейта.
Стр: 695 - 698

## Метод: editorApp.validateFieldByPath(path, value)
Валидирует поле по пути (для вложенных полей).
Использует последние сегменты пути как ключ для validateField.
Стр: 707 - 712

## Метод: editorApp.toggleCommentByPath(path)
Переключает комментарий для поля по пути.
Стр: 719 - 724

## Метод: editorApp.loadFile()
Запрашивает путь (prompt с подсказкой) и грузит файл. @async @see loadFileByPath
Стр: 729 - 739

## Метод: editorApp.loadFileByPath(path, mode)
Основная загрузка конфига: читает файл через /api/read, парсит JSONC,
извлекает комментарии, заполняет целевой ConfigSlot и раскрывает
непустые комментарии. При ошибке парсинга — модальное окно с текстом
файла (сценарий A из ТЗ). Для проекта добавляет папку в недавние.
Стр: 751 - 805

## Метод: editorApp.selectProjectFolder()
Выбирает папку проекта. Если конфига нет — создаёт дефолтный
(создание файла, см. ТЗ п.17). @async @see createDefaultConfig
Стр: 811 - 842

## Метод: editorApp.addToRecentProjects(path)
Добавляет папку файла в recentProjects (макс. 10, без дублей) и сохраняет.
Стр: 845 - 855

## Метод: editorApp.loadRecentProject(folder)
Загружает opencode.json из папки недавнего проекта. @async @see loadFileByPath
Стр: 858 - 862

## Метод: editorApp.save()
Сохраняет активный конфиг в JSONC с комментариями.
Алгоритм: чистка пустых значений → валидация всех полей (при ошибках —
блок и список) → computeEdits (минимальная правка исходного текста) →
применение изменённых комментариев → запись через /api/write (backup=true)
→ обновление снимков. @async @see computeEdits @see applyCommentChanges
Стр: 873 - 926

## Метод: editorApp.saveWithoutComments()
Сохраняет чистый JSON без комментариев. Сначала создаёт бэкап JSONC-версию
с комментариями (opencode_comments.json.bak), затем пишет чистый JSON.
Стр: 933 - 1006

## Метод: editorApp.reset()
Откатывает активный конфиг к снимкам (с подтверждением).
Стр: 1009 - 1016

## Метод: editorApp.saveSettings()
Применяет настройки из модалки, сохраняет файл, закрывает окно. @async
Стр: 1019 - 1024

## Метод: editorApp.showErrorModal(title, message, content, filePath)
Открывает модалку критичной ошибки (сценарий A из ТЗ).
Стр: 1027 - 1029

## Метод: editorApp.openInEditor()
Открывает файл из errorModal во внешнем редакторе через /api/open-editor. @async
Стр: 1032 - 1054

## Метод: editorApp.showNotification(message, type)
Показывает уведомление и гасит его по таймеру (ошибки дольше). @param {string} message @param {'success'|'error'|'warning'} [type]
Стр: 1057 - 1062

## Метод: editorApp.initSidebar()
Перерисовывает левую панель (список секций). Триггерится через x-effect
в index.html. Использует renderSidebar из renderer.js; при изменении
HTML пересоздаёт Alpine-дерево (destroyTree/initTree).
Стр: 1072 - 1088

## Метод: editorApp.initContent()
Перерисовывает область контента (поля активной секции). Строит
renderStateFn для каждого поля (статус, ошибки, комментарий) и вызывает
renderContent из renderer.js; при изменении HTML пересоздаёт дерево.
Триггерится через x-effect в index.html. @see renderContent
Стр: 1096 - 1187

