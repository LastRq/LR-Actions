# Modelo de Dominio — Identity Core Tester

## Entidades principales

- **Proyecto objetivo (`projectDir`):** Carpeta local seleccionada por el usuario. Invariante: debe existir como directorio y contener `package.json` y `Cargo.toml`.
- **Perfil de pruebas (`quick`, `full`):** Conjunto cerrado e inmutable de identificadores de comprobación definidos en `scripts/test-center/catalog.mjs`.
- **Comprobación (`check`):** Comando predefinido (`program`, `args`, `label`, `group`). Nunca acepta comandos arbitrarios introducidos desde la UI.
- **Ejecución (`state`):** Sesión de pruebas con estado (`RUNNING`, `PASSED`, `FAILED`, `INCOMPLETE`, `CANCELED`), resultados individuales y carpeta de salida `.identity-test-reports/<timestamp>-<hex>-<profile>/`.
- **Informe (`report.md`, `report.json`, `report.zip`, `console.log`):** Artefactos generados localmente tras redacción de patrones de secretos.
