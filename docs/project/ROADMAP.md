# Roadmap — Identity Core Tester

## Hitos

1. **v1.0 — Interfaz gráfica de escritorio Tauri v2 (actual)**
   - Ventana inicial de selección y validación de directorio del proyecto.
   - Lanzamiento sin navegador ni ventana de comandos (`windows_subsystem = "windows"` + `CREATE_NO_WINDOW`).
   - Ventana independiente para el Centro de Pruebas con limpieza automática del servidor local al salir.
2. **Mejoras futuras opcionales**
   - Botón "Cambiar carpeta" directamente desde la ventana del Centro de Pruebas para reabrir el selector sin cerrar la aplicación.
   - Botón "Abrir carpeta de informes" usando `tauri-plugin-opener` para inspeccionar `.identity-test-reports/` directamente en el Explorador.
