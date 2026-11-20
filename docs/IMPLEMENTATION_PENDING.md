# Identity Core Test Center — pendientes al detener el trabajo

**Fecha:** 2026-11-19 (America/Guayaquil).  
**Estado:** implementación detenida por solicitud del usuario. No está terminada ni validada para entrega.  
**Alcance de este documento:** separar código ya escrito, funcionalidades faltantes y comprobaciones pendientes. No autoriza reanudar el trabajo.

## 1. Punto exacto de interrupción

Se completó la auditoría inicial, se modificó el motor Node y se escribió una nueva interfaz. Se ejecutó una vez `npm test`: **12 pruebas aprobadas, 0 fallidas**. Después se leyó código y documentación para preparar los siguientes pasos; no se ejecutaron pruebas del producto, compilaciones nuevas ni validación visual.

No se realizaron commits, pushes ni fusiones. No se modificó la lógica de Identity Core. El Test Center sigue dentro del repositorio padre `D:/Codespace/LastRq - Tools`, como carpeta sin seguimiento (`?? ./`); hay cambios de otros proyectos que deben preservarse.

La documentación anterior que describe un ejecutable compilado corresponde al estado previo. **No demuestra que el ejecutable contenga los cambios actuales.**

## 2. Código que ya quedó escrito

| Componente | Implementación presente | Límite de lo comprobado |
|---|---|---|
| Auditoría | `docs/TEST_CENTER_AUDIT.md`; inspección de Test Center y copia local de Identity Core | Inspección estática, sin ejecutar suites del producto |
| Descubrimiento | `discovery.mjs`: scripts npm, manifiestos Cargo, inventario y evidencia de workflows; perfiles rápido, estándar, completo y personalizado | Fixture con fase 42; no validación integral sobre todas las variantes de monorepo |
| Supervisor | `process.mjs`: stdout/stderr, UTF-8, timeout, cancelación del árbol y redacción progresiva | Procesos Node reales controlados; timeout con hijo Windows y cancelación comprobados |
| Orquestación | `runner.mjs`: secuencial, dependencias, bloqueo por entorno, checkpoints y resultados | Fixture con fallo independiente, éxito y bloqueo; rechazo de segunda ejecución |
| Entorno | Sondas de Node/npm/Rust/Cargo/Git/componentes, herramientas nativas y Android | Invocadas durante tests de integración; exactitud del diagnóstico nativo/Android no validada integralmente |
| Diagnósticos | `diagnostics.mjs`: categorías, evidencia, ubicación cuando coincide el patrón, hipótesis y prompt Antigravity | Caso TypeScript y agrupación controlados |
| Persistencia | `history.mjs`: JSON, historial, recuperación y comparación | Fixture de interrupción y comparación con suites distintas |
| Reportes | Markdown, JSON con `schemaVersion: 1`, entorno, diagnósticos, manifiesto, prompt y ZIP | Existencia y descompresión de archivos de fixture comprobadas |
| API | Servidor loopback, token, controles Host/Origin, SSE, historial, configuración y descarga | Fixture HTTP real: token, origen, SSE inicial, doble inicio y ZIP |
| Interfaz | Ocho vistas nuevas en `index.html`, `app.js`, `style.css` | **Sin abrir ni verificar visualmente** |
| Escritorio | Se conservó Tauri y su selector anterior | **Sin recompilar ni probar con el nuevo backend** |

Se eliminó `catalog.mjs`; su responsabilidad pasa a `discovery.mjs`. `package.json` ahora ejecuta todos los archivos `tests/*.test.mjs`.

## 3. P0 — correcciones y desarrollo antes de una entrega utilizable

### 3.1 Reparar el inicio de un clic

- Adaptar `Iniciar-Pruebas.cmd` y `Iniciar-Pruebas.sh`: todavía inician el servidor desde la carpeta del Test Center, que no contiene un `Cargo.toml` de producto en su raíz. Deben seleccionar o recibir explícitamente la ruta de Identity Core.
- Revisar `Abrir-Tester-GUI.bat`: conserva la compilación automática mediante `npx` si falta el ejecutable. Evitar descargas implícitas; dar un error claro o un fallback local cuando falte una dependencia.
- Comprobar Node compatible antes del arranque y mostrar errores al usuario sin dejar un proceso invisible huérfano.
- Recompilar Tauri y comprobar que sus recursos empaquetados corresponden a los módulos nuevos, no a una copia anterior.
- Verificar el inicio desde rutas con espacios y la selección de carpeta nativa.

