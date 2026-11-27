#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const scriptDir = __dirname;
const briefmakerScript = path.join(scriptDir, 'briefmaker.js');
const configName = '.briefmaker.json';

// ==========================================
// ЛОКАЛИЗАЦИЯ
// ==========================================
const STRINGS_EN = {
    interactiveHeader: '=== BriefMaker Configuration Wizard ===',
    askRoot: 'Project root directory',
    askMode: 'Output mode',
    modeInplace: 'In-place (briefs next to source files)',
    modeMirror: 'Mirror (all briefs in a separate directory)',
    chooseMode: 'Choose',
    askOutDir: 'Mirror output directory',
    askLang: 'Language (en/ru)',
    askSaveConfig: 'Save these settings to .briefmaker.json?',
    pathNotExist: 'Path does not exist',
    pathProtected: 'System directory is not allowed',
    invalidChoice: 'Invalid choice, please enter',
    dirCreated: 'Directory created',
    cancelled: 'Cancelled.',
    scanning: 'Scanning',
    mirrorCleaning: 'Mirror mode: Cleaning directory',
    briefmakerNotFound: 'briefmaker.js not found at',
    done: 'Done! Processed',
    errors: 'Errors',
    configSaved: 'Configuration saved!',
    configFound: 'Found configuration file',
};

const STRINGS_RU = {
    interactiveHeader: '=== Мастер настройки BriefMaker ===',
    askRoot: 'Корневая папка проекта',
    askMode: 'Режим вывода',
    modeInplace: 'На месте (брифы рядом с исходниками)',
    modeMirror: 'Зеркало (все брифы в отдельной папке)',
    chooseMode: 'Выберите',
    askOutDir: 'Папка для зеркала',
    askLang: 'Язык (en/ru)',
    askSaveConfig: 'Сохранить эти настройки в .briefmaker.json?',
    pathNotExist: 'Путь не существует',
    pathProtected: 'Системная директория запрещена',
    invalidChoice: 'Неверный выбор, введите',
    dirCreated: 'Папка создана',
    cancelled: 'Отменено.',
    scanning: 'Сканирование',
    mirrorCleaning: 'Режим зеркала: очистка папки',
    briefmakerNotFound: 'briefmaker.js не найден по пути',
    done: 'Готово! Обработано',
    errors: 'Ошибок',
    configSaved: 'Конфигурация сохранена!',
    configFound: 'Найден файл конфигурации',
};

// ==========================================
// ЦВЕТА И УТИЛИТЫ
// ==========================================
const useColors = process.stdout.isTTY && !process.env.NO_COLOR;
const C = {
    cyan:   useColors ? '\x1b[36m' : '',
    green:  useColors ? '\x1b[32m' : '',
    yellow: useColors ? '\x1b[33m' : '',
    gray:   useColors ? '\x1b[90m' : '',
    bold:   useColors ? '\x1b[1m'  : '',
    reset:  useColors ? '\x1b[0m'  : '',
};

function colored(color, text) { return `${C[color]}${text}${C.reset}`; }

function isProtectedDir(p) {
    const protectedDirs = [
        'c:\\', 'c:\\windows', 'c:\\program files', 'c:\\program files (x86)', 'c:\\users',
        '/', '/bin', '/etc', '/usr', '/var', '/system', '/library'
    ];
    const normalized = path.resolve(p).toLowerCase().replace(/[\\/]+$/, '');
    return protectedDirs.some(pd => normalized === pd || normalized === pd.replace(/[\\/]+$/, ''));
}

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

function promptWithDefault(label, defaultValue) {
    if (defaultValue) {
        return `${label} ${colored('gray', '[' + defaultValue + ']')}: `;
    }
    return `${label}: `;
}

