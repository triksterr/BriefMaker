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

# 1. ВСЕГДА ищем конфиг (независимо от аргументов CLI)
$config = $null
$configPath = $null
$configPaths = @(
    (Join-Path (Get-Location) $configName),
    (Join-Path $scriptDir $configName)
)
foreach ($cp in $configPaths) {
    if (Test-Path $cp) {
        Write-Host "Found configuration file: $cp" -ForegroundColor Cyan
        $config = Get-Content $cp -Raw | ConvertFrom-Json
        $configPath = $cp
        break
    }
}

# 2. Определение параметров (CLI имеет приоритет над конфигом)
$finalRoot = $ProjectRoot
$finalOut = $out
$finalLang = if ($ru) { "ru" } else { "en" }
$saveNewConfig = $false

if ($config -and $config.root) {
    # Есть валидный конфиг - используем его (CLI переопределяет)
    if (-not $finalRoot) {
        if ($config.root -eq ".") {
            $finalRoot = Split-Path -Parent $configPath
        } else {
            $finalRoot = $config.root
        }
    }
    if (-not $out -and $config.outDir) { $finalOut = $config.outDir }
    if (-not $ru -and $config.lang -eq "ru") { $finalLang = "ru" }
} else {
    # Конфига нет - интерактивный режим (только если не передан root явно)
    if (-not $finalRoot) {
        $finalRoot = (Get-Location).Path
        $confirm = Read-Host "Project root not specified. Use current directory '$finalRoot'? (y/n)"
        if ($confirm -ne 'y' -and $confirm -ne 'Y') {
            Write-Host "Cancelled." -ForegroundColor Red
            exit 1
        }
        $saveAns = Read-Host "Save these settings to '$configName'? (y/n)"
        if ($saveAns -eq 'y' -or $saveAns -eq 'Y') { $saveNewConfig = $true }
    }
}

$finalRoot = (Resolve-Path $finalRoot -ErrorAction SilentlyContinue).Path
if (-not $finalRoot) {
    Write-Error "Invalid project root path."
    exit 1
}

if (Test-ProtectedDir $finalRoot) {
    Write-Error "PROTECTION: Running in system directory '$finalRoot' is prohibited."
    exit 1
}

# 3. Настройки фильтрации (ВСЕГДА применяем из конфига, если есть)
$extensions = @(".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts")
$ignoreDirs = @("node_modules", "build", "out", "libs", ".git", ".briefs", ".vs", ".vscode")
if ($config -and $config.extensions) { 
    $extensions = $config.extensions | ForEach-Object { $_.Trim() }
}
if ($config -and $config.ignore) { 
    $ignoreDirs = $config.ignore | ForEach-Object { $_.Trim() }
}

# Отладочный вывод (можно убрать)
Write-Host "Ignore dirs: [$($ignoreDirs -join ', ')]" -ForegroundColor DarkGray
Write-Host "Extensions: [$($extensions -join ', ')]" -ForegroundColor DarkGray

# 4. Режим Mirror (Зеркало)
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
        Write-Host "Mirror mode: Cleaning directory '$mirrorPath'..." -ForegroundColor Yellow
        Remove-Item -Path $mirrorPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $mirrorPath -Force | Out-Null
}

if (-not (Test-Path $exePath)) {
    Write-Error "BriefMaker.exe not found at: '$exePath'."
    exit 1
}

# 5. Сканирование и обработка
Write-Host "Scanning '$finalRoot'..." -ForegroundColor Cyan
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
        $outDir = Join-Path $mirrorPath $relDir
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

if ($saveNewConfig) {
    $configObj = @{
        root = "."
        extensions = $extensions
        ignore = $ignoreDirs
        lang = $finalLang
        outDir = $null
    }
    $configObj | ConvertTo-Json -Depth 5 | Set-Content (Join-Path (Get-Location) $configName)
    Write-Host "Configuration saved!" -ForegroundColor Green
}

Write-Host "Done! Processed: $processed, Errors: $errors" -ForegroundColor Green