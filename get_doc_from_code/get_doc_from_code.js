#!/usr/bin/env node
/**
 * @file get_doc_from_code.js
 * @description Извлекает JSDoc-документацию из JS-файла и сохраняет её
 *   в Markdown с тем же именем рядом с исходным файлом.
 *
 * Запуск:
 *   node get_doc_from_code.js <путь_к_файлу.js>
 *
 * Результат: <путь_к_файлу>.md
 */

const fs = require('fs');
const path = require('path');

// -----------------------------------------------------------------------------
// ПАРСИНГ АРГУМЕНТОВ
// -----------------------------------------------------------------------------
const inputPath = process.argv[2];
if (!inputPath) {
    console.error('Использование: node get_doc_from_code.js <файл.js>');
    process.exit(1);
}

const absInput = path.resolve(inputPath);
if (!fs.existsSync(absInput)) {
    console.error('Файл не найден:', absInput);
    process.exit(1);
}

const code = fs.readFileSync(absInput, 'utf8');
const ext = path.extname(absInput);
const mdPath = absInput.slice(0, -ext.length) + '.md';

// -----------------------------------------------------------------------------
// ПАРСЕР JSDoc-БЛОКОВ
// -----------------------------------------------------------------------------

/**
 * Разбирает содержимое JSDoc-блока в структуру.
 * @param {string} raw Содержимое блока (без открывающего и закрывающего маркеров)
 * @returns {Object} { description, params, returns, tags, type }
 */
function parseJSDocBody(raw) {
    // Убираем ведущие * на каждой строке
    const lines = raw.split('\n').map(l => l.replace(/^\s*\*\s?/, ''));

    const result = {
        description: [],
        params: [],
        returns: null,
        tags: {},       // {tagName: [values]}
        type: null,
        typedef: null
    };

    let currentField = null;
    let currentContinuation = [];

    const flushContinuation = () => {
        if (currentField && currentContinuation.length > 0) {
            const ext = currentContinuation.join(' ').trim();
            if (ext) {
                if (currentField.kind === 'param') {
                    currentField.description += ' ' + ext;
                } else if (currentField.kind === 'returns') {
                    result.returns.description = (result.returns.description || '') + ' ' + ext;
                } else if (currentField.kind === 'description') {
                    result.description.push(ext);
                }
            }
        }
        currentContinuation = [];
    };

    for (const line of lines) {
        const tagMatch = line.match(/^@(\w+)(?:\s+(.*))?$/);

        if (tagMatch) {
            flushContinuation();
            const tag = tagMatch[1];
            const rest = (tagMatch[2] || '').trim();

            switch (tag) {
                case 'param': {
                    // Форматы: {Type} name - desc  /  {Type} [name=default] - desc  /  name desc
                    const m = rest.match(/^(\{[^}]*\})?\s*(\[?[^\]\s=]+(?:=[^\]]*)?\]?)?\s*-?\s*(.*)$/);
                    const type = m && m[1] ? m[1].slice(1, -1) : '';
                    const nameRaw = m && m[2] ? m[2] : '';
                    const desc = m && m[3] ? m[3].trim() : '';
                    const optional = nameRaw.startsWith('[');
                    const name = nameRaw.replace(/^\[|\]$/g, '').split('=')[0];
                    const def = nameRaw.includes('=') ? nameRaw.split('=', 2)[1].replace(/\]$/, '') : null;
                    const p = { kind: 'param', type, name, description: desc, optional, default: def };
                    result.params.push(p);
                    currentField = p;
                    break;
                }
                case 'returns':
                case 'return': {
                    const m = rest.match(/^(\{[^}]*\})?\s*(.*)$/);
                    result.returns = {
                        kind: 'returns',
                        type: m && m[1] ? m[1].slice(1, -1) : '',
                        description: (m && m[2] ? m[2] : '').trim()
                    };
                    currentField = result.returns;
                    break;
                }
                case 'typedef': {
                    const m = rest.match(/^(\{[^}]*\})?\s*(\S+)?\s*(.*)$/);
                    result.typedef = {
                        type: m && m[1] ? m[1].slice(1, -1) : '',
                        name: m && m[2] ? m[2] : '',
                        description: (m && m[3] ? m[3] : '').trim()
                    };
                    currentField = { kind: 'description' };
                    break;
                }
                case 'property': {
                    const m = rest.match(/^(\{[^}]*\})?\s*(\[?[^\]\s=]+(?:=[^\]]*)?\]?)?\s*-?\s*(.*)$/);
                    if (!result.properties) result.properties = [];
                    const p = {
                        type: m && m[1] ? m[1].slice(1, -1) : '',
                        name: m && m[2] ? m[2].replace(/^\[|\]$/g, '').split('=')[0] : '',
                        description: (m && m[3] ? m[3] : '').trim()
                    };
                    result.properties.push(p);
                    currentField = null;
                    break;
                }
                case 'type': {
                    const m = rest.match(/^\{([^}]*)\}/);
                    result.type = m ? m[1] : rest;
                    currentField = { kind: 'description' };
                    break;
                }
                case 'see':
                    if (!result.tags.see) result.tags.see = [];
                    result.tags.see.push(rest);
                    currentField = { kind: 'description' };
                    break;
                case 'example':
                    currentField = { kind: 'description' };
                    break;
                default:
                    if (!result.tags[tag]) result.tags[tag] = [];
                    result.tags[tag].push(rest);
                    currentField = { kind: 'description' };
            }
        } else if (line.trim() === '') {
            flushContinuation();
            currentField = { kind: 'description' };
        } else if (currentField) {
            currentContinuation.push(line.trim());
        } else {
            result.description.push(line);
            currentField = { kind: 'description' };
        }
    }
    flushContinuation();

    // Объединяем многострочное описание
    result.description = result.description.join('\n').trim();
    return result;
}