// ==========================================
// ИНТЕРАКТИВНЫЙ ДИАЛОГ
// ==========================================
async function runInteractive(config, cliRu) {
    const useRu = cliRu || (config && config.lang === 'ru');
    const L = useRu ? STRINGS_RU : STRINGS_EN;

    console.log('\n' + colored('bold', colored('cyan', L.interactiveHeader)) + '\n');

    // 1. Корневая папка
    const defaultRoot = (config && config.root && config.root !== '.') ? config.root : '.';
    let finalRoot;
    while (true) {
        const answer = (await askQuestion(promptWithDefault(L.askRoot, defaultRoot))) || defaultRoot;
        const resolved = path.resolve(answer);
        if (!fs.existsSync(resolved)) {
            console.error(colored('yellow', `  ⚠ ${L.pathNotExist}: ${resolved}`));
            continue;
        }
        if (isProtectedDir(resolved)) {
            console.error(colored('yellow', `  ⚠ ${L.pathProtected}: ${resolved}`));
            continue;
        }
        finalRoot = resolved;
        break;
    }

    // 2. Режим вывода
    const defaultMode = (config && config.outDir) ? '2' : '1';
    console.log(`\n${colored('bold', L.askMode)}:`);
    console.log(`  ${colored('cyan', '[1]')} ${L.modeInplace}`);
    console.log(`  ${colored('cyan', '[2]')} ${L.modeMirror}`);
    let mode;
    while (true) {
        const answer = (await askQuestion(promptWithDefault(L.chooseMode + ' (1/2)', defaultMode))) || defaultMode;
        if (answer === '1' || answer === '2') { mode = answer; break; }
        console.error(colored('yellow', `  ⚠ ${L.invalidChoice} 1 ${useRu ? 'или' : 'or'} 2`));
    }

    // 3. Путь для зеркала (если Mirror)
    let finalOut = null;
    if (mode === '2') {
        const defaultOut = (config && config.outDir) ? config.outDir : '.briefs';
        while (true) {
            const answer = (await askQuestion(promptWithDefault(L.askOutDir, defaultOut))) || defaultOut;
            const resolved = path.isAbsolute(answer) ? answer : path.join(finalRoot, answer);
            if (isProtectedDir(resolved)) {
                console.error(colored('yellow', `  ⚠ ${L.pathProtected}: ${resolved}`));
                continue;
            }
            finalOut = resolved;
            // Автосоздание
            if (!fs.existsSync(finalOut)) {
                fs.mkdirSync(finalOut, { recursive: true });
                console.log(colored('green', `  ✓ ${L.dirCreated}: ${finalOut}`));
            }
            break;
        }
    }

    // 4. Язык
    const defaultLang = (config && config.lang) ? config.lang : (cliRu ? 'ru' : 'en');
    let finalLang;
    while (true) {
        const answer = (await askQuestion(promptWithDefault(L.askLang, defaultLang))) || defaultLang;
        if (answer === 'en' || answer === 'ru') { finalLang = answer; break; }
        console.error(colored('yellow', `  ⚠ ${L.invalidChoice} en ${useRu ? 'или' : 'or'} ru`));
    }

    // 5. Сохранение конфига
    console.log('');
    const saveAns = (await askQuestion(`${L.askSaveConfig} ${colored('gray', '[y/n] [y]')}: `)) || 'y';
    const saveConfig = saveAns.toLowerCase() === 'y';

    return {
        root: finalRoot,
        outDir: finalOut,
        lang: finalLang,
        saveConfig,
        extensions: (config && config.extensions) ? config.extensions.map(s => s.trim()) 
                     : [".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts"],
        ignore: (config && config.ignore) ? config.ignore.map(s => s.trim())
                : ["node_modules", "build", "out", "old", "libs", ".git", ".briefs", ".vs", ".vscode"]
    };
}

