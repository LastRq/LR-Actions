@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Identity Core - Test Center
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Node.js no esta instalado o no esta en PATH.
  echo Instala Node.js 22 LTS o superior desde https://nodejs.org/
  echo Luego vuelve a abrir este archivo.
  echo.
  pause
  exit /b 1
)
for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODEMAJOR=%%v
if %NODEMAJOR% LSS 22 (
  echo ERROR: Se requiere Node.js 22 o superior. Detectado: %NODEMAJOR%
  pause
  exit /b 1
)
set "PROJ=%~1"
if "%PROJ%"=="" set "PROJ=%IDENTITY_CORE_PATH%"
if "%PROJ%"=="" set "PROJ=D:\Codespace\LastRq Systems\identity-requiem-core"
if not exist "%PROJ%\package.json" (
  echo ERROR: No se encontro Identity Core en "%PROJ%".
  echo Pasa la ruta como argumento o define IDENTITY_CORE_PATH.
  pause
  exit /b 1
)
echo.
echo  IDENTITY CORE - CENTRO DE PRUEBAS
 echo  Se abrira una ventana del navegador con el programa.
echo  No cierres esta consola durante la ejecucion.
echo.
node "%~dp0scripts\test-center\server.mjs" --project "%PROJ%"
if errorlevel 1 (
  echo.
  echo El programa termino con error. Revisa el mensaje anterior.
  pause
)
