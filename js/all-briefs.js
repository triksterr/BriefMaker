#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const scriptDir = __dirname;
const briefmakerScript = path.join(scriptDir, 'briefmaker.js');
const configName = '.briefmaker.json';

const protectedDirs = [
    'c:\\', 'c:\\windows', 'c:\\program files', 'c:\\program files (x86)', 'c:\\users',
    '/', '/bin', '/etc', '/usr', '/var', '/system', '/library'
];

function isProtectedDir(p) {
    const normalized = path.resolve(p).toLowerCase().replace(/[\\/]+$/, '');
    return protectedDirs.some(pd => normalized === pd || normalized === pd.replace(/[\\/]+$/, ''));
}

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

async function main() {
    const args = process.argv.slice(2);
    
    let cliRoot = '';
    let cliOut = '';
    let cliRu = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-out' && i + 1 < args.length) {
            cliOut = args[++i];
        } else if (args[i] === '-ru') {
            cliRu = true;
        } else if (!cliRoot) {
            cliRoot = args[i];
        }
    }

    let config = null;
    if (!cliRoot && !cliOut && !cliRu) {
        const configPaths = [
            path.join(process.cwd(), configName),
            path.join(scriptDir, configName)
        ];
        for (const cp of configPaths) {
            if (fs.existsSync(cp)) {
                console.log(`Найден файл конфигурации: ${cp}`);
                try {
                    config = JSON.parse(fs.readFileSync(cp, 'utf8'));
                } catch (e) {
                    console.error(`Ошибка парсинга конфига: ${e.message}`);
                }
                break;
            }
        }
    }

    let finalRoot = cliRoot;
    let finalOut = cliOut;
    let finalLang = cliRu ? 'ru' : 'en';

    if (config) {
        if (!finalRoot) finalRoot = config.root;
        if (!finalOut && config.outDir) finalOut = config.outDir;
        if (!cliRu && config.lang === 'ru') finalLang = 'ru';
    }

    if (!finalRoot) {
        finalRoot = process.cwd();
        const ans = await askQuestion(`Корень проекта не указан. Использовать текущую папку '${finalRoot}'? (y/n) `);
        if (ans.toLowerCase() !== 'y') {
            console.log('Отменено.');
            process.exit(1);
        }
        const saveAns = await askQuestion(`Сохранить эти настройки в '${configName}' для будущих авто-запусков? (y/n) `);
        if (saveAns.toLowerCase() === 'y') {
            const configObj = {
                root: ".",
                extensions: [".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts"],
                ignore: ["node_modules", "build", "out", "libs", ".git", ".briefs"],
                lang: finalLang,
                outDir: null
            };
            fs.writeFileSync(path.join(finalRoot, configName), JSON.stringify(configObj, null, 2));
            console.log('Конфигурация сохранена!');
        }
    }

    finalRoot = path.resolve(finalRoot);
    if (!fs.existsSync(finalRoot)) {
        console.error(`Неверный путь к корню проекта: ${finalRoot}`);
        process.exit(1);
    }

    if (isProtectedDir(finalRoot)) {
        console.error(`ЗАЩИТА: Запрещен запуск в системной директории '${finalRoot}'.`);
        process.exit(1);
    }

    let extensions = [".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts"];
    let ignoreDirs = ["node_modules", "build", "out", "libs", ".git", ".briefs", ".vs", ".vscode"];
    if (config && config.extensions) extensions = config.extensions;
    if (config && config.ignore) ignoreDirs = config.ignore;

    let isMirror = false;
    let mirrorPath = null;
    if (finalOut) {
        isMirror = true;
        mirrorPath = path.isAbsolute(finalOut) ? finalOut : path.join(finalRoot, finalOut);
        if (fs.existsSync(mirrorPath)) {
            console.log(`Режим Mirror: Полная очистка папки '${mirrorPath}'...`);
            fs.rmSync(mirrorPath, { recursive: true, force: true });
        }
        fs.mkdirSync(mirrorPath, { recursive: true });
    }

    if (!fs.existsSync(briefmakerScript)) {
        console.error(`briefmaker.js не найден по пути: '${briefmakerScript}'.`);
        process.exit(1);
    }

    console.log(`Сканирование '${finalRoot}'...`);
    
    function walkDir(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        for (const file of list) {
            const filePath = path.join(dir, file);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    if (!ignoreDirs.includes(file)) {
                        results = results.concat(walkDir(filePath));
                    }
                } else {
                    if (extensions.includes(path.extname(filePath).toLowerCase())) {
                        results.push(filePath);
                    }
                }
            } catch (e) { /* ignore permission errors */ }
        }
        return results;
    }

    const files = walkDir(finalRoot);
    let processed = 0;
    let errors = 0;

    for (const file of files) {
        const cmdArgs = [briefmakerScript, file];
        if (finalLang === 'ru') cmdArgs.push('-ru');

        if (isMirror) {
            const relDir = path.dirname(file).substring(finalRoot.length);
            const outDir = path.join(mirrorPath, relDir);
            fs.mkdirSync(outDir, { recursive: true });
            const outArg = outDir + path.sep;
            cmdArgs.push(outArg);
        }

        const result = spawnSync('node', cmdArgs, { stdio: 'ignore' });
        if (result.status === 0) processed++;
        else errors++;
    }

    console.log(`Готово! Обработано: ${processed}, Ошибок: ${errors}`);
}

main().catch(console.error);