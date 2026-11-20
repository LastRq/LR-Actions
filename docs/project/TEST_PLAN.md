# Plan de Pruebas — Identity Core Tester

## Estrategia

1. **Pruebas unitarias Node (`scripts/test-center/tests/report.test.mjs`)**
   - Comando: `node --test scripts/test-center/tests/report.test.mjs`
   - Verifica: perfiles cerrados sin comandos arbitrarios, redacción de secretos, estado correcto de pruebas omitidas y generación ZIP válida (CRC32).
2. **Pruebas unitarias Rust (`src-tauri/src/lib.rs`)**
   - Comando: `cargo test --manifest-path src-tauri/Cargo.toml`
   - Verifica: `extract_ready_url` (solo loopback `http://127.0.0.1:`) y `validate_project_dir_inner` (detección de carpeta, `package.json` y `Cargo.toml`).
3. **Compilación de escritorio Tauri**
   - Comando: `npm run build` (`tauri build`) o `cargo build --release --manifest-path src-tauri/Cargo.toml`
   - Verifica: empaquetado de recursos (`scripts/test-center`), ausencia de errores de compilación y generación del ejecutable Windows sin subsistema de consola.
4. **Verificación manual interactiva (GUI Windows)**
   - Abrir el ejecutable generado, comprobar que no se abre ventana CMD ni navegador, elegir una carpeta de Identity Core con el diálogo nativo, confirmar apertura de la segunda ventana `Identity Core · Centro de pruebas` y cierre limpio del proceso `node.exe` al cerrar la ventana.
