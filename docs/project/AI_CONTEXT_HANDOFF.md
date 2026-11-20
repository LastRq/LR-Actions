# Handoff de Contexto para IA — Identity Core Tester

## Estado actual — 2026-11-19 (repositorio Git independiente en `LastRq/LR-Actions`)

- `LR-Actions` cuenta ahora con repositorio Git propio (`main`), remoto `origin` (`https://github.com/LastRq/LR-Actions.git`), alineado sobre el commit base `beefdcb` (`README.md`) y listo para/en proceso de push a `origin/main`.
- `.gitignore` incluye `.vs/` además de `node_modules/`, `src-tauri/target/` y `.identity-test-reports/`.

## Estado previo — 2026-11-19 (`lr-actions.exe` compilado y `lib.rs` corregido)

- `src-tauri/src/lib.rs`: `locate_server_script` prioriza los scripts del repositorio (`CARGO_MANIFEST_DIR/../scripts/test-center/server.mjs`) antes que `resource_dir()`, y `stderr` extrae la línea `Error: ...` en lugar de la primera línea `file:///...`.
- Eliminado `identity-core-tester.exe` (y cerrado `node.exe` PID `12864` que mantenía `session.lock`). Recompilado `src-tauri\target\release\lr-actions.exe`.
- Validado: `cargo test` **2/2** y `npx --no-install tauri build --no-bundle` OK.

## Estado previo — 2026-11-19 (renombrado a LR-Actions)

- Aplicación renombrada a **LR-Actions** (`package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`, `gui/index.html`, `scripts/test-center/index.html`, `lr-actions.bat`).
- Validado en este cambio: `cargo test` **2/2** y `npm test` **17/17** aprobadas. Falta recompilar `npx tauri build --no-bundle` para generar `src-tauri\target\release\lr-actions.exe` (o ejecutar `lr-actions.bat`, que lo compila si no existe).

## Estado previo — 2026-11-19 (exportación automática a `.lr-actions`)

- `history.mjs` (`exportReportToProject`) y `runner.mjs` exportan automáticamente cada ejecución finalizada (aprobada, fallida o cancelada) dentro del proyecto probado en `<project>/.lr-actions/YYYY MM DD HH-MM LOG(<id>) MODE(<PERFIL>)/`, con `report-YYYY-MM-DD_HH-MM-SS.{md,json,zip}`, `console.log`, `logs/` y metadatos; `report.exportedDir` queda guardado en `report.json`.
- Validado en este cambio: `npm test` **17/17** aprobadas. `cargo test` y `tauri build` no se reejecutaron (no hubo cambios en `src-tauri/`).

## Estado previo — 2026-11-19 (P0 cerrado)

Ver [IMPLEMENTATION_PENDING.md](../IMPLEMENTATION_PENDING.md) y [TEST_REPORT.md](./TEST_REPORT.md). Se cerró P0:
- Backend modular: `scripts/test-center/{server,discovery,process,runner,history,diagnostics,report}.mjs` (`catalog.mjs` fue eliminado).
- Cierre ordenado Tauri→servidor (`--exit-on-stdin-close` + cierre de `stdin` con 20 s de gracia), validación estricta de URL loopback en `src-tauri/src/lib.rs`, lanzadores `Iniciar-Pruebas.cmd/.sh` y `Abrir-Tester-GUI.bat` actualizados.
- Correcciones P0: recuperación temprana sin `environment`, detección MSVC vía `vswhere`, decodificación CP850 en Windows, redacción en líneas >65 KB sin partir tokens, `zipReportToFile` sin límite fijo de 60 MiB en memoria, rechazo de symlinks en `download/`, y clasificación Cargo offline como `toolchain`.
- Validado: `npm test` 17/17, `cargo test` 2/2, `tauri build --no-bundle`, UI de 8 vistas en navegador y suites reales contra `identity-requiem-core`. Reportes en `%LOCALAPPDATA%/IdentityCoreTestCenter/reports/<hash>/`.