// -----------------------------------------------------------------------------
// ПОИСК БЛОКОВ И ИХ СВЯЗЫВАНИЕ С ОБЪЯВЛЕНИЯМИ
// -----------------------------------------------------------------------------

/**
 * Находит все JSDoc-блоки и следующее за ними объявление.
 * @returns {Array<{doc: Object, declaration: Object|null, line: number}>}
 */
function extractDocumentedItems(source) {
    const items = [];
    // Регулярка для открывающего-закрывающего блоков (не жадная, поддерживает многострочники)
    const blockRe = /\/\*\*([\s\S]*?)\*\//g;
    let match;

    const lineOf = (idx) => {
        return source.slice(0, idx).split('\n').length;
    };

    while ((match = blockRe.exec(source)) !== null) {
        const body = match[1];
        const end = match.index + match[0].length;
        const doc = parseJSDocBody(body);
        doc.line = lineOf(match.index);

        // Пропускаем пустые пробелы/комментарии до следующего объявления
        const rest = source.slice(end);
        const decl = findFollowingDeclaration(rest);
        items.push({ doc, declaration: decl, line: doc.line });
    }
    return items;
}

/**
 * Ищет объявление, идущее сразу после JSDoc (пропуская пробелы/комментарии).
 * @param {string} text Текст после закрывающего блока JSDoc
 * @returns {Object|null} { kind, name, signature, async, isGetter, isStatic }
 */
