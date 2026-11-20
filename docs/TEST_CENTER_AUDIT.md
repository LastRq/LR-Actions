# Auditoría inicial — 2026-11-19

Inspección estática previa a los cambios. Fuentes: archivos de esta carpeta y copia local `D:/Codespace/LastRq Systems/identity-requiem-core`, remoto `LastRq/Identity-Requiem-Core-`. No se tomó la documentación histórica como prueba de ejecución actual.

## Base existente

| Área | Estado observado | Acción |
|---|---|---|
| Inicio | Tauri 2 real, selector nativo, backend Node oculto. Lanzador web supone que se encuentra dentro del producto | Conservar Tauri; reparar lanzador independiente |
| Interfaz | HTML/CSS/JS, oscura y adaptable; no React | Conservar plataforma, separar vistas útiles |
| Backend | HTTP loopback, URL aleatoria, SSE; estado global en server.mjs | Separar supervisión, descubrimiento, persistencia y diagnóstico |
| Ejecutor | Secuencial, stdout/stderr, códigos de salida | Conservar secuencial (concurrencia 1); añadir timeout, preflight, checkpoints |
| Cancelación | taskkill /T /F Windows; SIGTERM grupo POSIX; cierre Tauri forzado | Verificar árbol con fixtures; recuperación tras cierre abrupto |
| Catálogo | Fijo, fases 0–20, perfiles quick/full | Descubrir scripts y crates sin límite de fase |
| Dependencias | Node estándar; CLI Tauri; Rust/Tauri/dialog/serde | No añadir frameworks |
| Logs | Archivos por comando y agregado; cola de escritura sin backpressure; redacción parcial | Regular flujo y capturar UTF-8 fragmentado; redacción antes de persistir |
| Reportes | Markdown, JSON sin esquema, ZIP en memoria | Versionar, añadir evidencia, manifiesto y diagnóstico |
| Historial/comparación | Archivos conservados pero sin consulta ni comparación | Implementar localmente |
| Entorno | Solo package.json/Cargo.toml; npm ci automático si falta tsx | Quitar instalación automática, inspeccionar herramientas |
| Diagnóstico | Extracción textual de las últimas líneas; sin categorías | Clasificación basada en evidencia, hipótesis explícitas |
| Pruebas propias | Cuatro tests Node y dos Rust declarados en código | Ampliar con procesos y API reales sobre fixtures |

## Defectos y riesgos

- P0: `finally` puede convertir una excepción interna en PASSED. La reserva contra duplicados ocurre después de leer el cuerpo HTTP: dos peticiones lentas pueden competir.
- P0: sin timeout; hijos o pipelines pueden quedar vivos; no recuperación de sesión tras cierre abrupto.
- P0: npm ci descarga/ejecuta hooks sin consentimiento específico; comandos sin --locked pueden modificar lockfiles. El directorio de reportes se escribe dentro del producto.
- P0: construir un comando cmd.exe por concatenación no sirve como límite de confianza para un catálogo dinámico. Los scripts de un repositorio son código ejecutable: solo repositorios de confianza.
- P0: no se distinguen herramientas ausentes de fallos del producto; colas de logs/SSE pueden crecer sin límite. El ZIP comprueba el tamaño después de cargar archivos.
- P1: perfiles no reflejan cambios del repositorio; verify:all corta tras el primer error y repite controles presentes en otros agregados.
- P1: no hay tabla de resultados individuales, historial navegable, configuración de timeout ni diagnóstico estructurado.
- P2: ninguna equivalencia total con CI es demostrable; faltan varios locks en auditoría Rust, verificación de secretos versionados y Android.

## Identity Core observado

- Workspace Cargo con diez crates: domain, crypto, storage, auth, ai, multimodal, connectors, gateway, world, shell. Desktop y mobile están excluidos del workspace y tienen manifiestos propios.
- package.json contiene typecheck, lint, format:check, test:contracts, test, test:phase1–20, verify:phase0–20, verify:all y build. `format` escribe archivos y `clean` borra: no deben incorporarse como pruebas.
- `test` cubre fases 0–10. Fases 11–20 tienen comandos separados. `tests/phase11-ui.test.tsx` existe pero no aparece en test:phase11 ni verify:all: brecha del producto, no corregida aquí.
- Pruebas Rust inline (incluyendo crypto, auth, storage y sincronización); no se debe inventar cobertura por el nombre de un crate. Tests reales de SQLCipher dependen de `bundled-sqlcipher-vendored-openssl`.
- rust-toolchain.toml fija 1.100.0. CI Windows comprueba Perl nativo (no Git/MSYS), NASM y toolchain; Linux requiere paquetes Tauri/OpenSSL/GTK.
- Scripts auxiliares: verify-env.sh (diagnóstico) y generate-ts-types.sh (generación; no prueba).
- CI: ci-phase2.yml valida frontend, fmt, Clippy --locked, tests --locked y check desktop en Ubuntu; full-validation.yml añade Windows build y cargo-ndk para tres ABIs; security-audit.yml audita tres Cargo.lock, cargo-deny, npm audit y nombres de archivos sensibles; release.yml publica tags validados.
- No se encontró un comando dedicado de E2E/instalador ni pruebas instrumentadas Android configuradas. Un cross-build no prueba un dispositivo físico.
- La copia del producto contiene archivos de un Test Center previo sin seguimiento. Se preservan; no se editan sus fuentes.

## Arquitectura y orden de implementación

Conservar Tauri + Node ESM + interfaz web nativa. Extraer módulos solo donde hay una responsabilidad verificable: catálogo/entorno, supervisor, persistencia, diagnóstico, HTTP/UI. P0 antes de P1/P2. Concurrencia de suites 1 y Cargo jobs limitado; evita competir por locks y saturar recursos. No migrar a React ni añadir una base de datos.

## Límites de verificación inicial

Las afirmaciones de compilación de la memoria anterior son históricas. En esta auditoría aún no se ejecutaron tests. Windows requiere comprobar taskkill, rutas con espacios, npm.cmd y WebView2. Android físico, release e instaladores requieren verificaciones separadas. Ver TEST_REPORT.md para resultados posteriores y DEVELOPMENT_ROADMAP.md para trabajo pendiente.
