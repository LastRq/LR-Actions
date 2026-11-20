# Modelo de Amenazas — Identity Core Tester

| Activo / Límite | Amenaza | Mitigación actual | Riesgo residual |
| --- | --- | --- | --- |
| API local HTTP (`127.0.0.1`) | Acceso desde otro proceso/sitio web local | Token aleatorio de 144 bits en ruta, `X-Frame-Options: DENY`, CSP estricta, filtro de IP loopback | Bajo (procesos locales con mismo usuario podrían inspeccionar argumentos/memoria) |
| Ejecución de comandos | Inyección de comandos desde la UI | Catálogo estático congelado en `catalog.mjs`; `projectDir` se valida y pasa como `cwd` sin interpolación de shell en `spawn` de Node | Bajo (comandos npm/cargo ejecutan scripts del proyecto elegido por el usuario, que es de confianza del usuario) |
| Ventana `test-center` (`WebviewUrl::External`) | Navegación a origen externo malicioso | Rust verifica prefijo `http://127.0.0.1:` en `extract_ready_url` antes de abrir la ventana | Bajo |
| Procesos huérfanos | `node.exe` activo tras cerrar la app | `RunEvent::Exit` ejecuta `taskkill /PID <pid> /T /F` oculto y `kill()` | Bajo (terminación forzada del proceso Tauri por Task Manager podría dejar `node` vivo) |
| Informes exportados | Fuga accidental de secretos en logs | Redacción por expresiones regulares en `report.mjs`; aviso al usuario de revisar antes de compartir | Medio (patrones no contemplados o rutas locales) |
