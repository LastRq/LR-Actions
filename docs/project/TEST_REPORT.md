# Reporte de Pruebas — LR-Actions

## Ejecución actual — 2026-11-19 (inicialización Git independiente y exclusión `.vs/`)

- Ubicación: `D:\Codespace\LastRq - Tools\LR-Actions`; Windows PowerShell.
- **VERIFICADO (`git init -b main`, `git fetch origin main`, `git reset --mixed origin/main`, `git checkout -- README.md`):** base `beefdcb Initial commit` restaurada con `README.md` limpio y remoto `origin` apuntando a `https://github.com/LastRq/LR-Actions.git`.
- **VERIFICADO (`git ls-files --others --exclude-standard`):** `.vs/`, `node_modules/` y `src-tauri/target/` excluidos de seguimiento Git.
- **NO REEJECUTADO en este turno:** `npm test`, `cargo test` y `tauri build` (sin cambios en código fuente ni configuración de compilación/pruebas).

## Ejecución previa — 2026-11-19 (corrección `lib.rs` y compilación release)

- Ubicación: `D:/Codespace/LastRq - Tools/Identity Core Tester`; Windows PowerShell.
- **PASÓ (`cargo test --manifest-path src-tauri/Cargo.toml`):** **2/2** aprobadas (`extract_ready_url_accepts_only_loopback`, `validate_project_dir_checks_required_files`).
- **PASÓ (`npx --no-install tauri build --no-bundle`):** binario generado en `src-tauri\target\release\lr-actions.exe` (34.12 s).
- **NO REEJECUTADO en este turno:** `npm test` (sin cambios en JavaScript desde el pase 17/17 anterior).

## Ejecución previa — 2026-11-19 (renombrado a LR-Actions)

- Ubicación: `D:/Codespace/LastRq - Tools/Identity Core Tester`; Windows PowerShell; comandos: `cargo test --manifest-path src-tauri/Cargo.toml` y `npm test`.
- **PASÓ (`cargo test`):** **2/2** aprobadas (`extract_ready_url_accepts_only_loopback`, `validate_project_dir_checks_required_files`).
- **PASÓ (`npm test`):** **17/17** aprobadas.
- **NO EJECUTADO en este cambio:** `npx tauri build --no-bundle` (el binario release `lr-actions.exe` se compilará al ejecutar `lr-actions.bat` o `npm run build`).

## Ejecución previa — 2026-11-19 (exportación automática a `.lr-actions`)

- Ubicación: `D:/Codespace/LastRq - Tools/Identity Core Tester`; Windows PowerShell; comando: `npm test` (`node --test scripts/test-center/tests/*.test.mjs`).
- **PASÓ (`npm test`):** **17/17** aprobadas (`core.test.mjs` verifica exportación en `<project>/.lr-actions/YYYY MM DD HH-MM LOG(<id>) MODE(<PERFIL>)/` tanto en `FAILED` como en `PASSED`, con `report-YYYY-MM-DD_HH-MM-SS.{md,json,zip}`, `console.log` y `logs/`).
- **NO EJECUTADO en este cambio:** `cargo test`, `tauri build` y ejecución GUI contra `identity-requiem-core` (no se modificó código Rust ni UI).

## Ejecución previa — 2026-11-19 (cierre P0 y validación contra producto)

