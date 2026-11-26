// @file: editor.js
// @project: OCCE
// @docfile: link:../doc/code/editor.md
// Главный модуль приложения (оркестратор)

// Зависимости (загружаются через <script> в index.html):
// - lib/utils.js (path, html, validation, deep utils)
// - lib/schema.js (loadSchema, validateSchema, getVisibleSections, ...)
// - lib/files.js (extractComments, computeEdits, applyCommentChanges, ...)
// - lib/renderer.js (renderSidebar, renderContent, renderField, ...)
// - lib/editor-logic.js (validateField, getStatusClass, toggleComment, ...)
// - Alpine.js (CDN)
// - jsonc-parser (jsonc-wrapper.js)

// Роль: управление state, интеграция модулей, работа с DOM и API

// ================================================================
// CONSTANTS
// ================================================================

/**
 * Зашитые настройки редактора по умолчанию (фолбэк, если файл настроек
 * не найден или битый — см. loadSettings). Также источник структуры
 * для редактора путей внешних редакторов (editorPaths).
 * @constant {Object}
 * @see loadSettings
 */
const DEFAULT_SETTINGS = {
    theme: 'light',
    fontSize: 'medium',
    uiFont: 'Segoe UI',
    fieldFont: 'Consolas',
    lang: 'ru',
    showDeprecated: false,
    externalEditor: 'notepad',
    recentProjects: [],
    editorPaths: {
        notepad: 'C:/Windows/notepad.exe',
        npp: 'C:/Program Files/Notepad++/notepad++.exe',
        vscode: 'code'
    }
};

// ================================================================
// MAIN APP
// ================================================================

/**
 * Фабрика корневого компонента приложения. Возвращает объект состояния
 * и методов, который монтируется на `x-data="editorApp()"` в index.html.
 * Оркестратор: сам логику не реализует — делегирует чистым функциям
 * из lib/* и управляет общим стейтом (конфиги, переводы, валидация,
 * флаги перерендера). Экземпляр доступен как window.editorInstance.
 *
 * Зависимости: все модули загружаются тегами <script> в index.html
 * до этого файла; порядок важен. См. заголовок файла.
 *
 * @returns {Object} Реактивное состояние + методы для Alpine
 * @see init — точка входа инициализации
 */
