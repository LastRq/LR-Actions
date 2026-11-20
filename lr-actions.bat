@echo off
setlocal
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" goto :after_vc
pushd "%ProgramFiles(x86)%\Microsoft Visual Studio\Installer"
for /f "delims=" %%I in ('vswhere.exe -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath') do (
  if exist "%%I\VC\Auxiliary\Build\vcvars64.bat" call "%%I\VC\Auxiliary\Build\vcvars64.bat" >nul
)
popd
:after_vc
cd /d "%~dp0"

set "EXE=%~dp0src-tauri\target\release\lr-actions.exe"

if not exist "%EXE%" (
  echo Compilando LR-Actions por primera vez...
  if not exist node_modules\.bin\tauri.cmd (
    echo ERROR: Falta la dependencia local. Ejecuta una vez: npm ci
    pause
    exit /b 1
  )
  call npx --no-install tauri build --no-bundle
  if errorlevel 1 (
    echo.
    echo ERROR: No se pudo compilar la interfaz grafica.
    pause
    exit /b 1
  )
)

start "" "%EXE%"
exit /b 0
