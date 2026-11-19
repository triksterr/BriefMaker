param(
    [string]$ProjectRoot,
    [string]$out,
    [switch]$ru
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exePath = Join-Path $scriptDir "BriefMaker.exe"
$configName = ".briefmaker.json"

$protectedDirs = @(
    "C:\", "C:\Windows", "C:\Program Files", "C:\Program Files (x86)", "C:\Users",
    "/", "/bin", "/etc", "/usr", "/var", "/System", "/Library"
)

function Test-ProtectedDir {
    param([string]$path)
    $normalized = ($path.TrimEnd('\', '/')).ToLower()
    if ([string]::IsNullOrEmpty($normalized)) { return $false }
    foreach ($p in $protectedDirs) {
        if ($normalized -eq $p.ToLower() -or $normalized -eq $p.ToLower().TrimEnd('\','/')) {
            return $true
        }
    }
    return $false
}

# 1. Поиск конфига (если нет аргументов)
$config = $null
if (-not $ProjectRoot -and -not $out -and -not $ru) {
    $configPaths = @(
        (Join-Path (Get-Location) $configName),
        (Join-Path $scriptDir $configName)
    )
    foreach ($cp in $configPaths) {
        if (Test-Path $cp) {
            Write-Host "Найден файл конфигурации: $cp" -ForegroundColor Cyan
            $config = Get-Content $cp -Raw | ConvertFrom-Json
            break
        }
    }
}

# 2. Определение параметров
$finalRoot = $ProjectRoot
$finalOut = $out
$finalLang = if ($ru) { "ru" } else { "en" }

if ($config) {
    if (-not $finalRoot) { $finalRoot = $config.root }
    if (-not $finalOut -and $config.outDir) { $finalOut = $config.outDir }
    if (-not $ru -and $config.lang -eq "ru") { $finalLang = "ru" }
}

# 3. Интерактив (если корень не задан и нет конфига)
if (-not $finalRoot) {
    $finalRoot = (Get-Location).Path
    $confirm = Read-Host "Корень проекта не указан. Использовать текущую папку '$finalRoot'? (y/n)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "Отменено." -ForegroundColor Red
        exit 1
    }
    $saveConfig = Read-Host "Сохранить эти настройки в '$configName' для будущих авто-запусков? (y/n)"
    if ($saveConfig -eq 'y' -or $saveConfig -eq 'Y') {
        $configObj = @{
            root = "."
            extensions = @(".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts")
            ignore = @("node_modules", "build", "out", "libs", ".git", ".briefs")
            lang = $finalLang
            outDir = $null
        }
        $configObj | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $finalRoot $configName)
        Write-Host "Конфигурация сохранена!" -ForegroundColor Green
    }
}

$finalRoot = (Resolve-Path $finalRoot -ErrorAction SilentlyContinue).Path
if (-not $finalRoot) {
    Write-Error "Неверный путь к корню проекта."
    exit 1
}

if (Test-ProtectedDir $finalRoot) {
    Write-Error "ЗАЩИТА: Запрещен запуск в системной директории '$finalRoot'."
    exit 1
}

# 4. Настройки фильтрации
$extensions = @(".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts")
$ignoreDirs = @("node_modules", "build", "out", "libs", ".git", ".briefs", ".vs", ".vscode")
if ($config -and $config.extensions) { $extensions = $config.extensions }
if ($config -and $config.ignore) { $ignoreDirs = $config.ignore }

# 5. Режим Mirror (Зеркало)
$isMirror = $false
$mirrorPath = $null
if ($finalOut) {
    $isMirror = $true
    if ([System.IO.Path]::IsPathRooted($finalOut)) {
        $mirrorPath = $finalOut
    } else {
        $mirrorPath = Join-Path $finalRoot $finalOut
    }
    
    if (Test-Path $mirrorPath) {
        Write-Host "Режим Mirror: Полная очистка папки '$mirrorPath'..." -ForegroundColor Yellow
        Remove-Item -Path $mirrorPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $mirrorPath -Force | Out-Null
}

if (-not (Test-Path $exePath)) {
    Write-Error "BriefMaker.exe не найден по пути: '$exePath'."
    exit 1
}

# 6. Сканирование и обработка
Write-Host "Сканирование '$finalRoot'..." -ForegroundColor Cyan
$files = Get-ChildItem -Path $finalRoot -File -Recurse -ErrorAction SilentlyContinue | Where-Object {
    $extMatch = $extensions -contains $_.Extension.ToLower()
    
    $isIgnored = $false
    $dirParts = $_.DirectoryName.Replace($finalRoot, '').Trim('\', '/').Split('\', '/')
    foreach ($part in $dirParts) {
        if ($ignoreDirs -contains $part) {
            $isIgnored = $true
            break
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
        $outDir = Join-Path $mirrorPath $relDir
        if (-not (Test-Path $outDir)) {
            New-Item -ItemType Directory -Path $outDir -Force | Out-Null
        }
        # Передаем папку со слэшем на конце, чтобы BriefMaker.exe сам добавил имя файла
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

Write-Host "Готово! Обработано: $processed, Ошибок: $errors" -ForegroundColor Green