function editorApp() {
    return {
        // ============ STATE ============

        /**
         * СОСТОЯНИЕ приложения (реактивное, читается/пишется всеми методами).
         * Ключевые поля:
         * - loaded/initializing/schemaLoading — флаги жизненного цикла
         * - mode ('global'|'project'), lang, theme, activeSection
         * - global/project — два ConfigSlot (параллельные конфиги)
         * - translations, models, timezones, schema — справочные данные
         * - showComments, fieldErrors, fieldWarnings — по-полю состояние
         * - _translationsVersion/_validationVersion — счётчики-триггеры: их
         *   инкремент принудительно перерисовывает sidebar/content (x-effect)
         */
        loaded: false,
        mode: 'global',
        lang: 'ru',
        theme: 'light',
        translations: {},
        models: [],
        timezones: [],
        schema: null,
        activeSection: 'basic',

        /**
         * Слот конфигурации (по одному на режим global/project). Хранит данные
         * файла и снимки для сравнения/сброса и сохранения.
         * @typedef {Object} ConfigSlot
         * @property {Object} raw              Текущие (редактируемые) данные JSON
         * @property {Object} originalRaw      Снимок данных при загрузке (для сброса)
         * @property {string} originalText     Исходный текст файла (вход для computeEdits)
         * @property {Object} comments         Комментарии по JSON-путям
         * @property {Object} originalComments Снимок комментариев при загрузке
         * @property {string} path             Путь к файлу ('' если не загружен)
         */
        global: {
            raw: {},
            originalRaw: {},
            originalText: '{}',
            comments: {},
            originalComments: {},
            path: ''
        },
        project: {
            raw: {},
            originalRaw: {},
            originalText: '{}',
            comments: {},
            originalComments: {},
            path: ''
        },

        showComments: {},
        modelSearch: '',
        showModelDropdown: false,
        showRecentMenu: false,
        showSettingsModal: false,
        notification: null,
        errorModal: null,
        settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
        recentProjects: [],
        homePath: '',
        fieldErrors: {},
        fieldWarnings: {},

        // Флаги-стражи для предотвращения повторной инициализации
        initializing: false,
        schemaLoading: false,

        _translationsVersion: 0,    // Триггер перерендера при смене переводов
        _validationVersion: 0,

        // ============ GETTERS ============

        /**
         * Активный ConfigSlot в зависимости от режима.
         * @type {ConfigSlot}
         */
        get currentConfig() {
            return this.mode === 'global' ? this.global : this.project;
        },

        /** Путь к файлу активного конфига ('' если не загружен). @type {string} */
        get currentFilePath() {
            return this.currentConfig.path || '';
        },

        /**
         * Модели из models.txt, отфильтрованные по modelSearch и сгруппированные
         * по провайдеру для dropdown. @type {Array<{name:string, models:Array}>}
         */
        get filteredModels() {
            const search = this.modelSearch.toLowerCase();
            const grouped = {};
            this.models.forEach(model => {
                if (!search ||
                    model.provider.toLowerCase().includes(search) ||
                    model.model.toLowerCase().includes(search)) {
                    if (!grouped[model.provider]) {
                        grouped[model.provider] = { name: model.provider, models: [] };
                    }
                    grouped[model.provider].models.push(model);
                }
            });
            return Object.values(grouped);
        },

        /** Часовые пояса, отфильтрованные по modelSearch. @type {string[]} */
        get filteredTimezones()
        {
            const search = this.modelSearch.toLowerCase();
            if (!search) return this.timezones;
            return this.timezones.filter(tz => tz.toLowerCase().includes(search));
        },

        /** Имя папки проекта (из project.path) для бейджа в тулбаре. @returns {string} */
        getProjectFolder() {
            if (!this.project.path) return '';
            return getDir(this.project.path);
        },

        // ============ INITIALIZATION ============

        /**
         * Точка входа: последовательная загрузка всего и первый рендер.
         * Алгоритм: ждёт готовности jsonc-парсера → настройки → переводы →
         * модели → таймзоны → домашний путь → применяет настройки → схема →
         * автозагрузка глобального конфига и последнего проекта → loaded=true.
         * Защита от повторного запуска — флаги initializing/loaded.
         * Вызывается из index.html через @x-init="init()".
         *
         * Ограничение: порядок важен — схема грузится после переводов, чтобы
         * отладочный вывод был на выбранном языке.
         * @async
         */
        async init()
        {
            if (this.initializing || this.loaded)
            {
                console.log('⏭ init() уже выполняется или завершён, пропускаем');
                return;
            }
            this.initializing = true;

            // Делаем экземпляр доступным глобально для отладки и тестирования
            window.editorInstance = this;

            try
            {
                if (!window.jsoncReady)
                {
                    console.log('Waiting for jsonc-parser...');
                    await new Promise((resolve) => {
                        if (window.jsoncReady) return resolve();
                        if (window.jsoncError) return resolve();
                        window.addEventListener('jsonc-ready', resolve, { once: true });
                        setTimeout(resolve, 5000);
                    });
                }
                if (!window.jsonc || typeof window.jsonc.parse !== 'function') {
                    throw new Error('jsonc-parser not loaded');
                }
                console.log('✅ jsonc-parser ready');

                // 1. СНАЧАЛА загружаем настройки (чтобы знать язык) и переводы
                await this.loadSettings();
                await this.loadTranslations();
                await this.loadModels();
                await this.loadTimezones();
                await this.detectHomePath();
                this.applyAllSettings();

                // 2. ПОТОМ загружаем схему — к этому моменту переводы уже готовы,
                //    и отладочный вывод в консоли будет на русском
                await this.loadSchema();

                if (this.schema)
                {
                    console.log('📋 Доступные секции:',
                        getVisibleSections(this.schema, this.settings.showDeprecated)
                            .map(s => s.id + ' (order=' + s.order + ')'));
                    console.log('🎯 Активная секция:',
                        getActiveSection(this.schema, this.settings.showDeprecated, this.activeSection)?.id);
                    const activeFields = getSectionFields(
                        getActiveSection(this.schema, this.settings.showDeprecated, this.activeSection),
                        this.schema
                    );
                    console.log('📝 Полей в активной секции:', activeFields.length,
                        activeFields.map(f => f.key));
                }

                if (this.homePath) {
                    await this.autoLoadGlobalConfig();
                }
                if (this.recentProjects.length > 0) {
                    await this.autoLoadLastProject();
                }

                this.loaded = true;
            } catch (error)
            {
                console.error('Init error:', error);
                this.showNotification('Error: ' + error.message, 'error');
                this.loaded = true;
                this.initializing = false;
            }
        },

        /** Запрашивает у сервера домашнюю папку (/api/home) → homePath. @async */
        async detectHomePath() {
            try {
                const response = await fetch('/api/home');
                if (response.ok) {
                    const data = await response.json();
                    this.homePath = normalizePath(data.home || '');
                }
            } catch (e) {
                this.homePath = '';
            }
        },

        /**
         * Автозагрузка глобального конфига по стандартному пути
         * ~/.config/opencode/opencode.json. Если файла нет — предупреждение.
         * @async @see loadFileByPath
         */
        async autoLoadGlobalConfig() {
            if (!this.homePath) return;
            const globalPath = pathJoin(this.homePath, '.config', 'opencode', 'opencode.json');
            try {
                const response = await fetch('/api/exists?path=' + encodeURIComponent(globalPath));
                const data = await response.json();
                if (data.exists) {
                    await this.loadFileByPath(globalPath, 'global');
                } else {
                    this.showNotification(this.t('notifications.global_not_found') + ': ' + globalPath, 'warning');
                }
            } catch (e) { }
        },

        /** Автозагрузка последнего проекта (первый в recentProjects). @async */
        async autoLoadLastProject() {
            const lastProject = this.recentProjects[0];
            if (!lastProject) return;
            const configPath = pathJoin(lastProject, 'opencode.json');
            try {
                const response = await fetch('/api/exists?path=' + encodeURIComponent(configPath));
                const data = await response.json();
                if (data.exists) {
                    await this.loadFileByPath(configPath, 'project');
                }
            } catch (e) { }
        },

        // ============ SETTINGS ============

        /**
         * Грузит настройки из occe_settings.json поверх DEFAULT_SETTINGS.
         * При ошибке/отсутствии — откат к дефолтам (зашитый фолбэк).
         * @async @see DEFAULT_SETTINGS @see saveSettingsToFile
         */
        async loadSettings() {
            try {
                const response = await fetch('occe_settings.json');
                if (!response.ok) throw new Error('Not found');
                const loaded = await response.json();
                this.settings = { ...DEFAULT_SETTINGS, ...loaded };
                this.lang = this.settings.lang || 'ru';
                this.theme = this.settings.theme || 'light';
                this.recentProjects = (this.settings.recentProjects || []).map(normalizePath);
            } catch (error) {
                this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            }
        },

        /** Сохраняет настройки + recentProjects в occe_settings.json через /api/write. @async */
        async saveSettingsToFile() {
            try {
                const toSave = { ...this.settings, recentProjects: this.recentProjects };
                await fetch('/api/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: 'occe_settings.json',
                        content: JSON.stringify(toSave, null, 2),
                        backup: false
                    })
                });
            } catch (e) {
                console.warn('Could not save settings');
            }
        },

        /**
         * Загружает словарь текущего языка (lang-{lang}.json) и инкрементирует
         * _translationsVersion → принудительный перерендер. @async @see t
         */
        async loadTranslations()
        {
            const response = await fetch('lang-' + this.lang + '.json');
            this.translations = await response.json();
            // Увеличиваем версию — это триггер для x-effect в сайдбаре и контенте,
            // чтобы они перерендерились с новыми переводами
            this._translationsVersion++;
        },

        /** Парсит CSV из models.txt в this.models (пропускает строку-заголовок). @async */
        async loadModels() {
            const response = await fetch('models.txt');
            const text = await response.text();
            const lines = text.split('\n').filter(line => line && !line.startsWith('provider'));
            this.models = lines.map(line => {
                const parts = line.split(',');
                return {
                    provider: parts[0] || '',
                    model: parts[1] || '',
                    type: parts[2] || '',
                    context: parts[3] || '',
                    cost: parts[4] || '',
                    capabilities: parts[5] || ''
                };
            });
        },

        /** Загружает список таймзон из timezones.txt (игнорирует пустые строки и #). @async */
        async loadTimezones()
        {
            try
            {
                const response = await fetch('timezones.txt');
                if (!response.ok)
                {
                    console.warn('⚠️ Не удалось загрузить timezones.txt: HTTP ' + response.status);
                    return;
                }
                const text = await response.text();
                this.timezones = text.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                console.log('✅ Загружено ' + this.timezones.length + ' часовых поясов');
            } catch (error)
            {
                console.warn('⚠️ Не удалось загрузить timezones.txt:', error.message);
            }
        },

        /** Применяет тему, размер и гарнитуры шрифтов из настроек. @see applyTheme */
        applyAllSettings() {
            this.applyTheme(this.settings.theme);
            this.applyFontSize(this.settings.fontSize);
            this.applyFonts();
        },

        /** Устанавливает тему на <html> через атрибут data-theme. @param {'light'|'dark'} theme */
        applyTheme(theme) {
            this.theme = theme;
            document.documentElement.setAttribute('data-theme', theme);
        },

        /** Пишет размер шрифта в CSS-переменную --font-size. @param {'small'|'medium'|'large'|'xlarge'} size */
        applyFontSize(size) {
            const sizes = { small: '12px', medium: '14px', large: '16px', xlarge: '18px' };
            document.documentElement.style.setProperty('--font-size', sizes[size] || '14px');
        },

        /** Пишет гарнитуры в CSS-переменные --ui-font и --field-font. */
        applyFonts() {
            document.documentElement.style.setProperty('--ui-font', this.settings.uiFont + ', sans-serif');
            document.documentElement.style.setProperty('--field-font', this.settings.fieldFont + ', monospace');
        },

        // ============ SCHEMA ============

        /**
         * Загружает и валидирует schema_occe.json через schema.js. При ошибках —
         * предупреждения (битые $ref, отсутствующие поля), схема остаётся рабочей
         * по возможности. Защита от повторной загрузки — флаг schemaLoading.
         * @async @see loadSchema (lib/schema.js) @see validateSchema
         */
        async loadSchema()
        {
            if (this.schema || this.schemaLoading)
            {
                console.log('⏭ loadSchema() уже выполняется или завершён, пропускаем');
                return;
            }
            this.schemaLoading = true;

            try
            {
                this.schema = await loadSchema('schema_occe.json', {
                    fetchFn: fetch,
                    jsoncParser: window.jsonc.parse,
                    log: true
                });
                const validationResult = validateSchema(this.schema);
                if (!validationResult.valid)
                {
                    if (validationResult.missingFields.length > 0)
                    {
                        this.showNotification(
                            'Схема повреждена: отсутствуют поля ' + validationResult.missingFields.join(', '),
                            'warning'
                        );
                    }
                    if (validationResult.brokenRefs.length > 0)
                    {
                        this.showNotification(
                            'Схема содержит ' + validationResult.brokenRefs.length + ' нерабочих $ref ссылок. См. консоль.',
                            'warning'
                        );
                        console.warn('⚠️ Нерабочие $ref ссылки:', validationResult.brokenRefs);
                    }
                }
            } catch (err)
            {
                console.error('❌ Не удалось загрузить schema_occe.json:', err.message);
                this.showNotification('Не удалось загрузить схему: ' + err.message, 'warning');
                this.schema = null;
                this.schemaLoading = false;
            }
        },

        // ============ SECTIONS ============

        /** Устанавливает активную секцию (триггер перерендера контента). @param {string} sectionId */
        setActiveSection(sectionId) {
            this.activeSection = sectionId;
        },

        // ============ TRANSLATIONS ============

        /**
         * Возвращает перевод по точечному ключу. Двухфазный поиск:
         * 1) быстрый путь — стандартное вложенное разбиение;
         * 2) медленный путь — рекурсивный поиск с объединением частей ключа,
         *    чтобы поддерживать плоские ключи вида "sections.basic.description".
         * Fallback: возвращает сам ключ, если перевод не найден.
         * @param {string} key Точечный ключ перевода
         * @returns {string} Переведённая строка или ключ
         */
        t(key)
        {
            if (!key) return '';
            const parts = key.split('.');

            // БЫСТРЫЙ ПУТЬ: стандартное вложенное разбиение
            // Работает для большинства ключей: "ui.save", "fields.model.label"
            let value = this.translations;
            let fastPathValid = true;
            for (const k of parts)
            {
                if (value == null || typeof value !== 'object')
                {
                    fastPathValid = false;
                    break;
                }
                value = value[k];
                if (value === undefined)
                {
                    fastPathValid = false;
                    break;
                }
            }
            if (fastPathValid && value !== undefined && value !== null)
            {
                return value;
            }

            // МЕДЛЕННЫЙ ПУТЬ: рекурсивный поиск с объединением частей ключа.
            // Нужен для поддержки плоских ключей с точками в JSON-файлах.
            // Например: { "sections": { "basic": "Основное", "basic.description": "Описание" } }
            // При вызове t("sections.basic.description") мы должны найти
            // translations.sections["basic.description"], а не translations.sections.basic.description
            function search(obj, idx)
            {
                if (idx === parts.length) return obj;
                if (obj == null || typeof obj !== 'object') return undefined;

                for (let len = 1; len <= parts.length - idx; len++)
                {
                    const k = parts.slice(idx, idx + len).join('.');
                    if (k in obj)
                    {
                        const result = search(obj[k], idx + len);
                        if (result !== undefined) return result;
                    }
                }
                return undefined;
            }

            const result = search(this.translations, 0);
            return result !== undefined && result !== null ? result : key;
        },

        // ============ UI ACTIONS ============

        /** Переключает режим global/project. @param {'global'|'project'} tab */
        switchTab(tab) {
            this.mode = tab;
        },

        /** Инвертирует тему, применяет и сохраняет в файл настроек. */
        toggleTheme() {
            const newTheme = this.theme === 'light' ? 'dark' : 'light';
            this.settings.theme = newTheme;
            this.applyTheme(newTheme);
            this.saveSettingsToFile();
        },

        /** Меняет язык, перезагружает переводы и сохраняет настройку. @async @param {'ru'|'en'|'es'} lang */
        async changeLanguage(lang) {
            this.lang = lang;
            this.settings.lang = lang;
            await this.loadTranslations();
            this.saveSettingsToFile();
        },

        // ============ FIELD OPERATIONS (обёртки над чистыми функциями) ============

        /**
         * Каждый метод ниже — тонкая обёртка над одноимённой чистой функцией из lib/editor-logic.js (или utils),
         * которая передаёт ей текущий конфиг/режим и пишет результат обратно в стейт. Саму логику ищи в editor-logic.js.
         */

        /** Обёртка: переключает видимость/текст комментария поля. @see toggleComment (editor-logic.js) */
        toggleComment(field) {
            const result = toggleComment(field, this.showComments, this.currentConfig.comments);
            this.showComments = result.showComments;
            this.currentConfig.comments = result.comments;
        },

        /** Обёртка: значение поля из активного конфига. @see getCurrentValue (editor-logic.js) */
        getCurrentValue(field) {
            return getCurrentValue(field, this.currentConfig.raw);
        },

        /**
         * Обёртка: статус источника значения (⚪/🔵 - зелёный/жёлтый/серый/синий) с учётом второго файла конфига (глобального/локального).
         * @see getStatusClass (editor-logic.js)
         */
        getStatusClass(field) {
            const otherRaw = this.mode === 'global' ? this.project.raw : this.global.raw;
            return getStatusClass(field, this.currentConfig.raw, otherRaw);
        },

        /** Текст статуса (через getStatusClass + перевод). @see getStatusText */
        getStatusText(field) {
            const cls = this.getStatusClass(field);
            return getStatusText(cls, this.t.bind(this));
        },

        /** Tooltip статуса с подстановкой значений обоих конфигов. @see getStatusTooltip */
        getStatusTooltip(field) {
            const cls = this.getStatusClass(field);
            const otherRaw = this.mode === 'global' ? this.project.raw : this.global.raw;
            return getStatusTooltip(field, cls, this.currentConfig.raw, otherRaw, this.t.bind(this));
        },

        /** Ошибка валидации поля в текущем режиме. @see getFieldError */
        getFieldError(field) {
            return getFieldError(field, this.mode, this.fieldErrors);
        },

        /** Предупреждение поля в текущем режиме. @see getFieldWarning */
        getFieldWarning(field) {
            return getFieldWarning(field, this.mode, this.fieldWarnings);
        },

        /**
         * Обёртка: валидирует значение поля, кладёт результат в fieldErrors/
         * fieldWarnings под ключом "{mode}.{field}" и инкрементирует
         * _validationVersion для перерендера. @see validateField (editor-logic.js)
         * @param {string} field @param {*} value
         */
        validateField(field, value)
        {
            const key = this.mode + '.' + field;
            delete this.fieldErrors[key];
            delete this.fieldWarnings[key];

            const result = validateField(field, value, this.t.bind(this));
            if (result.error) this.fieldErrors[key] = result.error;
            if (result.warning) this.fieldWarnings[key] = result.warning;

            // Инкрементируем версию для принудительного ререндера UI
            this._validationVersion++;
        },

        /** Обёртка: выбирает модель в конфиг, сбрасывает поиск и валидирует. @see selectModel */
        selectModel(model) {
            this.currentConfig.raw = selectModel(model, this.currentConfig.raw);
            this.modelSearch = '';
            this.showModelDropdown = false;
            this.validateField('model', this.currentConfig.raw.model);
        },

        /** Скрывает dropdown моделей с задержкой (чтобы успел сработать клик). */
        hideModelDropdown() {
            setTimeout(() => { this.showModelDropdown = false; }, 200);
        },

        /** Обёртка: добавляет элемент в массив поля. @see addArrayItem (editor-logic.js) */
        addArrayItem(field, defaultValue) {
            this.currentConfig.raw = addArrayItem(field, defaultValue, this.currentConfig.raw);
        },

        /** Обёртка: удаляет элемент массива по индексу. @see removeArrayItem */
        removeArrayItem(field, idx) {
            this.currentConfig.raw = removeArrayItem(field, idx, this.currentConfig.raw);
        },

        // ============ PATH-BASED FIELD OPERATIONS ============

        /**
         * Читает значение по пути (для вложенных полей).
         * Обёртка над utils.js:getByPath для использования в Alpine-биндингах.
         * 
         * @param {string} path - точечный путь ('mcp.timeout.startup')
         * @returns {*} значение по пути или undefined
         */
        getByPath(path)
        {
            return getByPath(this.currentConfig.raw, path);
        },

        /**
         * Записывает значение по пути (иммутабельно).
         * Обёртка над utils.js:setByPath с обновлением стейта.
         * 
         * @param {string} path - точечный путь
         * @param {*} value - новое значение
         */
        setByPath(path, value)
        {
            this.currentConfig.raw = setByPath(this.currentConfig.raw, path, value);
        },

        /**
         * Валидирует поле по пути (для вложенных полей).
         * Использует последние сегменты пути как ключ для validateField.
         * 
         * @param {string} path - точечный путь
         * @param {*} value - значение для валидации
         */
        validateFieldByPath(path, value)
        {
            // Извлекаем имя поля из пути (последний сегмент)
            const fieldKey = path.split('.').pop();
            this.validateField(fieldKey, value);
        },

        /**
         * Переключает комментарий для поля по пути.
         * 
         * @param {string} path - точечный путь
         */
        toggleCommentByPath(path)
        {
            const result = toggleComment(path, this.showComments, this.currentConfig.comments);
            this.showComments = result.showComments;
            this.currentConfig.comments = result.comments;
        },

        // ============ FILE OPERATIONS ============

        /** Запрашивает путь (prompt с подсказкой) и грузит файл. @async @see loadFileByPath */
        async loadFile() {
            let defaultPath = '';
            if (this.mode === 'global' && this.homePath) {
                defaultPath = pathJoin(this.homePath, '.config', 'opencode', 'opencode.json');
            } else if (this.mode === 'project' && this.currentFilePath) {
                defaultPath = this.currentFilePath;
            }
            const path = prompt(this.t('prompts.enter_path'), defaultPath);
            if (!path) return;
            await this.loadFileByPath(normalizePath(path), this.mode);
        },

        /**
         * Основная загрузка конфига: читает файл через /api/read, парсит JSONC,
         * извлекает комментарии, заполняет целевой ConfigSlot и раскрывает
         * непустые комментарии. При ошибке парсинга — модальное окно с текстом
         * файла (сценарий A из ТЗ). Для проекта добавляет папку в недавние.
         * @async
         * @param {string} path Путь к файлу
         * @param {'global'|'project'} mode Целевой слот
         * @see extractComments @see showErrorModal
         */
        async loadFileByPath(path, mode) {
            path = normalizePath(path);
            try {
                const response = await fetch('/api/read?path=' + encodeURIComponent(path));
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to read file');
                }
                const content = data.content;
                const target = mode === 'global' ? this.global : this.project;

                try {
                    const errors = [];
                    const raw = window.jsonc.parse(content, errors, {
                        allowTrailingComma: true,
                        disallowComments: false
                    });
                    if (errors.length > 0) {
                        console.warn('Parse warnings:', errors);
                    }

                    const comments = extractComments(content);
                    target.raw = raw;
                    target.originalRaw = deepClone(raw);
                    target.originalText = content;
                    target.comments = { ...comments };
                    target.originalComments = { ...comments };
                    target.path = path;

                    // Автоматически раскрываем все непустые комментарии
                    const nonEmptyKeys = getNonEmptyCommentKeys(comments);
                    for (const key of nonEmptyKeys)
                    {
                        this.showComments[key] = true;
                    }

                    if (mode === 'project') {
                        this.addToRecentProjects(path);
                    }

                    Object.keys(raw).forEach(k => this.validateField(k, raw[k]));
                    this.showNotification(this.t('notifications.file_loaded') + ': ' + path, 'success');
                } catch (parseError) {
                    const errorMessage = parseError.message || 'Unknown parse error';
                    this.showErrorModal(
                        this.t('errors.parse_error'),
                        errorMessage,
                        content,
                        path
                    );
                }
            } catch (error) {
                this.showNotification(this.t('errors.load_error') + ': ' + error.message, 'error');
            }
        },

        /**
         * Выбирает папку проекта. Если конфига нет — создаёт дефолтный
         * (создание файла, см. ТЗ п.17). @async @see createDefaultConfig
         */
        async selectProjectFolder() {
            const path = prompt(this.t('prompts.enter_folder'));
            if (!path) return;
            const normalized = normalizePath(path);
            const configPath = pathJoin(normalized, 'opencode.json');
            this.project.path = configPath;
            this.addToRecentProjects(configPath);

            try {
                const response = await fetch('/api/exists?path=' + encodeURIComponent(configPath));
                const data = await response.json();
                if (data.exists) {
                    await this.loadFileByPath(configPath, 'project');
                } else {
                    const defaultConfig = createDefaultConfig(this.schema);
                    this.project.raw = defaultConfig;
                    this.project.originalRaw = deepClone(defaultConfig);
                    this.project.originalText = JSON.stringify(defaultConfig, null, 2);
                    this.project.comments = {};
                    this.project.originalComments = {};
                    this.showNotification(this.t('notifications.folder_set_new_file'), 'success');
                }
            } catch (e) {
                const defaultConfig = createDefaultConfig(this.schema);
                this.project.raw = defaultConfig;
                this.project.originalRaw = deepClone(defaultConfig);
                this.project.originalText = JSON.stringify(defaultConfig, null, 2);
                this.project.comments = {};
                this.project.originalComments = {};
                this.showNotification(this.t('notifications.folder_set'), 'success');
            }
        },

        /** Добавляет папку файла в recentProjects (макс. 10, без дублей) и сохраняет. */
        addToRecentProjects(path) {
            const folder = getDir(path);
            if (!folder) return;
            this.recentProjects = this.recentProjects.filter(p => p !== folder);
            this.recentProjects.unshift(folder);
            if (this.recentProjects.length > 10) {
                this.recentProjects = this.recentProjects.slice(0, 10);
            }
            this.settings.recentProjects = this.recentProjects;
            this.saveSettingsToFile();
        },

        /** Загружает opencode.json из папки недавнего проекта. @async @see loadFileByPath */
        async loadRecentProject(folder) {
            this.showRecentMenu = false;
            const configPath = pathJoin(folder, 'opencode.json');
            await this.loadFileByPath(configPath, 'project');
        },

        // ============ SAVE OPERATIONS ============

        /**
         * Сохраняет активный конфиг в JSONC с комментариями.
         * Алгоритм: чистка пустых значений → валидация всех полей (при ошибках —
         * блок и список) → computeEdits (минимальная правка исходного текста) →
         * применение изменённых комментариев → запись через /api/write (backup=true)
         * → обновление снимков. @async @see computeEdits @see applyCommentChanges
         */
        async save() {
            if (!this.currentFilePath) {
                this.showNotification(this.t('errors.no_path'), 'warning');
                return;
            }

            const cleanedRaw = cleanEmptyValues(this.currentConfig.raw);
            const errors = [];
            Object.keys(cleanedRaw).forEach(k => {
                this.validateField(k, cleanedRaw[k]);
                if (this.fieldErrors[this.mode + '.' + k]) {
                    errors.push(k + ': ' + this.fieldErrors[this.mode + '.' + k]);
                }
            });

            if (errors.length > 0) {
                this.showNotification(this.t('errors.cannot_save') + '\n' + errors.join('\n'), 'error');
                return;
            }

            try {
                let content = computeEdits(
                    this.currentConfig.originalText,
                    cleanedRaw,
                    cleanEmptyValues(this.currentConfig.originalRaw),
                    window.jsonc
                );
                content = applyCommentChanges(content, this.currentConfig.comments, this.currentConfig.originalComments);

                const response = await fetch('/api/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: this.currentFilePath,
                        content: content,
                        backup: true
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);

                this.currentConfig.raw = cleanedRaw;
                this.currentConfig.originalRaw = deepClone(cleanedRaw);
                this.currentConfig.originalText = content;

                const finalComments = cleanEmptyComments(this.currentConfig.comments);
                this.currentConfig.comments = { ...finalComments };
                this.currentConfig.originalComments = { ...finalComments };

                this.showNotification(this.t('notifications.saved') + ': ' + this.currentFilePath, 'success');
            } catch (error) {
                this.showNotification(this.t('errors.save_error') + ': ' + error.message, 'error');
            }
        },

        /**
         * Сохраняет чистый JSON без комментариев. Сначала создаёт бэкап JSONC-версию
         * с комментариями (opencode_comments.json.bak), затем пишет чистый JSON.
         * @async @see save
         */
        async saveWithoutComments()
        {
            if (!this.currentFilePath)
            {
                this.showNotification(this.t('errors.no_path'), 'warning');
                return;
            }

            try
            {
                const cleanedRaw = cleanEmptyValues(this.currentConfig.raw);
                let jsoncContent = computeEdits(
                    this.currentConfig.originalText,
                    cleanedRaw,
                    cleanEmptyValues(this.currentConfig.originalRaw),
                    window.jsonc
                );
                jsoncContent = applyCommentChanges(jsoncContent, this.currentConfig.comments, this.currentConfig.originalComments);

                const backupPath = this.currentFilePath.replace(/\.jsonc?$/, '_comments.json.bak');

                // Сохранение бэкапа с комментариями
                const backupResponse = await fetch('/api/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: backupPath,
                        content: jsoncContent,
                        backup: false
                    })
                });
                if (!backupResponse.ok)
                {
                    const errorText = await backupResponse.text();
                    throw new Error('Не удалось создать бэкап: HTTP ' + backupResponse.status + ' - ' + errorText);
                }

                // Сохранение чистого файла
                const cleanContent = JSON.stringify(cleanedRaw, null, 2);
                const mainResponse = await fetch('/api/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: this.currentFilePath,
                        content: cleanContent,
                        backup: false
                    })
                });
                const mainData = await mainResponse.json();
                if (!mainResponse.ok)
                {
                    throw new Error(mainData.error || 'HTTP ' + mainResponse.status);
                }

                this.currentConfig.raw = cleanedRaw;
                this.currentConfig.originalRaw = deepClone(cleanedRaw);
                this.currentConfig.originalText = jsoncContent;

                const finalComments = cleanEmptyComments(this.currentConfig.comments);
                this.currentConfig.comments = { ...finalComments };
                this.currentConfig.originalComments = { ...finalComments };

                console.log('✅ Сохранено без комментариев. Бэкап: ' + backupPath);
                this.showNotification(
                    this.t('notifications.saved_clean') + '. ' +
                    this.t('notifications.comments_backup') + ': ' + backupPath,
                    'success'
                );
            } catch (error)
            {
                console.error('❌ Ошибка сохранения без комментариев:', error);
                this.showNotification(this.t('errors.save_error') + ': ' + error.message, 'error');
            }
        },

        /** Откатывает активный конфиг к снимкам (с подтверждением). */
        reset() {
            if (confirm(this.t('dialogs.reset_confirm'))) {
                this.currentConfig.raw = deepClone(this.currentConfig.originalRaw);
                this.currentConfig.comments = { ...this.currentConfig.originalComments };
                this.showComments = {};
                this.showNotification(this.t('notifications.reset'), 'success');
            }
        },

        /** Применяет настройки из модалки, сохраняет файл, закрывает окно. @async */
        async saveSettings() {
            this.applyAllSettings();
            await this.saveSettingsToFile();
            this.showSettingsModal = false;
            this.showNotification(this.t('notifications.settings_saved'), 'success');
        },

        /** Открывает модалку критичной ошибки (сценарий A из ТЗ). */
        showErrorModal(title, message, content, filePath) {
            this.errorModal = { title, message, content, filePath };
        },

        /** Открывает файл из errorModal во внешнем редакторе через /api/open-editor. @async */
        async openInEditor() {
            if (!this.errorModal?.filePath) return;
            const editorPath = this.settings.editorPaths[this.settings.externalEditor] || 'notepad';
            try {
                const response = await fetch('/api/open-editor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        editor: editorPath,
                        filePath: this.errorModal.filePath
                    })
                });
                if (response.ok) {
                    this.showNotification(this.t('notifications.opened_in_editor'), 'success');
                    this.errorModal = null;
                } else {
                    const data = await response.json();
                    this.showNotification('Error: ' + data.error, 'error');
                }
            } catch (error) {
                this.showNotification('Error: ' + error.message, 'error');
            }
        },

        /** Показывает уведомление и гасит его по таймеру (ошибки дольше). @param {string} message @param {'success'|'error'|'warning'} [type] */
        showNotification(message, type) {
            type = type || 'success';
            this.notification = { message, type };
            const duration = type === 'error' ? 6000 : 4000;
            setTimeout(() => { this.notification = null; }, duration);
        },

        // ============ DYNAMIC UI RENDERING ============

        /**
         * Перерисовывает левую панель (список секций). Триггерится через x-effect
         * в index.html. Использует renderSidebar из renderer.js; при изменении
         * HTML пересоздаёт Alpine-дерево (destroyTree/initTree).
         * @see renderSidebar
         */
        initSidebar() {
            this.$nextTick(() => {
                const el = this.$refs.dynamicSidebar;
                if (!el) return;

                const sections = getVisibleSections(this.schema, this.settings.showDeprecated);
                const html = renderSidebar(sections, this.activeSection, this.t.bind(this));

                if (el.innerHTML !== html) {
                    if (el._x_dataStack || el._x_refs) {
                        Alpine.destroyTree(el);
                    }
                    el.innerHTML = html;
                    Alpine.initTree(el);
                }
            });
        },

        /**
         * Перерисовывает область контента (поля активной секции). Строит
         * renderStateFn для каждого поля (статус, ошибки, комментарий) и вызывает
         * renderContent из renderer.js; при изменении HTML пересоздаёт дерево.
         * Триггерится через x-effect в index.html. @see renderContent
         */
        initContent()
        {
            this.$nextTick(() =>
            {
                const el = this.$refs.dynamicContent;
                if (!el) return;

                // ──────────────────────────────────────────────
                // 1. СОХРАНЯЕМ фокус и позицию курсора ПЕРЕД ререндером
                // ──────────────────────────────────────────────
                let focusInfo = null;
                const active = document.activeElement;
                if (active && el.contains(active))
                {
                    focusInfo = {
                        elementId: active.id || '',
                        fieldKey: active.getAttribute('data-field-key') || '',
                        tagName: active.tagName,
                        selectionStart: active.selectionStart,
                        selectionEnd: active.selectionEnd,
                        value: active.value
                    };
                    console.log('[OCCE] Сохранён фокус:', focusInfo);
                }

                // ──────────────────────────────────────────────
                // 2. РЕНДЕРИНГ
                // ──────────────────────────────────────────────
                const section = getActiveSection(this.schema, this.settings.showDeprecated, this.activeSection);
                const fields = getSectionFields(section, this.schema);
                const renderStateFn = (fieldKey) => ({
                    statusClass: this.getStatusClass(fieldKey),
                    statusTooltip: this.getStatusTooltip(fieldKey),
                    error: this.getFieldError(fieldKey),
                    warning: this.getFieldWarning(fieldKey),
                    showComment: this.showComments[fieldKey] || false
                });
                const html = renderContent(section, fields, renderStateFn, this.t.bind(this));

                const needRerender = el.innerHTML !== html;
                if (needRerender)
                {
                    console.log('[OCCE] Ререндер контента');
                    if (el._x_dataStack || el._x_refs)
                    {
                        Alpine.destroyTree(el);
                    }
                    el.innerHTML = html;
                    Alpine.initTree(el);
                } else
                {
                    console.log('[OCCE] Ререндер не нужен');
                }

                // ──────────────────────────────────────────────
                // 3. ВОССТАНАВЛИВАЕМ фокус и позицию курсора ПОСЛЕ ререндера
                // ──────────────────────────────────────────────
                if (focusInfo && focusInfo.fieldKey && needRerender)
                {
                    // Ищем элемент по data-field-key
                    const selector = `[data-field-key="${focusInfo.fieldKey}"]`;
                    const restored = el.querySelector(selector);

                    if (restored)
                    {
                        console.log('[OCCE] Восстановление фокуса на:', focusInfo.fieldKey);
                        // Отложенный фокус — чтобы Alpine успел инициализировать биндинги
                        setTimeout(() =>
                        {
                            restored.focus();
                            // Восстанавливаем позицию курсора (только для input/textarea)
                            if ((restored.tagName === 'INPUT' || restored.tagName === 'TEXTAREA') &&
                                typeof restored.setSelectionRange === 'function' &&
                                typeof focusInfo.selectionStart === 'number')
                            {
                                try
                                {
                                    restored.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
                                    console.log('[OCCE] Курсор восстановлен на позицию:', focusInfo.selectionStart);
                                } catch (e)
                                {
                                    console.warn('[OCCE] Не удалось восстановить позицию курсора:', e);
                                }
                            }
                        }, 0);
                    } else
                    {
                        console.warn('[OCCE] Элемент для восстановления фокуса не найден:', selector);
                    }
                }
            });
        },
    };
}