- Ubicación: `D:/Codespace/LastRq - Tools/Identity Core Tester`; Windows PowerShell; Node `v26.13.0`.
- **PASÓ (`npm test`):** **17/17** aprobadas (`tests/*.test.mjs`: `core`, `report`, `recovery`, `decode`, `p0`).
- **PASÓ (`cargo test`):** **2/2** aprobadas (`extract_ready_url_accepts_only_loopback` con rechazo de `@` y subdominio falso; `validate_project_dir_checks_required_files`).
- **PASÓ (`npx --no-install tauri build --no-bundle`):** binario generado en `src-tauri\target\release\identity-core-tester.exe`; arranque y `CloseMainWindow()` verificados por proceso (`alive=True`, `closed=True`).
- **UI en navegador (subagente, servidor real contra `identity-requiem-core`):** 8 vistas sin errores JS; perfil rápido + cancelación (`CANCELED`), descargas, historial, comparación y configuración OK.
- **Ejecuciones reales contra `identity-requiem-core`:**
  - Perfil completo (`2026-11-19T23-08-57-805Z-0f9bb30d`): `FAILED` — 28 aprobadas (`npm-build`, `npm-typecheck`, `test:contracts`, `test:phase1..20`, `npm-test`, `rust-format`, `desktop-format`, `mobile-format`); `npm-lint` y `npm-format:check` fallaron en el producto; 10 bloqueadas antes de corregir `vswhere` y habilitar red.
  - Rust tras `vswhere` (`2026-11-19T23-14-26-563Z-9db53502`): `PASSED` (`rust-clippy` 1.1 s, `rust-tests` 149.3 s).
  - Desktop + auditorías con `allowNetwork=true` restaurado a `false` (`2026-11-19T23-20-03-418Z-146a4dd4`): `desktop-format/check/build` (88 s), `npm-audit` y 3 `audit-*.lock` `PASSED`; `rust-deny` `FAILED` por `RUSTSEC-2024-0370` en `Cargo.lock` del producto.
- **NO EJECUTADO:** `android-build` (sin Android SDK/NDK), interacción manual dentro de WebView2 de Tauri (descarga desde WebView2).

## Intervención anterior — 2026-11-19, detenida por el usuario (histórico)

- Ubicación: `D:/Codespace/LastRq - Tools/Identity Core Tester`; Windows PowerShell; Node `v26.13.0`. Repositorio padre en `main`, commit observado `dd9a4c4`; la carpeta del Test Center está sin seguimiento.
- **PASÓ:** `npm test` → `node --test scripts/test-center/tests/*.test.mjs`: 12 tests, 12 aprobados, 0 fallidos, 0 omitidos; duración informada 6460.3776 ms.
- Alcance: fixtures controlados de descubrimiento/fase futura; procesos Node y exit codes; timeout con hijo Windows y cancelación; redacción fragmentada/UTF-8/clave privada; diagnóstico TypeScript; recuperación; comparación; runner y concurrencia; archivos/ZIP; API loopback, origen, SSE inicial y descarga. Esto no es una ejecución de suites del producto.
- **NO EJECUTADO:** pruebas reales de Identity Core, build nuevo Tauri/instalador, cargo test actual, UI en navegador/WebView2, dispositivos Android, estrés de logs/ZIP y `project_docs.py check`.
- Trabajo detenido antes de estas validaciones; ver [IMPLEMENTATION_PENDING.md](../IMPLEMENTATION_PENDING.md) para límites y defectos pendientes. No se ejecutaron más pruebas ni compilaciones después de la solicitud de detenerse.

## Resultados históricos (conservados)

## Ejecuciones verificadas

| Fecha | Comando | Ubicación | Resultado | Observaciones |
| --- | --- | --- | --- | --- |
| 2026-11-18 | `node --test scripts/test-center/tests/report.test.mjs` | Raíz del proyecto | **PASÓ (4/4)** | Perfiles cerrados, redacción de credenciales, estados omitidos y ZIP CRC32. |
| 2026-11-18 | Smoke test `node scripts/test-center/server.mjs --no-browser --project <tmp>` + `GET /api/state` | Raíz del proyecto | **PASÓ (`200`, `quick,full`)** | Verificó detección de `READY_URL=` y ruta dinámica `--project`. |
| 2026-11-18 | `cargo test --manifest-path src-tauri/Cargo.toml` | Raíz del proyecto | **PASÓ (2/2)** | `extract_ready_url_accepts_only_loopback` y `validate_project_dir_checks_required_files`. |
| 2026-11-19 | `npx tauri build --no-bundle` | Raíz del proyecto | **PASÓ (exit 0)** | Generó `src-tauri\target\release\identity-core-tester.exe` (1m 08s). |

## Pruebas no ejecutadas

- **Prueba interactiva GUI en escritorio Windows:** **NO EJECUTADO** en este entorno automatizado (requiere interacción visual del usuario con `Abrir-Tester-GUI.bat`, selector nativo de carpetas y ejecución real contra un repositorio Identity Core).
- **Instalador NSIS completo (`npm run build`):** **NO EJECUTADO** (se compiló con `--no-bundle` para entregar el `.exe` portable de forma directa).