## Contexto previo (conservado)

El usuario pidió detener la implementación y documentar lo pendiente. Leer primero [IMPLEMENTATION_PENDING.md](../IMPLEMENTATION_PENDING.md) y [TEST_CENTER_AUDIT.md](../TEST_CENTER_AUDIT.md). No continuar automáticamente.

Se reemplazó el catálogo fijo por `discovery.mjs`, se extrajeron `process.mjs`, `runner.mjs`, `history.mjs`, `diagnostics.mjs`, se modificaron servidor/reportes y se escribió una interfaz con ocho vistas. `catalog.mjs` fue eliminado. `npm test` pasó 12/12 sobre fixtures controlados. No se ejecutaron tests del producto, compilación nueva ni comprobación GUI. Los lanzadores y backend Tauri todavía requieren adaptación/validación. Los reportes nuevos están fuera del producto, por defecto en LOCALAPPDATA/IdentityCoreTestCenter/reports. El resto de este handoff es contexto histórico y debe reconciliarse antes de usarlo como descripción actual.

## Contexto previo (conservado)

## Objetivo del proyecto
Herramienta local con interfaz gráfica Tauri v2 para ejecutar la batería de pruebas de Identity Core sobre cualquier directorio elegido por el usuario, sin navegador externo ni ventana de comandos, generando informes (`report.zip`, `report.md`, `report.json`, `console.log`).

## Mapa del repositorio
- `Abrir-Tester-GUI.bat`: lanzador Windows que abre el `.exe` compilado y cierra la consola al instante.
- `gui/index.html`: ventana inicial (`launcher`) que pregunta dónde hacer el testeo, valida el directorio y lanza el Centro de Pruebas.
- `src-tauri/src/main.rs` y `src-tauri/src/lib.rs`: backend Rust/Tauri v2 (`pick_directory`, `validate_project_dir`, `launch_test_center`, cierre limpio de `node` al salir).
- `src-tauri/tauri.conf.json` y `src-tauri/capabilities/default.json`: configuración de ventanas, permisos y empaquetado.
- `scripts/test-center/`: servidor HTTP/SSE local (`server.mjs`), catálogo cerrado (`catalog.mjs`), generador de informes/ZIP (`report.mjs`), UI del Centro de Pruebas (`index.html`, `app.js`, `style.css`) y tests (`tests/report.test.mjs`).
- `Iniciar-Pruebas.cmd` / `Iniciar-Pruebas.sh`: lanzadores CLI heredados (requieren estar en la raíz de Identity Core).

## Comandos comprobados
- `npm test` (`node --test scripts/test-center/tests/report.test.mjs`) → 4/4 OK.
- `cargo test --manifest-path src-tauri/Cargo.toml` → 2/2 OK.
- `npx tauri build --no-bundle` → genera `src-tauri\target\release\identity-core-tester.exe`.
- `npm run dev` (`tauri dev`) → modo desarrollo.

## Estado actual y decisiones vigentes
- Ver [PROJECT_STATE.md](./PROJECT_STATE.md), [DECISIONS.md](./DECISIONS.md) (ADR-0001) y [CHANGELOG.md](./CHANGELOG.md).
- Referencias completas: [ARCHITECTURE.md](./ARCHITECTURE.md), [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), [TECHNOLOGY_CHOICE.md](./TECHNOLOGY_CHOICE.md), [SECURITY.md](./SECURITY.md), [THREAT_MODEL.md](./THREAT_MODEL.md), [TEST_PLAN.md](./TEST_PLAN.md), [TEST_REPORT.md](./TEST_REPORT.md), [ROADMAP.md](./ROADMAP.md).

## Riesgos y próximo paso concreto
- `node` debe seguir disponible en `PATH` en el equipo donde se ejecute el `.exe`.
- Próximo paso: probar `Abrir-Tester-GUI.bat` contra una carpeta real de Identity Core y verificar visualmente la descarga de `report.zip` dentro de WebView2.
