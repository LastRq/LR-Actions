# Registro de Decisiones (ADR) — Identity Core Tester

## ADR-0001: Envoltorio de escritorio Tauri v2 con selector de directorio y backend Node local oculto

- **Estado:** Aceptada
- **Fecha:** 2026-11-18
- **Contexto:** El usuario requiere ejecutar Identity Core Test Center desde una interfaz gráfica nativa sin abrir navegador externo ni ventana de comandos, seleccionando al inicio el directorio donde realizar el testeo y abriendo el Centro de Pruebas en una ventana aparte. El entorno dispone de Node.js, Rust/Cargo y el usuario solicitó usar Tauri.
- **Opciones consideradas:**
  1. Reescribir completamente `server.mjs`, `catalog.mjs` y `report.mjs` en Rust dentro de Tauri.
  2. Mantener el motor probado `scripts/test-center/server.mjs` (añadiendo `--project` y `READY_URL=`) y envolverlo en Tauri v2 (`gui/index.html` + `src-tauri/`), ejecutando Node sin consola (`CREATE_NO_WINDOW`) y abriendo el Centro de Pruebas en una segunda ventana Tauri (`WebviewUrl::External`).
- **Decisión:** Opción 2.
- **Consecuencias:**
  - Cambio mínimo y mantenible sin duplicar la lógica de catálogo, SSE ni empaquetado ZIP.
  - Conserva compatibilidad 100% con `Iniciar-Pruebas.cmd` / `Iniciar-Pruebas.sh` y los tests existentes (`report.test.mjs`).
  - Requiere que `node` esté disponible en `PATH` en tiempo de ejecución (igual que las propias pruebas npm de Identity Core).
