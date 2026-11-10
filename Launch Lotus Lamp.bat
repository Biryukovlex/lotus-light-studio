@echo off
setlocal EnableExtensions
rem Lotus Light Studio launcher for Windows. Double-click to start the web app.
cd /d "%~dp0"
set "UV_CACHE_DIR=%CD%\.local\uv-cache"
set "VENV_PY=.venv\Scripts\python.exe"
set "LOCK=requirements-app-windows.lock"

set "LAMP_UV="
where uv >nul 2>nul && set "LAMP_UV=uv"
if not defined LAMP_UV if exist "%USERPROFILE%\.local\bin\uv.exe" set "LAMP_UV=%USERPROFILE%\.local\bin\uv.exe"
if not defined LAMP_UV goto :use_pip

rem --- uv ---
if not exist "%VENV_PY%" "%LAMP_UV%" venv --python 3.11 .venv
if errorlevel 1 goto :failed
"%LAMP_UV%" pip install --python "%VENV_PY%" --require-hashes -r "%LOCK%"
if errorlevel 1 goto :failed
goto :run

rem --- system Python + pip ---
:use_pip
if exist "%VENV_PY%" goto :pip_install
set "SYS_PY="
where py >nul 2>nul && set "SYS_PY=py -3"
if not defined SYS_PY where python >nul 2>nul && set "SYS_PY=python"
if not defined SYS_PY (
    echo Python 3.11+ was not found. Install it from https://www.python.org/downloads/ or install uv, then launch again.
    goto :failed
)
%SYS_PY% -c "import sys; assert sys.version_info >= (3,11), 'Install Python 3.11 or later, or uv, then launch again.'"
if errorlevel 1 goto :failed
%SYS_PY% -m venv .venv
if errorlevel 1 goto :failed

:pip_install
"%VENV_PY%" -m pip install --disable-pip-version-check --require-hashes -r "%LOCK%"
if errorlevel 1 goto :failed

:run
"%VENV_PY%" -m lotus_lamp.app %*
echo.
echo The app stopped. Review the message above.
pause
exit /b 0

:failed
echo.
echo Setup failed. Review the message above.
pause
exit /b 1
