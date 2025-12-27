# PowerShell script to install electron-acrylic-window with proper SDK detection

Write-Host "Installing electron-acrylic-window with Windows SDK detection..." -ForegroundColor Cyan

# Try to find Windows SDK
$sdkPath = $null
$sdkVersion = $null

$sdkBasePath = "C:\Program Files (x86)\Windows Kits\10\Include"
if (Test-Path $sdkBasePath) {
    $versions = Get-ChildItem -Path $sdkBasePath -Directory | Sort-Object Name -Descending
    if ($versions.Count -gt 0) {
        $sdkVersion = $versions[0].Name
        $sdkPath = "C:\Program Files (x86)\Windows Kits\10"
        Write-Host "Found Windows SDK at: $sdkPath" -ForegroundColor Green
        Write-Host "SDK Version: $sdkVersion" -ForegroundColor Green
        $env:WINDOWSSDKDIR = $sdkPath
    }
}

# Try to find Visual Studio
$vsPaths = @(
    "C:\Program Files\Microsoft Visual Studio\2022\Community\VC",
    "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC",
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC"
)

$vcPath = $null
foreach ($path in $vsPaths) {
    if (Test-Path "$path\Auxiliary\Build") {
        $vcPath = $path
        Write-Host "Found Visual Studio at: $vcPath" -ForegroundColor Green
        $env:VCINSTALLDIR = $vcPath
        break
    }
}

# Set npm config
npm config set msvs_version 2022
Write-Host "Set msvs_version to 2022" -ForegroundColor Yellow

Write-Host ""
Write-Host "Installing electron-acrylic-window..." -ForegroundColor Cyan
npm install electron-acrylic-window --save

if ($LASTEXITCODE -eq 0) {
    Write-Host "Installation successful!" -ForegroundColor Green
} else {
    Write-Host "Installation failed. Try running as Administrator or check SDK installation." -ForegroundColor Red
}


