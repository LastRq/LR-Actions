# Changelog — LR-Actions

## No publicado — 2026-11-19 — repositorio Git independiente y sincronización con `LastRq/LR-Actions`

- **Git y remoto**: inicializado repositorio Git independiente en `LR-Actions` (`main`) con remoto `origin` apuntando a `https://github.com/LastRq/LR-Actions.git`, sincronizado sobre el commit inicial remoto `beefdcb` (`README.md`) para publicación en `origin/main`.
- **`.gitignore`**: añadida exclusión `.vs/` para evitar versionar caché e índices locales de Visual Studio.

## No publicado — 2026-11-19 — corrección de arranque Tauri (`stderr` y `server.mjs`)

- **Backend Tauri (`src-tauri/src/lib.rs`)**: `locate_server_script` prioriza `CARGO_MANIFEST_DIR/../scripts/test-center/server.mjs` frente a `resource_dir()` para evitar ejecutar copias viejas en `target/release/`; el lector de `stderr` prioriza el mensaje `Error: ...` sobre la ruta `file:///...` en excepciones ESM de Node.
- **Compilación y limpieza**: eliminada instancia/binario obsoleto `identity-core-tester.exe` que retenía `session.lock` y compilado `src-tauri\target\release\lr-actions.exe` (`cargo test` **2/2**, `tauri build --no-bundle` OK).

## No publicado — 2026-11-19 — renombrado a LR-Actions

- **Identidad de la aplicación**: renombrada de `Identity Core Tester` a **LR-Actions** en `package.json`, `src-tauri/Cargo.toml` (`name = "lr-actions"`), `src-tauri/tauri.conf.json` (`productName: "LR-Actions"`, `identifier: "com.lastrq.lr-actions"`), `src-tauri/src/lib.rs`, `gui/index.html`, `scripts/test-center/index.html` y `lr-actions.bat` (`lr-actions.exe`).
- **Pruebas**: `cargo test` **2/2** y `npm test` **17/17** aprobadas tras el renombrado.

## No publicado — 2026-11-19 — exportación automática a `.lr-actions`

- **Exportación automática en el proyecto probado**: `history.mjs` añade `exportReportToProject(project, root, report)` y `runner.mjs` la invoca al finalizar cualquier ejecución (aprobada, fallida o cancelada) para exportar a `<project>/.lr-actions/"YYYY MM DD HH-MM LOG(<id>) MODE(<PERFIL>)"/` con `report-YYYY-MM-DD_HH-MM-SS.{md,json,zip}`, `console.log`, `environment.json`, `diagnostics.json`, `antigravity-prompt.md`, `manifest.json` y `logs/`. (Se usa `HH-MM` en lugar de `HH:MM` por compatibilidad con nombres de carpeta en Windows).
- **Pruebas**: `core.test.mjs` verifica la exportación automática en ejecuciones `FAILED` y `PASSED`; `npm test` **17/17** aprobadas.

## No publicado — 2026-11-19 — cierre P0 y validación real

- **Cierre ordenado Tauri → servidor**: `server.mjs` añade `--exit-on-stdin-close` y `src-tauri/src/lib.rs` cierra stdin esperando hasta 20 s antes de `taskkill`; validación de `READY_URL` por componentes loopback (`tauri::Url`).
- **Lanzadores**: `Iniciar-Pruebas.cmd` / `Iniciar-Pruebas.sh` validan Node >= 22 y pasan `--project` (argumento, `IDENTITY_CORE_PATH` o ruta por defecto); `Abrir-Tester-GUI.bat` exige `npm ci` local sin descargas implícitas.
- **Recuperación y entorno**: `history.mjs` tolera checkpoints tempranos sin `environment`; `discovery.mjs` detecta Visual Studio vía `vswhere` sin tocar `PATH`; `process.mjs` decodifica salida CP850 española en Windows y evita cortar secretos en líneas > 65 KB; `diagnostics.mjs` clasifica errores offline de Cargo como `toolchain`.
- **Reportes y seguridad**: `report.mjs` añade `zipReportToFile` (streaming por entrada sin límite fijo de 60 MiB en memoria); `server.mjs` rechaza symlinks en `download/`.
- **Pruebas y compilación**: `npm test` **17/17**; `cargo test` **2/2**; `npx --no-install tauri build --no-bundle` compilado; UI de 8 vistas validada en navegador contra `identity-requiem-core`; suites reales ejecutadas (incluyendo `rust-tests`, `desktop-build`, `npm-audit`, `audit-Cargo.lock`).

## 2026-11-19 — trabajo interrumpido (histórico)

- Añadida auditoría estática y documento `docs/IMPLEMENTATION_PENDING.md` por solicitud de detener el trabajo.
- Escrito descubrimiento dinámico, supervisor con timeout, orquestación secuencial con preflight, persistencia/recuperación/comparación y diagnóstico local; reportes fuera del producto.
- Sustituido catálogo fijo y escrita UI con ocho vistas. No validada visualmente ni empaquetada en una compilación nueva.
- Ampliados tests Node: ejecución comprobada de `npm test`, 12/12 aprobados con fixtures. No se ejecutaron suites reales de Identity Core.
- Pendientes: cierre P0, lanzadores, validación nativa, grandes logs/ZIP, exactitud de entorno, documentación técnica y pruebas del producto. Sin commits ni pushes.

## 2026-11-19

### Añadido
- Interfaz gráfica de escritorio con **Tauri v2** (`src-tauri/`, `gui/index.html`, `package.json`, `.gitignore`) compilada sin ventana de consola (`windows_subsystem = "windows"`) y lanzando Node en segundo plano con `CREATE_NO_WINDOW`.
- Ventana inicial de selección de directorio (`launcher`) con diálogo nativo (`tauri-plugin-dialog`), validación inmediata de `package.json` y `Cargo.toml`, y apertura del Centro de Pruebas en una segunda ventana nativa independiente (`test-center`).
- Script [Abrir-Tester-GUI.bat](../../Abrir-Tester-GUI.bat) para lanzar directamente `src-tauri\target\release\identity-core-tester.exe` sin dejar consola abierta (y compilarlo automáticamente si falta).
- Documentación viva inicial del repositorio en `docs/project/` (12 archivos canónicos).

### Modificado
- `scripts/test-center/server.mjs`: soporte para `--project <ruta>` (con fallback al directorio padre para compatibilidad con `Iniciar-Pruebas.cmd`/`.sh`) y emisión de `READY_URL=<url>` al iniciar el servidor.
- `scripts/test-center/index.html` y `scripts/test-center/app.js`: muestra el nombre y ruta completa (tooltip) del directorio en prueba en la barra superior.
