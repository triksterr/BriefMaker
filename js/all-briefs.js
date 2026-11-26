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

function isProtectedDir(p)
{
    const normalized = path.resolve(p).toLowerCase().replace(/[\\/]+$/, '');
    return protectedDirs.some(pd => normalized === pd || normalized === pd.replace(/[\\/]+$/, ''));
}

function askQuestion(query)
{
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

async function main()
{
    const args = process.argv.slice(2);

    let cliRoot = '';
    let cliOut = '';
    let cliRu = false;

    for (let i = 0; i < args.length; i++)
    {
        if (args[i] === '-out' && i + 1 < args.length)
        {
            cliOut = args[++i];
        } else if (args[i] === '-ru')
        {
            cliRu = true;
        } else if (!cliRoot)
        {
            cliRoot = args[i];
        }
    }

    // 1. ВСЕГДА ищем конфиг (независимо от CLI-аргументов)
    let config = null;
    let configPath = null;
    const configPaths = [
        path.join(process.cwd(), configName),
        path.join(scriptDir, configName)
    ];
    for (const cp of configPaths)
    {
        if (fs.existsSync(cp))
        {
            try
            {
                config = JSON.parse(fs.readFileSync(cp, 'utf8'));
                configPath = cp;
                console.log(`Found configuration file: ${cp}`);
                break;
            } catch (e)
            {
                console.error(`Error parsing config: ${e.message}`);
            }
        }
    }

    // 2. Определение параметров (CLI имеет приоритет над конфигом)
    let finalRoot = cliRoot;
    let finalOut = cliOut;
    let finalLang = cliRu ? 'ru' : 'en';
    let saveNewConfig = false;

    if (config && config.root)
    {
        // Есть валидный конфиг - используем его (CLI переопределяет)
        if (!finalRoot)
        {
            finalRoot = (config.root === ".") ? path.dirname(configPath) : config.root;
        }
        if (!cliOut && config.outDir) finalOut = config.outDir;
        if (!cliRu && config.lang === 'ru') finalLang = 'ru';
    } else
    {
        // Конфига нет - интерактивный режим (только если не передан root явно)
        if (!finalRoot)
        {
            finalRoot = process.cwd();
            const confirm = await askQuestion(`Project root not specified. Use current directory '${finalRoot}'? (y/n) `);
            if (confirm.toLowerCase() !== 'y')
            {
                console.log('Cancelled.');
                process.exit(1);
            }
            const saveAns = await askQuestion(`Save these settings to '${configName}'? (y/n) `);
            if (saveAns.toLowerCase() === 'y') saveNewConfig = true;
        }
    }

    finalRoot = path.resolve(finalRoot);
    if (!fs.existsSync(finalRoot))
    {
        console.error(`Invalid project root path: ${finalRoot}`);
        process.exit(1);
    }

    if (isProtectedDir(finalRoot))
    {
        console.error(`PROTECTION: Running in system directory '${finalRoot}' is prohibited.`);
        process.exit(1);
    }

    // 3. Настройки фильтрации (ВСЕГДА применяем из конфига, если есть)
    let extensions = [".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts"];
    let ignoreDirs = ["node_modules", "build", "out", "libs", ".git", ".briefs", ".vs", ".vscode"];
    if (config && config.extensions)
    {
        extensions = config.extensions.map(s => s.trim());
    }
    if (config && config.ignore)
    {
        ignoreDirs = config.ignore.map(s => s.trim());
    }

    // Отладочный вывод (можно убрать)
    console.log(`Ignore dirs: [${ignoreDirs.join(', ')}]`);
    console.log(`Extensions: [${extensions.join(', ')}]`);

    // 4. Режим Mirror (Зеркало)
    let isMirror = false;
    let mirrorPath = null;
    if (finalOut)
    {
        isMirror = true;
        mirrorPath = path.isAbsolute(finalOut) ? finalOut : path.join(finalRoot, finalOut);
        if (fs.existsSync(mirrorPath))
        {
            console.log(`Mirror mode: Cleaning directory '${mirrorPath}'...`);
            fs.rmSync(mirrorPath, { recursive: true, force: true });
        }
        fs.mkdirSync(mirrorPath, { recursive: true });
    }

    if (!fs.existsSync(briefmakerScript))
    {
        console.error(`briefmaker.js not found at: '${briefmakerScript}'.`);
        process.exit(1);
    }

    // 5. Сканирование
    console.log(`Scanning '${finalRoot}'...`);

    function walkDir(dir)
    {
        let results = [];
        let list;
        try
        {
            list = fs.readdirSync(dir);
        } catch (e)
        {
            return results;
        }
        for (const file of list)
        {
            // Skip ignored directories early for performance
            if (ignoreDirs.includes(file)) continue;
            const filePath = path.join(dir, file);
            try
            {
                const stat = fs.statSync(filePath);
                if (stat.isDirectory())
                {
                    results = results.concat(walkDir(filePath));
                } else
                {
                    if (extensions.includes(path.extname(filePath).toLowerCase()))
                    {
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

    for (const file of files)
    {
        const cmdArgs = [briefmakerScript, file];
        if (finalLang === 'ru') cmdArgs.push('-ru');

        if (isMirror)
        {
            const relDir = path.dirname(file).substring(finalRoot.length);
            const outDir = path.join(mirrorPath, relDir);
            fs.mkdirSync(outDir, { recursive: true });
            // Pass directory with trailing separator so briefmaker.js appends the filename
            const outArg = outDir + path.sep;
            cmdArgs.push(outArg);
        }

        const result = spawnSync('node', cmdArgs, { stdio: 'ignore' });
        if (result.status === 0) processed++;
        else errors++;
    }

    // 6. Сохранение конфига (только если мы его создавали через интерактив)
    if (saveNewConfig)
    {
        const configObj = {
            root: ".",
            extensions: extensions,
            ignore: ignoreDirs,
            lang: finalLang,
            outDir: finalOut || null
        };
        fs.writeFileSync(path.join(process.cwd(), configName), JSON.stringify(configObj, null, 2));
        console.log('Configuration saved!');
    }

    console.log(`Done! Processed: ${processed}, Errors: ${errors}`);
}

main().catch(console.error);