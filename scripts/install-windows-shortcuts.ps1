# Creates the Desktop shortcut and the Startup shortcut (starts minimized to the tray),
# and copies the lamp saved by the web launcher (.local) into the app's data folder once.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\install-windows-shortcuts.ps1 [-Exe <path>] [-Remove]
param(
    [string]$Exe = (Join-Path (Split-Path -Parent $PSScriptRoot) 'dist\Lotus Light Studio\Lotus Light Studio.exe'),
    [switch]$Remove
)
$ErrorActionPreference = 'Stop'
$name = 'Lotus Light Studio'
# GetFolderPath follows OneDrive redirection of Desktop.
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) "$name.lnk"
$startupLink = Join-Path ([Environment]::GetFolderPath('Startup')) "$name.lnk"

if ($Remove) {
    Remove-Item -LiteralPath $desktopLink, $startupLink -ErrorAction SilentlyContinue
    Write-Host 'Shortcuts removed.'
    return
}
if (-not (Test-Path -LiteralPath $Exe)) { throw "Build the app first: $Exe not found" }

$shell = New-Object -ComObject WScript.Shell
function New-Link($path, $arguments, $description) {
    $link = $shell.CreateShortcut($path)
    $link.TargetPath = $Exe
    $link.Arguments = $arguments
    $link.WorkingDirectory = Split-Path -Parent $Exe
    $link.IconLocation = "$Exe,0"
    $link.Description = $description
    $link.Save()
    Write-Host "Created $path"
}
New-Link $desktopLink '' 'Control your Lotus lamp'
New-Link $startupLink '--minimized' 'Start Lotus Light Studio in the tray'

# One-time migration of the lamp and presets saved by the web launcher.
$dataDir = Join-Path $env:LOCALAPPDATA $name
$legacy = Join-Path (Split-Path -Parent $PSScriptRoot) '.local'
New-Item -ItemType Directory -Force $dataDir | Out-Null
foreach ($file in 'app-device.json', 'app-device.presets.json', 'app-device.settings.json') {
    $source = Join-Path $legacy $file
    $target = Join-Path $dataDir $file
    if ((Test-Path -LiteralPath $source) -and -not (Test-Path -LiteralPath $target)) {
        Copy-Item -LiteralPath $source -Destination $target
        Write-Host "Copied saved $file"
    }
}
