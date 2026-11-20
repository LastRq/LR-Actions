# Elección Tecnológica — Identity Core Tester

- **Shell de escritorio:** Tauri v2 (`tauri = "2"`, `tauri-plugin-dialog = "2"`, `@tauri-apps/cli ^2.5.0`).
- **Frontend del launcher:** HTML/CSS/JS estático puro en `gui/index.html` (sin bundler ni frameworks adicionales).
- **Motor de pruebas:** Node.js ESM (`scripts/test-center/server.mjs`, `catalog.mjs`, `report.mjs`), cero dependencias runtime de npm.
- **Herramientas verificadas en este entorno:**
  - Node.js `v26.13.0` / npm `11.20.0`
  - Rust `rustc 1.100.0` / `cargo 1.100.0`
  - Git `2.56.0.windows.4`
  - Python `3.15.2` (solo utilidades auxiliares/documentación)
