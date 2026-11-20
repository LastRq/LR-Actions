#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo 'Necesitas Node.js 22+ en PATH para ejecutar Identity Core Test Center.' >&2
  exit 1
fi
PROJ="${1:-${IDENTITY_CORE_PATH:-}}"
if [ -z "$PROJ" ] || [ ! -f "$PROJ/package.json" ]; then
  echo 'Indica la ruta de Identity Core: ./Iniciar-Pruebas.sh <ruta> (o IDENTITY_CORE_PATH).' >&2
  exit 1
fi
exec node scripts/test-center/server.mjs --project "$PROJ"