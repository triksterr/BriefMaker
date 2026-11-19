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
        $pNorm = $p.ToLower().TrimEnd('\', '/')
        if ($normalized -eq $pNorm) {
            return $true
        }
    }
    return $false
}

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

$finalRoot = $ProjectRoot
$finalOut = $out
$finalLang = if ($ru) { "ru" } else { "en" }

$saveNewConfig = $false

# Если есть валидный конфиг - используем его автоматически
if ($config -and $config.root) {
    # Resolve root relative to config file location
    if ($config.root -eq ".") {
        $finalRoot = Split-Path -Parent $configPath
    } else {
        $finalRoot = $config.root
    }
    
    # Apply other settings from config (CLI flags take precedence)
    if (-not $out -and $config.outDir) { $finalOut = $config.outDir }
    if (-not $ru -and $config.lang -eq "ru") { $finalLang = "ru" }
}
else {
    # Конфига нет или он поврежден - интерактивный режим
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

$extensions = @(".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts")
$ignoreDirs = @("node_modules", "build", "out", "libs", ".git", ".briefs", ".vs", ".vscode")
if ($config -and $config.extensions) { $extensions = $config.extensions }
if ($config -and $config.ignore) { $ignoreDirs = $config.ignore }

# Apply config settings (CLI flags take precedence)
if ($useConfigSettings -and $config) {
    if (-not $out -and $config.outDir) { $finalOut = $config.outDir }
    if (-not $ru -and $config.lang -eq "ru") { $finalLang = "ru" }
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

$extensions = @(".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".jsx", ".ts")
$ignoreDirs = @("node_modules", "build", "out", "libs", ".git", ".briefs", ".vs", ".vscode")
if ($useConfigSettings -and $config) {
    if ($config.extensions) { $extensions = $config.extensions }
    if ($config.ignore) { $ignoreDirs = $config.ignore }
}

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

Write-Host "Scanning '$finalRoot'..." -ForegroundColor Cyan
$files = Get-ChildItem -Path $finalRoot -File -Recurse -ErrorAction SilentlyContinue | Where-Object {
    $extMatch = $extensions -contains $_.Extension.ToLower()
    
    $isIgnored = $false
    $relativePath = $_.DirectoryName.Replace($finalRoot, '').Trim('\', '/')
    if ($relativePath) {
        # Using -split with regex for reliable cross-version PS 5.1 compatibility
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
        # Pass directory with trailing separator so BriefMaker.exe appends the filename
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
        outDir = $finalOut
    }
    $configObj | ConvertTo-Json -Depth 5 | Set-Content (Join-Path (Get-Location) $configName)
    Write-Host "Configuration saved!" -ForegroundColor Green
}

Write-Host "Done! Processed: $processed, Errors: $errors" -ForegroundColor Green