**Criterio de cierre:** doble clic, selección del producto, panel visible y errores de dependencias comprensibles sin introducir comandos manuales.

### 3.2 Cierre, cancelación y recuperación completos

- Integrar un cierre ordenado de Tauri con el endpoint de apagado del servidor. Actualmente Tauri conserva `taskkill /T /F`; puede cortar la escritura del informe en lugar de esperar a su finalización.
- Probar cierre de ventana, cierre abrupto, cancelación durante preflight y durante procesos npm/Cargo con descendientes.
- Corregir un caso detectado por lectura: un checkpoint anterior a la inspección puede no tener `environment`. La recuperación llama a `saveReport(..., true)`, que intenta serializar `report.environment` sin valor predeterminado. Añadir manejo seguro y una regresión específica.
- Revisar recuperación con JSON truncado, logs ausentes y errores de disco. Regenerar diagnósticos para estados recuperados, sin presentar éxito.
- Validar el bloqueo entre dos instancias para el mismo proyecto y su recuperación después de un cierre abrupto, incluyendo carpetas de reportes alternativas.

**Criterio de cierre:** sin procesos de pruebas huérfanos y con sesión recuperable, explícitamente interrumpida si no finalizó.

### 3.3 Entorno y clasificación de fallos

- Verificar el detector de MSVC: buscar `cl.exe` solo en PATH puede declarar configuración pendiente aunque Cargo pueda encontrar Visual Studio. Resolverlo sin cambiar PATH global.
- Validar Perl nativo, NASM, Windows SDK y las necesidades reales de SQLCipher/OpenSSL; Linux necesita comprobaciones nativas más precisas.
- Mejorar la clasificación de requisitos descubiertos durante la ejecución: una dependencia Cargo ausente en modo offline o un error de configuración puede quedar como `failed` genérico aunque corresponda a entorno.
- Comprobar herramientas npm concretas y restricciones de versiones del proyecto; hoy la presencia de `node_modules/.bin` no demuestra que todas sus dependencias estén listas.
- Validar SDK/NDK, targets y ADB con un entorno Android real. La existencia de un directorio no prueba compatibilidad.

**Criterio de cierre:** separar fallos confirmados del producto, entorno bloqueado y diagnósticos inciertos.

### 3.4 Logs, privacidad y exportación bajo carga

- Probar salida grande y sostenida, un cliente SSE lento, reconexión y escrituras de disco fallidas. Los tests actuales no validan estos casos.
- Fortalecer la redacción en líneas extremadamente largas: el corte por bloques de 32 KB puede dividir un patrón de credencial. El test existente cubre fragmentación entre chunks normales, no todos los límites de líneas largas.
- Probar secretos entre stdout/stderr, claves privadas con delimitadores divididos y formatos JSON/URL adicionales. Mantener explícito que la redacción por patrones no garantiza anonimización universal.
- Reemplazar o ampliar el ZIP síncrono en memoria: todavía tiene un límite de **60 MiB**. Por encima, conserva archivos y registra `archiveError`, pero no entrega el ZIP completo solicitado.
- Verificar integridad completa del manifiesto, límites ZIP y comportamiento ante archivos ausentes. El manifiesto actual enumera rutas y tamaños; no contiene hashes.
- Revisar preservación de evidencia relevante cuando el error está fuera de la cola de 65 KB usada por diagnósticos.

**Criterio de cierre:** logs persistidos con memoria acotada, secretos de fixtures redactados y exportación completa para el volumen soportado documentado.

### 3.5 Límites de confianza y manejo de errores

