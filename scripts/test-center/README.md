# Identity Core Test Center — versión local

Ejecutor **local, sin API de IA, sin coste de tokens y sin GitHub Actions**. Utiliza Node.js estándar para arrancar un servidor efímero en **127.0.0.1**, muestra una interfaz en el navegador y ejecuta los comandos originales de este repositorio mediante procesos hijos. No hay subida automática de registros.

## Inicio (Windows)

1. Instala Node.js 22+, Rust/rustup con `cargo` y `rustfmt` (y herramientas de compilación nativas cuando proceda). Para el perfil completo también se recomiendan `cargo-audit` y `cargo-deny`.
2. Descomprime el repositorio y conserva `Iniciar-Pruebas.cmd` en su raíz, junto a `package.json`.
3. Haz **doble clic en `Iniciar-Pruebas.cmd`**. Se abrirá el navegador.
4. Pulsa **Ejecutar pruebas rápidas** o **Ejecutar pruebas completas**.
5. Al finalizar descarga **Informe ZIP**; compártelo con ChatGPT o Antigravity para analizar fallos. También se guarda en `.identity-test-reports/<fecha>/`.

La primera vez se ejecutará automáticamente `npm ci` si no existe `node_modules/.bin/tsx`. El modo completo ejecuta `verify:all`, `npm audit`, `cargo fmt`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace -- --nocapture`, verificaciones de formato Desktop/Mobile y `cargo check` Desktop. El modo rápido ejecuta `typecheck`, `lint`, pruebas de Fase 20 y `cargo fmt`. Las auditorías Rust (`cargo audit`, `cargo deny check`) se intentan en modo completo: si falta instalar sus herramientas o fallan por red, quedarán **NO EJECUTADAS/FALLIDAS** según el error real, nunca aprobadas artificialmente.

## Otras plataformas / consola

```sh
node scripts/test-center/server.mjs
```

En Linux y macOS también puedes iniciar con `./Iniciar-Pruebas.sh`; se abre el navegador con `xdg-open`/`open` cuando estén disponibles. La comprobación Android con NDK para tres ABIs y las pruebas con dispositivos físicos son **pendientes externos**, no forman parte de esta primera versión. No comparar automáticamente una ejecución Windows con los jobs de Ubuntu/Android del CI.

## Informes

- `report.zip`: contiene `report.md`, `report.json`, `console.log` y logs individuales por comando; archivo preferido para enviar al asistente.
- `report.md`: resumen legible, códigos de salida y extractos de fallos.
- `report.json`: datos estructurados para diagnósticos y herramientas.
- `console.log`: salida agregada (puede ser larga).

El sistema conserva resultados con `FAILED`, `INCOMPLETE`, `CANCELED`, `PASSED`. Un comando omitido **no cuenta como aprobado**. La carpeta `.identity-test-reports/` está en `.gitignore`. **Revisa los logs antes de compartirlos**: se redaccionan algunas claves comunes, pero las rutas locales u otros secretos podrían aparecer en errores inusuales. Evita ejecutar con credenciales reales expuestas en la salida.

## Seguridad y privacidad

- Vinculación solo a `127.0.0.1`, URL de sesión aleatoria, sin exposición a LAN ni telemetría.
- El navegador solo puede activar perfiles predefinidos; no puede enviar comandos arbitrarios ni rutas para ejecución.
- Los tests pueden descargar dependencias y consultar las bases de avisos de npm/RustSEC, como cualquier compilación normal; el panel local no envía logs a servicios de IA.
- Ejecuta el programa como usuario normal, **no como administrador**.

## Autocomprobación

```sh
node --test scripts/test-center/tests/report.test.mjs
```

Esta autocomprobación **no sustituye** correr los tests reales de Identity Core en el PC. 
