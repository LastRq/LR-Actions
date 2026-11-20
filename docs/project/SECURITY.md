# Seguridad — Identity Core Tester

## Controles activos

- **Solo loopback:** `server.mjs` escucha exclusivamente en `127.0.0.1` en puerto efímero (`0`) y rechaza IPs distintas de `127.0.0.1` / `::ffff:127.0.0.1`.
- **Token por sesión:** Cada arranque genera un prefijo aleatorio de 18 bytes (`sessionToken`).
- **Validación de URL en Rust:** `extract_ready_url` acepta únicamente URLs con prefijo `http://127.0.0.1:`.
- **Catálogo cerrado:** `catalog.mjs` usa `Object.freeze`; `POST /api/run` solo acepta perfiles registrados (`Object.hasOwn`).
- **Redacción de logs:** `report.mjs` redacta tokens GitHub, claves `sk`/`AIza`, encabezados `Authorization: Bearer` y variables `CLIENT_SECRET`/`API_KEY`/`ACCESS_TOKEN`/`REFRESH_TOKEN`/`PASSWORD`.
- **Sin telemetría ni elevación:** Ejecución 100% local sin privilegios de administrador.
- **Sin secretos en el repositorio:** No se almacenan credenciales ni `.env`.