- Revisar de extremo a extremo que el navegador solo seleccione IDs descubiertos y no comandos/rutas arbitrarios; ampliar tests de entradas malformadas y traversal.
- Revalidar scripts/configuración inmediatamente antes de ejecutarlos y documentar el riesgo de cambios durante una sesión. El fingerprint actual comprueba el catálogo al iniciar, no congela todos los archivos ejecutables.
- Revisar symlinks y archivos de historial alterados antes de permitir descargas.
- Endurecer la validación de URL en Rust: sigue comprobando un prefijo, no los componentes completos de una URL loopback.
- Probar que errores internos, de persistencia o de exportación nunca producen un resumen engañoso.

El Test Center **no es un sandbox**: npm/Cargo ejecutan código del repositorio elegido y heredan el entorno del proceso. La opción de red controla auditorías/Cargo, no bloquea toda conexión que un script npm pueda realizar.

## 4. P1 — completar la experiencia y precisión funcional

### Interfaz

- Abrir y validar las ocho vistas nuevas; revisar errores de JavaScript, navegación, foco, accesibilidad y resoluciones pequeñas.
- Probar ejecución, cancelación, resultados individuales, filtros de consola, copia, descarga, historial, comparación y configuración desde botones reales.
- Verificar descargas en WebView2: la respuesta HTTP correcta no demuestra que Tauri las guarde correctamente.
- Mejorar duración en vivo: el panel usa principalmente la duración final, no un cronómetro activo por prueba.
- Mostrar agrupaciones de diagnósticos en pantalla; hoy se serializan en `diagnostics.json`, pero la vista muestra diagnósticos individuales.
- Revisar estados de desconexión, error interno y ZIP no disponible, así como el cambio de proyecto sin confundir historiales.

### Descubrimiento y perfiles

- Reducir ejecuciones repetidas entre `npm test` y `test:phaseN` sin perder pruebas que solo estén en el agregado. Los perfiles actuales todavía pueden repetir fases.
- Validar dependencias y rutas `dist` según la configuración Tauri real, no solo `dist/index.html` por convención.
- Completar descubrimiento de scripts en workspaces npm y pertenencia real de crates Cargo. Hoy se inspeccionan scripts raíz y archivos bajo `crates/`/`apps/`, sin resolver toda la semántica Cargo/TOML.
- Documentar y detectar pruebas presentes en archivos pero no referenciadas por comandos. Caso encontrado: `tests/phase11-ui.test.tsx` no incluido por los scripts de fase 11/verify:all inspeccionados.
- Mantener agregados `verify:*` disponibles en personalizado sin duplicarlos indiscriminadamente en completo.

### Diagnósticos y reportes

- Añadir fixtures específicos para Rust, Clippy, Rustfmt, SQLCipher, linker, Android, seguridad y herramientas faltantes; hoy solo TypeScript tiene un test específico de clasificación.
- Revisar falsos positivos de reglas por palabras clave y mejorar la identificación de ubicación/causa sin afirmar causalidad.
- Formalizar el esquema JSON documentado y validarlo, incluyendo sesiones recuperadas e informes con error interno.
- Comprobar el prompt Antigravity con un fallo real y asegurar que solo incluya evidencia útil y acotada.

## 5. P2 — CI, especialización y plataformas

- Mejorar la matriz CI: actualmente extrae líneas y candidatos por coincidencias. No resuelve completamente YAML, matrices, jobs reutilizables, flags, variables ni dependencias.
- Incorporar la verificación local equivalente de nombres de archivos sensibles versionados que existe en el workflow de seguridad.
- Relacionar suites reales con criptografía, almacenamiento, autenticación y sincronización, distinguiendo cobertura observada de inferencias por nombre del crate.
- Documentar brechas de seguridad/sincronización en Identity Core sin modificar su lógica durante este trabajo.
- Probar cross-build Android si existen las herramientas, y mantener separado de pruebas instrumentadas/físicas.
- E2E, instaladores MSI/NSIS y dispositivos: no se encontró una suite dedicada ejecutable en la inspección; documentar como brecha, no generar tests ficticios.
- Revisar comparación entre commits/entornos distintos y pruebas cuyo contenido cambia aunque el texto del script no cambie.

## 6. Validaciones pendientes

