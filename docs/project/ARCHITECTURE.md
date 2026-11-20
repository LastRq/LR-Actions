# Arquitectura — Identity Core Tester

## Componentes principales

1. **Launcher de escritorio (Tauri v2)** — `src-tauri/` + `gui/index.html`
   - Compilado con `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` para no abrir consola en Windows.
   - Abre la ventana `launcher` (`580x440`) para elegir el directorio del proyecto Identity Core mediante diálogo nativo (`tauri-plugin-dialog`) y validar `package.json` + `Cargo.toml`.
   - Expone comandos IPC: `validate_project_dir`, `pick_directory`, `launch_test_center`.
2. **Backend local de pruebas (Node.js ESM)** — `scripts/test-center/`
   - `server.mjs`: servidor HTTP/SSE en `127.0.0.1` con token de sesión aleatorio por ejecución; acepta `--no-browser` y `--project <ruta>`, emite `READY_URL=<url>` por stdout.
   - `catalog.mjs`: catálogo cerrado de comandos permitidos y perfiles (`quick`, `full`).
   - `report.mjs`: redacción de secretos, generación de `report.md`, `report.json` y `report.zip` sin dependencias externas.
   - `index.html`, `app.js`, `style.css`: interfaz del Centro de Pruebas cargada en la ventana independiente `test-center` (`1260x840`) creada por Tauri.
3. **Lanzadores CLI heredados** — `Iniciar-Pruebas.cmd`, `Iniciar-Pruebas.sh`
   - Conservados para compatibilidad hacia atrás.

## Flujo de ejecución

1. Usuario abre `Identity Core Tester` (binario Tauri).
2. Ventana `launcher` solicita directorio de testeo y valida `package.json` + `Cargo.toml`.
3. `launch_test_center` lanza `node scripts/test-center/server.mjs --no-browser --project <dir>` con `CREATE_NO_WINDOW` en Windows.
4. Rust lee `READY_URL=http://127.0.0.1:<puerto>/<token>/`, drena stdout/stderr en hilos secundarios, abre la ventana nativa `test-center` apuntando a esa URL y cierra `launcher`.
5. Al cerrar `test-center` (`RunEvent::Exit`), Rust termina el árbol de procesos de `node` (`taskkill /PID <pid> /T /F` oculto en Windows).