function findFollowingDeclaration(text) {
    // Срезаем пробелы и однострочные комментарии
    const cleaned = text.replace(/^[\s]*(?:\/\/[^\n]*\n[\s]*)*/, '');
    if (!cleaned) return null;

    // function name(...)
    let m = cleaned.match(/^(?:export\s+)?(?:default\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
    if (m) {
        return { kind: 'function', name: m[2], signature: m[3].trim(), async: !!m[1] };
    }

    // class Name
    m = cleaned.match(/^(?:export\s+)?(?:default\s+)?class\s+(\w+)/);
    if (m) {
        return { kind: 'class', name: m[1] };
    }

    // const/let/var name = ...
    m = cleaned.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/);
    if (m) {
        return { kind: 'variable', name: m[1] };
    }

    // Метод объекта: name: function(...) или name(...) или async name(...)
    // Также геттеры: get name()
    m = cleaned.match(/^(?:async\s+)?([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*\{/);
    if (m) {
        return { kind: 'method', name: m[1], signature: m[2].trim(), async: cleaned.startsWith('async') };
    }
    m = cleaned.match(/^get\s+([a-zA-Z_$][\w$]*)\s*\(\)/);
    if (m) {
        return { kind: 'getter', name: m[1] };
    }
    m = cleaned.match(/^set\s+([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)/);
    if (m) {
        return { kind: 'setter', name: m[1], signature: m[2].trim() };
    }

    // Поле объекта: name: ... (но не если это function — уже покрыто)
    m = cleaned.match(/^([a-zA-Z_$][\w$]*)\s*:/);
    if (m) {
        // Проверим, что это не label/ключ в литерале, а действительно поле объекта
        // Эвристика: перед этим обычно пробел/отступ и запятая/скобка в предыдущих строках
        return { kind: 'property', name: m[1] };
    }

    return null;
}

// -----------------------------------------------------------------------------
// ГРУППИРОВКА ПО КАТЕГОРИЯМ
// -----------------------------------------------------------------------------

function categorize(items) {
    const groups = {
        file: null,
        typedefs: [],
        constants: [],
        variables: [],
        classes: [],
        functions: [],
        methods: [],
        getters: [],
        properties: [],
        other: []
    };

    for (const item of items) {
        const { doc, declaration } = item;

        // @file — заголовок файла
        if (doc.tags.file) {
            groups.file = { name: doc.tags.file[0], description: doc.description };
            continue;
        }

        // @typedef
        if (doc.typedef) {
            groups.typedefs.push({ ...doc, declaration });
            continue;
        }

        if (!declaration) {
            // JSDoc без объявления — возможно, глобальная переменная с @global
            if (doc.tags.global) {
                groups.variables.push({ ...doc, name: '(global)', kind: 'variable' });
            } else if (doc.tags.constant) {
                groups.constants.push({ ...doc, name: '(constant)', kind: 'constant' });
            } else {
                groups.other.push({ ...doc });
            }
            continue;
        }

        // Если в теге @constant — форсируем категорию
        if (doc.tags.constant) {
            groups.constants.push({ ...doc, ...declaration });
            continue;
        }

        switch (declaration.kind) {
            case 'function':  groups.functions.push({ ...doc, ...declaration }); break;
            case 'class':     groups.classes.push({ ...doc, ...declaration }); break;
            case 'variable':  groups.variables.push({ ...doc, ...declaration }); break;
            case 'method':    groups.methods.push({ ...doc, ...declaration }); break;
            case 'getter':    groups.getters.push({ ...doc, ...declaration }); break;
            case 'setter':    groups.methods.push({ ...doc, ...declaration, kind: 'setter' }); break;
            case 'property':  groups.properties.push({ ...doc, ...declaration }); break;
            default:          groups.other.push({ ...doc, ...declaration });
        }
    }
    return groups;
}

// -----------------------------------------------------------------------------
// ГЕНЕРАЦИЯ MARKDOWN
// -----------------------------------------------------------------------------

function escapeMarkdown(s) {
    return String(s || '').replace(/[|\\`*_{}[\]()#+\-.!]/g, '\\$&');
}

function renderSection(title, items, renderItem) {
    if (!items || items.length === 0) return '';
    let out = `\n## ${title}\n\n`;
    for (const it of items) {
        out += renderItem(it) + '\n';
    }
    return out;
}

function renderItem(it) {
    const name = it.name || '(без имени)';
    const type = it.type ? ` \`${it.type}\`` : '';
    const asyncTag = it.async ? ' `async`' : '';
    const kindLabel = it.kind ? ` <sup>${it.kind}</sup>` : '';

    let sig = '';
    if (it.kind === 'function' || it.kind === 'method') {
        sig = `\`\`\`js\n${it.async ? 'async ' : ''}function ${name}(${it.signature || ''})\n\`\`\`\n`;
    } else if (it.kind === 'getter') {
        sig = `\`\`\`js\nget ${name}()\n\`\`\`\n`;
    } else if (it.kind === 'setter') {
        sig = `\`\`\`js\nset ${name}(${it.signature || ''})\n\`\`\`\n`;
    } else if (it.kind === 'class') {
        sig = `\`\`\`js\nclass ${name}\n\`\`\`\n`;
    } else if (it.kind === 'constant' || it.kind === 'variable') {
        sig = `\`\`\`js\n${it.kind === 'constant' ? 'const' : 'let'} ${name}${type}\n\`\`\`\n`;
    } else if (it.kind === 'property') {
        sig = `\`\`\`js\n${name}${type}\n\`\`\`\n`;
    }

    const desc = it.description ? `\n${it.description}\n` : '';

    let params = '';
    if (it.params && it.params.length > 0) {
        params = '\n**Параметры:**\n\n';
        params += '| Имя | Тип | Обязат. | Описание |\n';
        params += '|-----|-----|---------|----------|\n';
        for (const p of it.params) {
            const opt = p.optional ? 'нет' : 'да';
            const def = p.default != null ? ` (по умолч.: \`${p.default}\`)` : '';
            params += `| \`${p.name}\` | \`${p.type || 'any'}\` | ${opt} | ${p.description || ''}${def} |\n`;
        }
    }

    let returns = '';
    if (it.returns && (it.returns.type || it.returns.description)) {
        returns = `\n**Возвращает:** \`${it.returns.type || 'any'}\`${it.returns.description ? ' — ' + it.returns.description : ''}\n`;
    }

    let properties = '';
    if (it.properties && it.properties.length > 0) {
        properties = '\n**Поля:**\n\n';
        properties += '| Имя | Тип | Описание |\n';
        properties += '|-----|-----|----------|\n';
        for (const p of it.properties) {
            properties += `| \`${p.name}\` | \`${p.type || 'any'}\` | ${p.description || ''} |\n`;
        }
    }

    let see = '';
    if (it.tags.see && it.tags.see.length > 0) {
        see = '\n**См. также:** ' + it.tags.see.map(s => `\`${s}\``).join(', ') + '\n';
    }

    let extraTags = '';
    for (const [tag, values] of Object.entries(it.tags || {})) {
        if (tag === 'see' || tag === 'file' || tag === 'constant' || tag === 'global') continue;
        extraTags += `\n**@${tag}:** ${values.join(', ')}\n`;
    }

    const line = it.line ? `\n_Строка: ${it.line}_\n` : '';

    return `### \`${name}\`${kindLabel}${asyncTag}\n${sig}${desc}${params}${returns}${properties}${see}${extraTags}${line}`;
}

function buildMarkdown(groups, filePath) {
    const fileName = path.basename(filePath);
    let out = `# Документация: ${fileName}\n\n`;
    out += `_Сгенерировано автоматически из исходного кода._\n`;

    if (groups.file) {
        out += `\n## Файл: ${groups.file.name}\n\n${groups.file.description || ''}\n`;
    }

    out += renderSection('Типы (@typedef)', groups.typedefs, (it) => {
        const name = it.typedef?.name || '(без имени)';
        const type = it.typedef?.type || 'any';
        const desc = it.description ? `\n${it.description}\n` : '';
        let props = '';
        if (it.properties && it.properties.length > 0) {
            props = '\n**Поля:**\n\n| Имя | Тип | Описание |\n|-----|-----|----------|\n';
            for (const p of it.properties) {
                props += `| \`${p.name}\` | \`${p.type || 'any'}\` | ${p.description || ''} |\n`;
            }
        }
        return `### \`${name}\` <sup>typedef ${type}</sup>\n\n\`\`\`js\n/** @typedef {${type}} ${name} */\n\`\`\`${desc}${props}`;
    });

    out += renderSection('Константы', groups.constants, renderItem);
    out += renderSection('Переменные', groups.variables, renderItem);
    out += renderSection('Классы', groups.classes, renderItem);
    out += renderSection('Геттеры', groups.getters, renderItem);
    out += renderSection('Методы', groups.methods, renderItem);
    out += renderSection('Функции', groups.functions, renderItem);
    out += renderSection('Свойства', groups.properties, renderItem);

    return out;
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------
const items = extractDocumentedItems(code);
const groups = categorize(items);
const markdown = buildMarkdown(groups, absInput);

fs.writeFileSync(mdPath, markdown, 'utf8');
console.log(`✅ Сгенерировано: ${mdPath}`);
console.log(`   Найдено объектов: ${items.length}`);
console.log(`   - typedefs: ${groups.typedefs.length}`);
console.log(`   - constants: ${groups.constants.length}`);
console.log(`   - variables: ${groups.variables.length}`);
console.log(`   - classes: ${groups.classes.length}`);
console.log(`   - functions: ${groups.functions.length}`);
console.log(`   - methods: ${groups.methods.length}`);
console.log(`   - getters: ${groups.getters.length}`);
console.log(`   - properties: ${groups.properties.length}`);