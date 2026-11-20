# Estado del Proyecto — LR-Actions

## Estado vigente — 2026-11-19 (repositorio Git independiente enlazado a `LastRq/LR-Actions`)

- **Repositorio Git:** Inicializado localmente como repositorio independiente (`main`), sincronizado sobre el commit inicial remoto `beefdcb` (`README.md`) y configurado para `origin` (`https://github.com/LastRq/LR-Actions.git`) para su publicación en `origin/main`.
- **Higiene Git:** `.gitignore` actualizado con `.vs/` además de `node_modules/`, `src-tauri/target/` y `.identity-test-reports/`.
- **Estado técnico vigente:** Funcional bajo el nombre **LR-Actions** (`com.lastrq.lr-actions`, binario compilado `src-tauri\target\release\lr-actions.exe`). Exporta automáticamente cada ejecución finalizada a `<project>/.lr-actions/YYYY MM DD HH-MM LOG(<id>) MODE(<PERFIL>)/`.

## Registro anterior — 2026-11-19 (binario `lr-actions.exe` compilado y `stderr`/`locate_server_script` corregidos)

- **Estado general:** Funcional bajo el nombre **LR-Actions** (`com.lastrq.lr-actions`, binario compilado `src-tauri\target\release\lr-actions.exe`). Exporta automáticamente cada ejecución finalizada a `<project>/.lr-actions/YYYY MM DD HH-MM LOG(<id>) MODE(<PERFIL>)/`.
- **Pruebas propias:** `cargo test` **2/2** aprobadas; `npx --no-install tauri build --no-bundle` compilado sin errores; `npm test` **17/17** aprobadas en la verificación previa sobre los scripts JS (sin cambios en JS desde entonces).
- **Validación contra `identity-requiem-core`:** UI de 8 vistas verificada en navegador (0 errores JS), perfil rápido/cancelación, perfil completo (28 aprobadas; `npm-lint` y `npm-format:check` fallaron en el producto; 10 bloqueadas por red/entorno), `rust-clippy` y `rust-tests` aprobados tras detector MSVC `vswhere`, `desktop-format/check/build`, `npm-audit` y `audit-*.lock` aprobados; `rust-deny` falló por `RUSTSEC-2024-0370` (`proc-macro-error`) en el producto.
- **Limitaciones conocidas:** `android-build` bloqueado sin Android SDK/NDK; el cierre de ventana en vivo con descarga dentro de WebView2 no se ejercitó interactivamente; P1/P2 de documentación extensa y mejoras opcionales de UI siguen abiertos.

## Registro anterior (conservado)

- **Fecha de actualización:** 2026-11-19
- **Estado general:** Funcional y compilado en release Windows.
- **Artefacto compilado verificado:** `src-tauri\target\release\identity-core-tester.exe`
- **Lanzador rápido:** `Abrir-Tester-GUI.bat` (lanza el `.exe` sin mantener consola abierta).
- **Limitación Git:** Esta carpeta vive dentro de un repositorio Git padre (`LastRq - Tools`) como directorio sin trackear (`?? ./`), no como repositorio independiente.
- **Pendiente de verificación manual por el usuario:** Abrir `Abrir-Tester-GUI.bat`, seleccionar una carpeta real de Identity Core desde el diálogo nativo, ejecutar un perfil de pruebas y confirmar descarga de informes desde WebView2.
