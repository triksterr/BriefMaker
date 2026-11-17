#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Parser = require('tree-sitter');
const Cpp = require('tree-sitter-cpp');
const JavaScript = require('tree-sitter-javascript');

// ==========================================
// ЛОКАЛИЗАЦИЯ (i18n)
// ==========================================
const STRINGS_EN = {
    fileLabel: 'File: ',
    classType: 'Class',
    methodType: 'Method',
    functionType: 'Function',
    macroType: 'Macro',
    constantType: 'Constant',
    typeAliasType: 'TypeAlias',
    fieldType: 'Field',
    lineSingle: 'Line: ',
    lineRange: 'Lines: ',
    returns: 'Returns: ',
    usage: 'Usage: briefmaker <input_file> [output_path] [-ru]',
    fileNotFound: 'File not found: ',
    unsupportedExt: 'Unsupported extension: ',
    briefCreated: 'Brief successfully created: ',
    error: 'Error: ',
    langEnabled: ''
};

const STRINGS_RU = {
    fileLabel: 'Файл: ',
    classType: 'Класс',
    methodType: 'Метод',
    functionType: 'Функция',
    macroType: 'Макрос',
    constantType: 'Константа',
    typeAliasType: 'Псевдоним типа',
    fieldType: 'Поле',
    lineSingle: 'Стр: ',
    lineRange: 'Стр: ',
    returns: 'Возвращает: ',
    usage: 'Использование: briefmaker <входной_файл> [путь_вывода] [-ru]',
    fileNotFound: 'Файл не найден: ',
    unsupportedExt: 'Неподдерживаемое расширение: ',
    briefCreated: 'Бриф успешно создан: ',
    error: 'Ошибка: ',
    langEnabled: 'Включён русский язык интерфейса.'
};

// ==========================================
// УТИЛИТЫ
// ==========================================
function readFileToUtf8String(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Удаляем BOM, если он есть
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    return content;
}

function trimString(s) {
    return s.trim();
}

function removeInlineCommentsFromSignature(rawSig) {
    let sig = rawSig.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ');
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < sig.length; i++) {
        const c = sig[i];
        if (!inString) {
            if (c === '"' || c === "'" || c === '`') {
                inString = true;
                stringChar = c;
            } else if (c === '/' && i + 1 < sig.length) {
                if (sig[i + 1] === '/' || sig[i + 1] === '*') {
                    return trimString(sig.slice(0, i));
                }
            }
        } else {
            if (c === stringChar) {
                let backslashes = 0;
                for (let j = i - 1; j >= 0 && sig[j] === '\\'; j--) backslashes++;
                if (backslashes % 2 === 0) inString = false;
            }
        }
    }
    return trimString(sig);
}

function cleanDoxygenLine(line, S) {
    const l = trimString(line);
    if (!l) return '';

    if (/^[=\-*#~_]+$/.test(l)) return ''; // ФИЛЬТР: Игнорируем графические разделители (добавили _ )

    let m;
    if ((m = l.match(/^@(?:brief|details)\s+(.*)/i))) return m[1];
    if ((m = l.match(/^@param\s+(\w+)\s*(.*)/i))) return `${m[1]}: ${m[2]}`;
    if ((m = l.match(/^@return\s*(.*)/i))) return `${S.returns}${m[1]}`;
    if (l.match(/^@(?:author|date|version|file|class|struct|namespace|def)\b.*/i)) return '';
    if (l.match(/^@[a-zA-Z]+\b.*/)) return '';

    return l;
}

function isFunctionDeclaration(node) {
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === 'function_declarator') return true;
        if (child.type === 'pointer_declarator' || child.type === 'reference_declarator') {
            for (let j = 0; j < child.childCount; j++) {
                if (child.child(j).type === 'function_declarator') return true;
            }
        }
    }
    return false;
}

// ==========================================
// ГЛАВНЫЙ КЛАСС-ПАРСЕР
// ==========================================
class BriefGenerator {
    constructor(S) {
        this.S = S;
        this.entities = [];
        this.comments = [];
        this.code = '';
    }

    collectComments(node) {
        if (node.type === 'comment') {
            this.comments.push({
                text: this.code.substring(node.startIndex, node.endIndex),
                startLine: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                startByte: node.startIndex,
                endByte: node.endIndex
            });
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectComments(node.child(i));
        }
    }