// ==========================================
// MAIN
// ==========================================
async function main() {
    const args = process.argv.slice(2);

    let cliRoot = '';
    let cliOut = '';
    let cliRu = false;
    let cliInteractive = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-i' || args[i] === '--interactive') {
            cliInteractive = true;
        } else if (args[i] === '-out' && i + 1 < args.length) {
            cliOut = args[++i];
        } else if (args[i] === '-ru') {
            cliRu = true;
        } else if (!cliRoot) {
            cliRoot = args[i];
        }
    }

    // Чтение конфига (всегда)
    let config = null;
    let configPath = null;
    const configPaths = [
        path.join(process.cwd(), configName),
        path.join(scriptDir, configName)
    ];
    for (const cp of configPaths) {
        if (fs.existsSync(cp)) {
            try {
                config = JSON.parse(fs.readFileSync(cp, 'utf8'));
                configPath = cp;
                console.log(colored('cyan', `${STRINGS_EN.configFound}: ${cp}`));
                break;
            } catch (e) {
                console.error(`Error parsing config: ${e.message}`);
            }
        }
    }

    // Определение режима работы
    let finalRoot, finalOut, finalLang, saveNewConfig = false;
    let extensions = [".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts"];
    let ignoreDirs = ["node_modules", "build", "out", "old", "libs", ".git", ".briefs", ".vs", ".vscode"];

    const needsInteractive = cliInteractive || (!config && !cliRoot);

    if (needsInteractive) {
        const result = await runInteractive(config, cliRu);
        finalRoot = result.root;
        finalOut = result.outDir;
        finalLang = result.lang;
        saveNewConfig = result.saveConfig;
        extensions = result.extensions;
        ignoreDirs = result.ignore;
    } else if (config && config.root) {
        // Тихий режим с конфигом
        finalRoot = (config.root === ".") ? path.dirname(configPath) : path.resolve(config.root);
        if (!cliOut && config.outDir) {
            finalOut = path.isAbsolute(config.outDir) ? config.outDir : path.join(finalRoot, config.outDir);
        }
        finalLang = cliRu ? 'ru' : (config.lang || 'en');
        if (config.extensions) extensions = config.extensions.map(s => s.trim());
        if (config.ignore) ignoreDirs = config.ignore.map(s => s.trim());
    } else if (cliRoot) {
        // Тихий режим с root из CLI
        finalRoot = path.resolve(cliRoot);
        finalLang = cliRu ? 'ru' : 'en';
    }

    // CLI переопределения (имеют приоритет над всем)
    if (cliOut) {
        finalOut = path.isAbsolute(cliOut) ? cliOut : path.join(finalRoot, cliOut);
    }
    if (cliRu) finalLang = 'ru';

    // Финальная валидация root
    if (!fs.existsSync(finalRoot)) {
        console.error(`Invalid project root path: ${finalRoot}`);
        process.exit(1);
    }
    if (isProtectedDir(finalRoot)) {
        console.error(`PROTECTION: Running in system directory '${finalRoot}' is prohibited.`);
        process.exit(1);
    }

    // Mirror-режим: очистка (только в тихом режиме; в интерактивном папка уже создана и пуста)
    let isMirror = !!finalOut;
    if (isMirror && !needsInteractive) {
        if (fs.existsSync(finalOut)) {
            console.log(colored('yellow', `${STRINGS_EN.mirrorCleaning} '${finalOut}'...`));
            fs.rmSync(finalOut, { recursive: true, force: true });
        }
        fs.mkdirSync(finalOut, { recursive: true });
    }

    if (!fs.existsSync(briefmakerScript)) {
        console.error(`${STRINGS_EN.briefmakerNotFound}: '${briefmakerScript}'.`);
        process.exit(1);
    }

    // Сканирование
    const L = finalLang === 'ru' ? STRINGS_RU : STRINGS_EN;
    console.log(`${L.scanning} '${finalRoot}'...`);

    function walkDir(dir) {
        let results = [];
        let list;
        try { list = fs.readdirSync(dir); } catch (e) { return results; }
        for (const file of list) {
            if (ignoreDirs.includes(file)) continue;
            const filePath = path.join(dir, file);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    results = results.concat(walkDir(filePath));
                } else {
                    if (extensions.includes(path.extname(filePath).toLowerCase())) {
                        results.push(filePath);
                    }
                }
            } catch (e) { /* ignore */ }
        }
        return results;
    }

    const files = walkDir(finalRoot);
    let processed = 0, errors = 0;

    for (const file of files) {
        const cmdArgs = [briefmakerScript, file];
        if (finalLang === 'ru') cmdArgs.push('-ru');
        if (isMirror) {
            const relDir = path.dirname(file).substring(finalRoot.length);
            const outDir = path.join(finalOut, relDir);
            fs.mkdirSync(outDir, { recursive: true });
            cmdArgs.push(outDir + path.sep);
        }
        const result = spawnSync('node', cmdArgs, { stdio: 'ignore' });
        if (result.status === 0) processed++; else errors++;
    }

    // Сохранение конфига (если пользователь согласился)
    if (saveNewConfig) {
        const configObj = {
            root: path.relative(process.cwd(), finalRoot) || '.',
            extensions,
            ignore: ignoreDirs,
            lang: finalLang,
            outDir: finalOut ? path.relative(finalRoot, finalOut) || finalOut : null
        };
        fs.writeFileSync(path.join(process.cwd(), configName), JSON.stringify(configObj, null, 2));
        console.log(colored('green', L.configSaved));
    }

    console.log(colored('green', `${L.done}: ${processed}, ${L.errors}: ${errors}`));
}

main().catch(console.error);