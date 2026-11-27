param(
    [string]$ProjectRoot,
    [string]$out,
    [switch]$ru,
    [switch]$i,
    [Alias("interactive")]
    [switch]$Interactive
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exePath = Join-Path $scriptDir "BriefMaker.exe"
$configName = ".briefmaker.json"

# ==========================================
# ЛОКАЛИЗАЦИЯ
# ==========================================
$L_EN = @{
    header        = "=== BriefMaker Configuration Wizard ==="
    askRoot       = "Project root directory"
    askMode       = "Output mode"
    modeInplace   = "In-place (briefs next to source files)"
    modeMirror    = "Mirror (all briefs in a separate directory)"
    chooseMode    = "Choose (1/2)"
    askOutDir     = "Mirror output directory"
    askLang       = "Language (en/ru)"
    askSave       = "Save these settings to .briefmaker.json?"
    pathNotExist  = "Path does not exist"
    pathProtected = "System directory is not allowed"
    invalidChoice = "Invalid choice"
    dirCreated    = "Directory created"
    scanning      = "Scanning"
    mirrorClean   = "Mirror mode: Cleaning directory"
    done          = "Done! Processed"
    errors        = "Errors"
    configSaved   = "Configuration saved!"
    configFound   = "Found configuration file"
    exeNotFound   = "BriefMaker.exe not found at"
    or            = "or"
}

$L_RU = @{
    header        = "=== Мастер настройки BriefMaker ==="
    askRoot       = "Корневая папка проекта"
    askMode       = "Режим вывода"
    modeInplace   = "На месте (брифы рядом с исходниками)"
    modeMirror    = "Зеркало (все брифы в отдельной папке)"
    chooseMode    = "Выберите (1/2)"
    askOutDir     = "Папка для зеркала"
    askLang       = "Язык (en/ru)"
    askSave       = "Сохранить эти настройки в .briefmaker.json?"
    pathNotExist  = "Путь не существует"
    pathProtected = "Системная директория запрещена"
    invalidChoice = "Неверный выбор"
    dirCreated    = "Папка создана"
    scanning      = "Сканирование"
    mirrorClean   = "Режим зеркала: очистка папки"
    done          = "Готово! Обработано"
    errors        = "Ошибок"
    configSaved   = "Конфигурация сохранена!"
    configFound   = "Найден файл конфигурации"
    exeNotFound   = "BriefMaker.exe не найден по пути"
    or            = "или"
}

# ==========================================
# ЗАЩИТА
# ==========================================
$protectedDirs = @(
    "C:\", "C:\Windows", "C:\Program Files", "C:\Program Files (x86)", "C:\Users",
    "/", "/bin", "/etc", "/usr", "/var", "/System", "/Library"
)

function Test-ProtectedDir {
    param([string]$path)
    $normalized = ($path.TrimEnd('\', '/')).ToLower()
    if ([string]::IsNullOrEmpty($normalized)) { return $false }
    foreach ($p in $protectedDirs) {
        $pNorm = $p.ToLower().TrimEnd('\', '/')
        if ($normalized -eq $pNorm) { return $true }
    }
    return $false
}

# ==========================================
# ИНТЕРАКТИВНЫЙ ДИАЛОГ
# ==========================================
function Invoke-Interactive {
    param($config, [bool]$useRu)
    
    $L = if ($useRu) { $L_RU } else { $L_EN }
    
    Write-Host ""
    Write-Host $L.header -ForegroundColor Cyan
    Write-Host ""
    
    # 1. Корневая папка
    $defaultRoot = if ($config -and $config.root -and $config.root -ne ".") { $config.root } else { "." }
    while ($true) {
        $prompt = "$($L.askRoot) "
        if ($defaultRoot) { $prompt += "[$defaultRoot]" }
        $prompt += ": "
        $answer = Read-Host $prompt
        if ([string]::IsNullOrWhiteSpace($answer)) { $answer = $defaultRoot }
        $resolved = (Resolve-Path $answer -ErrorAction SilentlyContinue).Path
        if (-not $resolved -or -not (Test-Path $resolved)) {
            Write-Host "  ⚠ $($L.pathNotExist): $answer" -ForegroundColor Yellow
            continue
        }
        if (Test-ProtectedDir $resolved) {
            Write-Host "  ⚠ $($L.pathProtected): $resolved" -ForegroundColor Yellow
            continue
        }
        $finalRoot = $resolved
        break
    }
    
    # 2. Режим вывода
    $defaultMode = if ($config -and $config.outDir) { "2" } else { "1" }
    Write-Host ""
    Write-Host $L.askMode -ForegroundColor White
    Write-Host "  [1] $($L.modeInplace)" -ForegroundColor Cyan
    Write-Host "  [2] $($L.modeMirror)" -ForegroundColor Cyan
    while ($true) {
        $answer = Read-Host "$($L.chooseMode) [$defaultMode]"
        if ([string]::IsNullOrWhiteSpace($answer)) { $answer = $defaultMode }
        if ($answer -eq "1" -or $answer -eq "2") { $mode = $answer; break }
        Write-Host "  ⚠ $($L.invalidChoice)" -ForegroundColor Yellow
    }
    
    # 3. Путь для зеркала
    $finalOut = $null
    if ($mode -eq "2") {
        $defaultOut = if ($config -and $config.outDir) { $config.outDir } else { ".briefs" }
        while ($true) {
            $answer = Read-Host "$($L.askOutDir) [$defaultOut]"
            if ([string]::IsNullOrWhiteSpace($answer)) { $answer = $defaultOut }
            if ([System.IO.Path]::IsPathRooted($answer)) {
                $resolved = $answer
            } else {
                $resolved = Join-Path $finalRoot $answer
            }
            if (Test-ProtectedDir $resolved) {
                Write-Host "  ⚠ $($L.pathProtected): $resolved" -ForegroundColor Yellow
                continue
            }
            $finalOut = $resolved
            if (-not (Test-Path $finalOut)) {
                New-Item -ItemType Directory -Path $finalOut -Force | Out-Null
                Write-Host "  ✓ $($L.dirCreated): $finalOut" -ForegroundColor Green
            }
            break
        }
    }
    
    # 4. Язык
    $defaultLang = if ($config -and $config.lang) { $config.lang } elseif ($useRu) { "ru" } else { "en" }
    while ($true) {
        $answer = Read-Host "$($L.askLang) [$defaultLang]"
        if ([string]::IsNullOrWhiteSpace($answer)) { $answer = $defaultLang }
        if ($answer -eq "en" -or $answer -eq "ru") { $finalLang = $answer; break }
        Write-Host "  ⚠ $($L.invalidChoice)" -ForegroundColor Yellow
    }
    
    # 5. Сохранение конфига
    Write-Host ""
    $saveAns = Read-Host "$($L.askSave) [y/n] [y]"
    if ([string]::IsNullOrWhiteSpace($saveAns)) { $saveAns = "y" }
    $saveConfig = ($saveAns.ToLower() -eq "y")
    
    return @{
        root = $finalRoot
        outDir = $finalOut
        lang = $finalLang
        saveConfig = $saveConfig
        extensions = if ($config -and $config.extensions) { $config.extensions | ForEach-Object { $_.Trim() } } 
                     else { @(".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts") }
        ignore = if ($config -and $config.ignore) { $config.ignore | ForEach-Object { $_.Trim() } }
                 else { @("node_modules", "build", "out", "old", "libs", ".git", ".briefs", ".vs", ".vscode") }
    }
}

# ==========================================
# MAIN
# ==========================================

# Флаг -i
$isInteractiveFlag = $i.IsPresent -or $Interactive.IsPresent

# Чтение конфига (всегда)
$config = $null
$configPath = $null
$configPaths = @(
    (Join-Path (Get-Location) $configName),
    (Join-Path $scriptDir $configName)
)
foreach ($cp in $configPaths) {
    if (Test-Path $cp) {
        Write-Host "$($L_EN.configFound): $cp" -ForegroundColor Cyan
        $config = Get-Content $cp -Raw | ConvertFrom-Json
        $configPath = $cp
        break
    }
}

# Определение режима
$finalRoot = $ProjectRoot
$finalOut = $out
$finalLang = if ($ru) { "ru" } else { "en" }
$saveNewConfig = $false
$extensions = @(".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts")
$ignoreDirs = @("node_modules", "build", "out", "old", "libs", ".git", ".briefs", ".vs", ".vscode")

$needsInteractive = $isInteractiveFlag -or (-not $config -and -not $ProjectRoot)

if ($needsInteractive) {
    $useRu = $ru.IsPresent -or ($config -and $config.lang -eq "ru")
    $result = Invoke-Interactive -config $config -useRu $useRu
    $finalRoot = $result.root
    $finalOut = $result.outDir
    $finalLang = $result.lang
    $saveNewConfig = $result.saveConfig
    $extensions = $result.extensions
    $ignoreDirs = $result.ignore
}
elseif ($config -and $config.root) {
    # Тихий режим с конфигом
    if ($config.root -eq ".") {
        $finalRoot = Split-Path -Parent $configPath
    } else {
        $finalRoot = (Resolve-Path $config.root -ErrorAction SilentlyContinue).Path
    }
    if (-not $out -and $config.outDir) {
        if ([System.IO.Path]::IsPathRooted($config.outDir)) {
            $finalOut = $config.outDir
        } else {
            $finalOut = Join-Path $finalRoot $config.outDir
        }
    }
    if (-not $ru -and $config.lang -eq "ru") { $finalLang = "ru" }
    if ($config.extensions) { $extensions = $config.extensions | ForEach-Object { $_.Trim() } }
    if ($config.ignore) { $ignoreDirs = $config.ignore | ForEach-Object { $_.Trim() } }
}
elseif ($ProjectRoot) {
    # Тихий режим с root из CLI
    $finalRoot = (Resolve-Path $ProjectRoot -ErrorAction SilentlyContinue).Path
}

# CLI-переопределения (приоритет)
if ($out) {
    if ([System.IO.Path]::IsPathRooted($out)) {
        $finalOut = $out
    } else {
        $finalOut = Join-Path $finalRoot $out
    }
}
if ($ru) { $finalLang = "ru" }

# Финальная валидация
if (-not $finalRoot -or -not (Test-Path $finalRoot)) {
    Write-Error "Invalid project root path."
    exit 1
}
if (Test-ProtectedDir $finalRoot) {
    Write-Error "PROTECTION: Running in system directory '$finalRoot' is prohibited."
    exit 1
}

# Mirror-режим: очистка (только в тихом режиме)
$isMirror = $false
if ($finalOut) {
    $isMirror = $true
    if (-not $needsInteractive -and (Test-Path $finalOut)) {
        $L = if ($finalLang -eq "ru") { $L_RU } else { $L_EN }
        Write-Host "$($L.mirrorClean) '$finalOut'..." -ForegroundColor Yellow
        Remove-Item -Path $finalOut -Recurse -Force
        New-Item -ItemType Directory -Path $finalOut -Force | Out-Null
    }
}

if (-not (Test-Path $exePath)) {
    Write-Error "$($L_EN.exeNotFound): '$exePath'."
    exit 1
}

# Сканирование
$L = if ($finalLang -eq "ru") { $L_RU } else { $L_EN }
Write-Host "$($L.scanning) '$finalRoot'..." -ForegroundColor Cyan

$files = Get-ChildItem -Path $finalRoot -File -Recurse -ErrorAction SilentlyContinue | Where-Object {
    $extMatch = $extensions -contains $_.Extension.ToLower()
    $isIgnored = $false
    $relativePath = $_.DirectoryName.Replace($finalRoot, '').Trim('\', '/')
    if ($relativePath) {
        $dirParts = $relativePath -split '[\\/]'
        foreach ($part in $dirParts) {
            if ($ignoreDirs -contains $part) {
                $isIgnored = $true
                break
            }
        }
    }
    $extMatch -and (-not $isIgnored)
}

$processed = 0
$errors = 0

foreach ($file in $files) {
    $inputFile = $file.FullName
    if ($isMirror) {
        $relDir = $file.DirectoryName.Substring($finalRoot.Length).TrimStart('\', '/')
        $outDir = Join-Path $finalOut $relDir
        if (-not (Test-Path $outDir)) {
            New-Item -ItemType Directory -Path $outDir -Force | Out-Null
        }
        $outArg = $outDir + [System.IO.Path]::DirectorySeparatorChar
        $argsList = @($inputFile, $outArg)
        if ($finalLang -eq "ru") { $argsList += "-ru" }
        & $exePath @argsList | Out-Null
    } else {
        $argsList = @($inputFile)
        if ($finalLang -eq "ru") { $argsList += "-ru" }
        & $exePath @argsList | Out-Null
    }
    if ($LASTEXITCODE -eq 0) { $processed++ } else { $errors++ }
}

# Сохранение конфига
if ($saveNewConfig) {
    $relRoot = if ($finalRoot -eq (Get-Location).Path) { "." } else { $finalRoot }
    $relOut = if ($finalOut) {
        $rel = $finalOut.Substring($finalRoot.Length).TrimStart('\', '/')
        if ([string]::IsNullOrEmpty($rel)) { $finalOut } else { $rel }
    } else { $null }
    $configObj = @{
        root = $relRoot
        extensions = $extensions
        ignore = $ignoreDirs
        lang = $finalLang
        outDir = $relOut
    }
    $configObj | ConvertTo-Json -Depth 5 | Set-Content (Join-Path (Get-Location) $configName) -Encoding UTF8
    Write-Host $L.configSaved -ForegroundColor Green
}

Write-Host "$($L.done): $processed, $($L.errors): $errors" -ForegroundColor Green