    processNode(node, currentPrefix) {
        const type = node.type;
        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        const startByte = node.startIndex;
        const endByte = node.endIndex;

        // ========== C++ ==========
        if (type === 'namespace_definition') {
            let name = '';
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child.type === 'namespace_identifier') {
                    name = this.code.substring(child.startIndex, child.endIndex);
                    break;
                }
            }
            const newPrefix = currentPrefix + name + '::';
            for (let i = 0; i < node.childCount; i++) {
                this.processNode(node.child(i), newPrefix);
            }
        }
        else if (type === 'class_specifier' || type === 'struct_specifier') {
            let name = '';
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child.type === 'type_identifier') {
                    name = this.code.substring(child.startIndex, child.endIndex);
                    break;
                }
            }
            this.entities.push({
                type: this.S.classType,
                prefix: currentPrefix,
                signature: name,
                comment: '',
                startLine, endLine, startByte, endByte
            });
            const newPrefix = currentPrefix + name + '::';
            for (let i = 0; i < node.childCount; i++) {
                this.processNode(node.child(i), newPrefix);
            }
        }
        else if (type === 'function_definition') {
            let sig = '';
            let body = null;
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child.type === 'compound_statement' || child.type === 'try_statement') {
                    body = child;
                    break;
                }
            }
            if (body && !body.isNull) {
                sig = this.code.substring(startByte, body.startIndex);
            } else {
                sig = this.code.substring(startByte, endByte);
            }
            this.entities.push({
                type: currentPrefix ? this.S.methodType : this.S.functionType,
                prefix: currentPrefix,
                signature: removeInlineCommentsFromSignature(sig),
                comment: '',
                startLine, endLine, startByte, endByte
            });
        }
        else if (type === 'preproc_def' || type === 'preproc_function_def') {
            const text = this.code.substring(startByte, endByte);
            this.entities.push({
                type: this.S.macroType,
                prefix: '',
                signature: removeInlineCommentsFromSignature(text),
                comment: '',
                startLine, endLine, startByte, endByte
            });
        }
        else if (type === 'alias_declaration' || type === 'type_definition') {
            const text = this.code.substring(startByte, endByte);
            this.entities.push({
                type: this.S.typeAliasType,
                prefix: currentPrefix,
                signature: removeInlineCommentsFromSignature(text),
                comment: '',
                startLine, endLine: startLine, startByte, endByte
            });
        }
        else if (type === 'declaration' || type === 'field_declaration') {
            const text = this.code.substring(startByte, endByte);
            if (isFunctionDeclaration(node)) {
                this.entities.push({
                    type: currentPrefix ? this.S.methodType : this.S.functionType,
                    prefix: currentPrefix,
                    signature: removeInlineCommentsFromSignature(text),
                    comment: '',
                    startLine, endLine, startByte, endByte
                });
            } else {
                this.entities.push({
                    type: currentPrefix ? this.S.fieldType : this.S.constantType,
                    prefix: currentPrefix,
                    signature: removeInlineCommentsFromSignature(text),
                    comment: '',
                    startLine, endLine, startByte, endByte
                });
            }
        }
        // ========== JS ==========
        else if (type === 'class_declaration') {
            let name = '';
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child.type === 'identifier' || child.type === 'type_identifier') {
                    name = this.code.substring(child.startIndex, child.endIndex);
                    break;
                }
            }
            this.entities.push({
                type: this.S.classType,
                prefix: currentPrefix,
                signature: name,
                comment: '',
                startLine, endLine, startByte, endByte
            });
            const newPrefix = currentPrefix + name + '.';
            for (let i = 0; i < node.childCount; i++) {
                this.processNode(node.child(i), newPrefix);
            }
        }
        else if (type === 'method_definition' || type === 'function_declaration') {
            let sig = '';
            let body = null;
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child.type === 'statement_block') {
                    body = child;
                    break;
                }
            }
            if (body && !body.isNull) {
                sig = this.code.substring(startByte, body.startIndex);
            } else {
                sig = this.code.substring(startByte, endByte);
            }
            this.entities.push({
                type: type === 'method_definition' ? this.S.methodType : this.S.functionType,
                prefix: currentPrefix,
                signature: removeInlineCommentsFromSignature(sig),
                comment: '',
                startLine, endLine, startByte, endByte
            });
        }
        else if (type === 'lexical_declaration' || type === 'variable_declaration') {
            let hasFunction = false;
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child.type === 'variable_declarator') {
                    for (let j = 0; j < child.childCount; j++) {
                        const val = child.child(j);
                        if (val.type === 'arrow_function' || 
                            val.type === 'function_expression' ||
                            val.type === 'generator_function') {
                            hasFunction = true;
                            break;
                        }
                    }
                    if (hasFunction) break;
                }
            }

            if (hasFunction) {
                for (let i = 0; i < node.childCount; i++) {
                    const child = node.child(i);
                    if (child.type === 'variable_declarator') {
                        let name = '';
                        let valueNode = null;
                        for (let j = 0; j < child.childCount; j++) {
                            const subChild = child.child(j);
                            if (subChild.type === 'identifier') {
                                name = this.code.substring(subChild.startIndex, subChild.endIndex);
                            } else if (subChild.type === 'arrow_function' || 
                                       subChild.type === 'function_expression' ||
                                       subChild.type === 'generator_function') {
                                valueNode = subChild;
                            }
                        }
                        if (valueNode && !valueNode.isNull) {
                            let params = '';
                            for (let k = 0; k < valueNode.childCount; k++) {
                                const vChild = valueNode.child(k);
                                if (vChild.type === 'formal_parameters') {
                                    params = this.code.substring(vChild.startIndex, vChild.endIndex);
                                }
                            }
                            let sig = name + params;
                            if (valueNode.type === 'arrow_function') sig += ' =>';
                            this.entities.push({
                                type: currentPrefix ? this.S.methodType : this.S.functionType,
                                prefix: currentPrefix,
                                signature: removeInlineCommentsFromSignature(sig),
                                comment: '',
                                startLine: child.startPosition.row + 1,
                                endLine: child.endPosition.row + 1,
                                startByte: child.startIndex,
                                endByte: child.endIndex
                            });
                        }
                    }
                }
            } else {
                const text = this.code.substring(startByte, endByte);
                this.entities.push({
                    type: currentPrefix ? this.S.fieldType : this.S.constantType,
                    prefix: currentPrefix,
                    signature: removeInlineCommentsFromSignature(text),
                    comment: '',
                    startLine, endLine, startByte, endByte
                });
            }
        }

        // ========== Контейнеры (рекурсия) ==========
        if (['translation_unit', 'linkage_specification', 'declaration_list', 
             'field_declaration_list', 'program', 'class_body', 
             'export_statement', 'export_default_declaration'].includes(type)) {
            for (let i = 0; i < node.childCount; i++) {
                this.processNode(node.child(i), currentPrefix);
            }
        }
    }

    attachComments() {
        this.comments.sort((a, b) => a.startByte - b.startByte);

        for (const e of this.entities) {
            const topCommentTexts = [];
            let inlineComment = '';

            // 1. Верхние комментарии
            for (let i = this.comments.length - 1; i >= 0; i--) {
                const c = this.comments[i];
                if (c.endByte < e.startByte) {
                    if (e.startLine - c.endLine <= 1) {
                        topCommentTexts.push(c.text);
                    } else {
                        break;
                    }
                }
            }
            topCommentTexts.reverse();

            // 2. Инлайн-комментарий после сущности
            for (const c of this.comments) {
                if (c.startLine === e.endLine && c.startByte > e.endByte) {
                    inlineComment = c.text;
                    break;
                }
            }

            // 3. Инлайн внутри сигнатуры (для функций/методов)
            if (!inlineComment && (e.type === this.S.functionType || e.type === this.S.methodType)) {
                for (const c of this.comments) {
                    if (c.startLine === e.startLine && c.startByte > e.startByte && c.startByte < e.endByte) {
                        inlineComment = c.text;
                        break;
                    }
                }
            }

            // 4. Очистка верхних комментариев
            let cleanTop = '';
            let inBlockComment = false;
            for (const rawComment of topCommentTexts) {
                const lines = rawComment.split(/\r?\n/);
                for (let l of lines) {
                    l = trimString(l);
                    if (!l) continue;

                    let text = '';
                    let isCommentLine = false;

                    if (l.startsWith('///') || l.startsWith('//!')) {
                        text = trimString(l.slice(3));
                        isCommentLine = true;
                    } else if (l.startsWith('//')) {
                        text = trimString(l.slice(2));
                        isCommentLine = true;
                    } else if (l.includes('/*')) {
                        inBlockComment = true;
                        const startIdx = l.indexOf('/*');
                        text = l.slice(startIdx + 2);
                        if (text && (text[0] === '*' || text[0] === '!')) text = text.slice(1);
                        const endIdx = text.indexOf('*/');
                        if (endIdx !== -1) {
                            text = text.slice(0, endIdx);
                            inBlockComment = false;
                        }
                        text = trimString(text);
                        isCommentLine = true;
                    } else if (l.includes('*/')) {
                        inBlockComment = false;
                        const endIdx = l.indexOf('*/');
                        text = l.slice(0, endIdx);
                        if (text && text[0] === '*') text = text.slice(1);
                        text = trimString(text);
                        isCommentLine = true;
                    } else if (inBlockComment) {
                        text = l;
                        if (text && text[0] === '*') text = text.slice(1);
                        text = trimString(text);
                        isCommentLine = true;
                    }

                    if (isCommentLine && text) {
                        const cleaned = cleanDoxygenLine(text, this.S);
                        if (cleaned) cleanTop += cleaned + '\n';
                    }
                }
            }
            if (cleanTop.endsWith('\n')) cleanTop = cleanTop.slice(0, -1);

            // 5. Очистка инлайна
            let cleanInline = '';
            if (inlineComment)
            {
                let c = inlineComment;
                if (c.startsWith('//'))
                {
                    c = c.slice(2);
                } else if (c.startsWith('/*'))
                {
                    c = c.slice(2);
                    if (c.endsWith('*/')) c = c.slice(0, -2);
                }
                const lines = c.split(/\r?\n/);
                const processed = [];
                for (let line of lines)
                {
                    let trimmed = trimString(line);
                    if (trimmed)
                    {
                        if (trimmed.startsWith('*')) trimmed = trimString(trimmed.slice(1));
                        if (trimmed && !/^[=\-*#~_]+$/.test(trimmed)) // ФИЛЬТР: Игнорируем графические разделители
                        {
                            processed.push(trimmed);
                        }
                    }
                }
                cleanInline = processed.join('\n');
            }

            // 6. Сборка
            e.comment = '';
            if (cleanTop) e.comment += cleanTop;
            if (cleanInline) {
                if (e.comment) e.comment += '\n';
                e.comment += cleanInline;
            }
        }
    }
}

function generateMarkdown(filePath, entities, S) {
    let md = `${S.fileLabel}${filePath}\n\n`;
    
    for (const e of entities) {
        const hashes = (e.type === S.methodType || e.type === S.fieldType) ? '##' : '#';

        if (e.type === S.macroType) {
            md += `${hashes} ${e.type} ${e.signature}\n`;
        } else {
            md += `${hashes} ${e.type}: ${e.prefix}${e.signature}\n`;
        }
        
        if (e.comment) md += `${e.comment}\n`;
        
        if (e.startLine === e.endLine) {
            md += `${S.lineSingle}${e.startLine}\n\n`;
        } else {
            md += `${S.lineRange}${e.startLine} - ${e.endLine}\n\n`;
        }
    }
    return md;
}

// ==========================================
// MAIN
// ==========================================
function main() {
    const args = process.argv.slice(2);
    
    let inputPathStr = '';
    let outputPathStr = '';
    let isRussian = false;

    for (const arg of args) {
        if (arg === '-ru' || arg === '--ru') {
            isRussian = true;
        } else if (!inputPathStr) {
            inputPathStr = arg;
        } else {
            outputPathStr = arg;
        }
    }

    const S = isRussian ? STRINGS_RU : STRINGS_EN;

    if (!inputPathStr) {
        console.error(S.usage);
        process.exit(1);
    }

    if (S.langEnabled) console.log(S.langEnabled);

    const inputPath = path.resolve(inputPathStr);
    let outputPath;

    if (outputPathStr) {
        outputPath = outputPathStr;
        if (outputPath.endsWith('/') || outputPath.endsWith('\\')) {
            outputPath = path.join(outputPath, path.basename(inputPath) + '.brief.md');
        }
    } else {
        outputPath = inputPath + '.brief.md';
    }

    if (!fs.existsSync(inputPath)) {
        console.error(`${S.fileNotFound}${inputPath}`);
        process.exit(1);
    }

    const ext = path.extname(inputPath).toLowerCase();
    let lang;
    
    if (['.cpp', '.h', '.hpp', '.cc'].includes(ext)) {
        lang = Cpp;
    } else if (['.js', '.jsx', '.ts'].includes(ext)) {
        lang = JavaScript;
    } else {
        console.error(`${S.unsupportedExt}${ext}`);
        process.exit(1);
    }

    try {
        const code = readFileToUtf8String(inputPath);

        const parser = new Parser();
        parser.setLanguage(lang);
        const tree = parser.parse(code);
        const rootNode = tree.rootNode;

        const gen = new BriefGenerator(S);
        gen.code = code;
        gen.collectComments(rootNode);
        gen.processNode(rootNode, '');
        gen.attachComments();

        const md = generateMarkdown(path.basename(inputPath), gen.entities, S);
        fs.writeFileSync(outputPath, md, 'utf8');

        console.log(`${S.briefCreated}${outputPath}`);
    } catch (err) {
        console.error(`${S.error}${err.message}`);
        process.exit(1);
    }
}

main();