| Validación | Estado al detener | Evidencia disponible |
|---|---|---|
| Tests propios Node | **PASÓ: 12/12** | `npm test`, 2026-11-19; fixtures temporales y procesos reales controlados |
| Tests reales de Identity Core | **NO EJECUTADO** | Solo lectura de fuentes/configuración |
| Perfil completo contra Identity Core | **NO EJECUTADO** | Requiere revisar preflight y ejecutar |
| Nueva interfaz en navegador | **NO EJECUTADO** | Archivos escritos, sin inspección visual |
| Nueva interfaz dentro de Tauri | **NO EJECUTADO** | No se abrió esta versión |
| `cargo test` del Test Center | **NO EJECUTADO en esta intervención** | Resultados previos son históricos |
| Build nuevo Tauri / instalador | **NO EJECUTADO** | Binario previo no certifica versión actual |
| Streaming SSE de salida completa | **PARCIAL** | Test confirma conexión/evento inicial; falta comprobar flujo de salida y reconexión |
| ZIP grande y fallos de disco | **NO EJECUTADO** | ZIP pequeño de fixture descomprimido correctamente |
| Android físico / emulador | **NO EJECUTADO** | Sin prueba de dispositivo |
| Comprobación final de memoria/documentación | **PENDIENTE** | No se ejecutó `project_docs.py check` |

Los 12 tests no representan cobertura total ni número de tests aprobados de Identity Core. Los temporales creados por los tests no se eliminaron automáticamente; no deben confundirse con reportes del producto.

## 7. Documentación que falta completar

Existe `docs/TEST_CENTER_AUDIT.md` y el conjunto histórico `docs/project/`. Falta redactar o reconciliar con la implementación efectiva:

- `docs/ARCHITECTURE.md`
- `docs/TEST_DISCOVERY.md`
- `docs/TEST_PROFILES.md`
- `docs/REPORT_FORMAT.md`
- `docs/SECURITY.md`
- `docs/USER_GUIDE.md`
- `docs/TEST_REPORT.md`
- `docs/DEVELOPMENT_ROADMAP.md`
- Documentos canónicos afectados en `docs/project/`: arquitectura, decisiones, dominio, seguridad, amenazas, plan y roadmap.
- `scripts/test-center/README.md` y `LEEME-TestCenter.txt`: siguen describiendo comportamientos anteriores y no deben usarse como guía de esta versión.

Conservar los documentos existentes y decidir referencias/ubicaciones canónicas para evitar dos arquitecturas o reportes contradictorios. El estado, changelog, handoff y reporte canónico reciben una nota de interrupción; eso no sustituye la reconciliación completa.

## 8. Rutas para retomar

- Test Center: `D:/Codespace/LastRq - Tools/Identity Core Tester`.
- Producto inspeccionado: `D:/Codespace/LastRq Systems/identity-requiem-core`.
- Auditoría: `docs/TEST_CENTER_AUDIT.md`.
- Backend nuevo: `scripts/test-center/{server,discovery,process,runner,history,diagnostics,report}.mjs`.
- UI: `scripts/test-center/{index.html,app.js,style.css}`.
- Tests: `scripts/test-center/tests/{core,report}.test.mjs`.
- Reportes nuevos por defecto: `%LOCALAPPDATA%/IdentityCoreTestCenter/reports/<hash-de-ruta-del-proyecto>/<id>/` en Windows. El servidor muestra la ruta exacta. `--reports` permite una ruta explícita.
- La carpeta antigua `.identity-test-reports` del producto no se migró ni se eliminó.

## 9. Orden recomendado cuando el usuario autorice continuar

1. Leer este documento, comprobar Git y conservar cambios ajenos; revisar primero recuperación temprana y lanzadores.
2. Cerrar P0 y añadir sus regresiones antes de ampliar funcionalidades.
3. Ejecutar suites reales seleccionadas contra Identity Core, registrar commit, entorno, comandos y resultados; después intentar completo.
4. Validar interfaz y descargas en navegador/Tauri; recompilar el artefacto de escritorio.
5. Completar P1/P2 y documentación según el alcance original, registrando límites externos.
6. Revisar cada criterio de aceptación; entregar sin declarar terminados los pendientes o bloqueados.

**No reanudar automáticamente: el usuario pidió detener el trabajo.**

