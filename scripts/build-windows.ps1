# Builds the native Windows app (dist\Lotus Light Studio\Lotus Light Studio.exe)
# and creates the Desktop and Startup shortcuts.
# Usage (from the repo root):  powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1 [-NoShortcuts]
param([switch]$NoShortcuts)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$venvPy = Join-Path $root '.venv-build\Scripts\python.exe'
if (-not (Test-Path $venvPy)) {
    if (Get-Command py -ErrorAction SilentlyContinue) { & py -3 -m venv .venv-build }
    elseif (Get-Command python -ErrorAction SilentlyContinue) { & python -m venv .venv-build }
    else { throw 'Python 3.11+ was not found. Install it from https://www.python.org/downloads/' }
    if ($LASTEXITCODE) { throw 'Could not create .venv-build' }
}

Write-Host '== Installing pinned build dependencies'
& $venvPy -m pip install --disable-pip-version-check --require-hashes -r requirements-desktop-windows.lock
if ($LASTEXITCODE) { throw 'Dependency install failed' }

Write-Host '== Drawing the app icon'
New-Item -ItemType Directory -Force build | Out-Null
& $venvPy -c "from lotus_lamp.desktop import make_icon; make_icon(256).save('build/lotus.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])"
if ($LASTEXITCODE) { throw 'Icon generation failed' }

Write-Host '== Running PyInstaller'
& $venvPy -m PyInstaller --noconfirm --clean --windowed `
    --name 'Lotus Light Studio' `
    --icon build\lotus.ico `
    --add-data 'lotus_lamp\web;lotus_lamp\web' `
    --add-data 'lotus_lamp\data;lotus_lamp\data' `
    --collect-submodules bleak `
    --collect-submodules winrt `
    --collect-submodules lotus_lamp `
    scripts\desktop_entry.py
if ($LASTEXITCODE) { throw 'PyInstaller failed' }

$exe = Join-Path $root 'dist\Lotus Light Studio\Lotus Light Studio.exe'
Write-Host "== Built $exe"

if (-not $NoShortcuts) {
    & (Join-Path $PSScriptRoot 'install-windows-shortcuts.ps1') -Exe $exe
}