## 10. Avance 2026-11-19 (reanudado por el usuario)
- Hecho: `saveReport` tolera checkpoints sin `environment` (history.mjs); lanzadores `Iniciar-Pruebas.cmd/.sh` validan Node >=22 y pasan `--project` (argumento o `IDENTITY_CORE_PATH`). `npm test`: 12/12.
- Sin hacer: el resto de P0/P1/P2, validaci�n visual, Tauri y suites reales de Identity Core.
- Hecho: cierre ordenado Tauri?servidor (stdin cerrado + `--exit-on-stdin-close`, espera 20 s y luego `taskkill`); validaci�n de URL loopback por componentes en Rust. `cargo test` 2/2. Sin recompilar el binario ni probar el cierre en vivo.

## 11. Validaci�n 2026-11-19 18:00-18:07
- `npm test`: 13/13 (nuevo `tests/recovery.test.mjs`: checkpoint sin `environment`). `cargo test`: 2/2. `tauri build --no-bundle`: compila (binario release generado; no se abri� ni se prob� el cierre en vivo).
- UI en navegador (subagente, sobre servidor real contra identity-requiem-core): 8 vistas OK, 0 errores JS; perfil r�pido ejecutado y cancelado (CANCELED, 36 s); descargas, historial, comparar y configuraci�n OK. Resultados del producto en esa ejecuci�n: typecheck passed; `lint` y `format:check` FAILED (fallos del producto, no confirmados por el Test Center como defecto propio); `test:contracts` cancelado.
- Hallazgo abierto: salida de herramientas nativas de Windows se decodifica como UTF-8 (mojibake CP850) en la vista Entorno.
- Sigue pendiente: perfil completo, UI dentro de Tauri, carga/ZIP>60 MiB, MSVC, redacci�n en l�neas largas, documentaci�n can�nica.
- Corregido: mojibake CP850 en salida nativa de Windows (`decodeChunk` en process.mjs, conserva UTF-8 v�lido y secuencias partidas entre chunks; solo letras espa�olas, ver `shortcut:`). `npm test` 14/14.
- Hecho: `Abrir-Tester-GUI.bat` ya no descarga con npx; exige dependencia local (`npm ci`) y compila con `--no-install`. Sin ejecutar el .bat.
- Hecho: detector MSVC v�a `vswhere` (discovery.mjs). Ejecuci�n real contra identity-requiem-core: perfil completo 2026-11-19T23-08-57 (28 passed; lint y format:check FAILED del producto; 10 blocked) y custom rust-clippy + rust-tests 2026-11-19T23-14-26: PASSED (rust-tests 149 s; clippy 1 s, probablemente con cach�).
- Ejecuci�n 2026-11-19T23-20-03 (red habilitada temporalmente, restaurada a false): desktop-format/check/build (88 s), npm-audit y 3 audit-*.lock PASSED; `rust-deny` FAILED por RUSTSEC-2024-0370 (proc-macro-error sin mantenimiento) en Cargo.lock de Identity Core: hallazgo real del producto, no del Test Center. Pendiente a�n: android-build (sin SDK/NDK), Tauri GUI en vivo, carga/ZIP>60 MiB, redacci�n en l�neas largas, documentaci�n.

## 12. Cierre P0 2026-11-19
- Hecho: `zipReportToFile` (report.mjs + history.mjs) sin l�mite de 60 MiB en memoria; `streamRedactor` (process.mjs) evita cortar tokens en l�neas >65 KB; `server.mjs` rechaza symlinks en `download/`; `diagnostics.mjs` clasifica errores offline de Cargo como `toolchain`.
- Tests propios: `npm test` **17/17** (incluye `tests/p0.test.mjs`); `cargo test` **2/2**; `identity-core-tester.exe` arranca y acepta `CloseMainWindow()`.
- Documentaci�n viva actualizada en `docs/project/{CHANGELOG,PROJECT_STATE,TEST_REPORT,AI_CONTEXT_HANDOFF}.md`.
- Remanente no bloqueante (P1/P2 y entorno externo): `android-build` sin SDK/NDK, descarga interactiva dentro de WebView2 de Tauri, y gu�as opcionales fuera de `docs/project/`.
