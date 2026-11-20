import { deflateRawSync } from 'node:zlib';
import { readFileSync, existsSync, openSync, writeSync, closeSync } from 'node:fs';

const patterns = [
  /\bgh[pousr]_[A-Za-z0-9_]{16,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{15,}\b/g,
  /\b(?:sk|AIza)[-_A-Za-z0-9]{20,}\b/g,
  /(Authorization:\s*Bearer\s+)[^\s]+/gi,
  /((?:CLIENT_SECRET|API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|PASSWORD)\s*[:=]\s*)[^\s]+/gi,
];
export function redact(s) {
  let text = String(s).replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
  text = text.replace(patterns[0], '[REDACTED]').replace(patterns[1], '[REDACTED]').replace(patterns[2], '[REDACTED]');
  text = text.replace(patterns[3], '$1[REDACTED]').replace(patterns[4], '$1[REDACTED]');
  text = text.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]');
  text = text.replace(/((?:password|client_secret|api[_-]?key|access_token|refresh_token|secret)\s*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[REDACTED]');
  text = text.replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@');
  return text;
}

export function collectErrors(tail) {
  const lines = redact(tail).split('\n');
  const selected = lines.map((line, i) => ({ line, i })).filter(({ line }) => /\b(error|failed|failures|vulnerabilit|denied|could not|not found|no se encontr[oó]|warning:|npm ERR!|panicked|error\[E\d+\])\b/i.test(line));
  const indexes = new Set();
  for (const { i } of selected.slice(-18)) for (let j = Math.max(i - 1, 0); j <= Math.min(i + 2, lines.length - 1); j++) indexes.add(j);
  const summary = [...indexes].sort((a,b)=>a-b).map(i => lines[i]).filter(Boolean).join('\n');
  return summary.slice(-9000) || lines.slice(-16).join('\n').slice(-6000);
}

const escapeMd = s => String(s).replace(/\|/g,'\\|').replace(/\n/g, ' ');
export function makeMarkdownReport(state) {
  const results = state.results ?? [];
  const counts = Object.fromEntries(['passed','failed','blocked','timeout','interrupted','error','not-executed','skipped','canceled'].map(s=>[s,results.filter(r=>r.status===s).length]));
  const lines = [
    '# Identity Core — Informe local de pruebas', '',
    `- **Resultado global:** ${state.outcome || 'INCOMPLETO'}`,
    `- **Perfil:** ${state.profileLabel || state.profile}`,
    `- **Inicio:** ${state.startedAt}`,
    `- **Fin:** ${state.finishedAt || 'sin finalizar'}`,
    `- **Sistema:** ${state.os || 'desconocido'}`,
    `- **Git HEAD:** ${state.commit || 'NO DISPONIBLE (ZIP o sin repositorio Git)'}`,
    `- **Rama:** ${state.branch || 'no disponible'}; cambios locales: ${state.dirty ?? 'desconocido'}`,
    `- **Ejecución:** ${state.id || 'legacy'}; esquema: ${state.schemaVersion || 'legacy'}`,
    `- **Bloqueadas:** ${counts.blocked}; timeout: ${counts.timeout}; interrumpidas: ${counts.interrupted}; errores internos: ${counts.error}`,
    ...(state.internalError ? [`- **Error interno:** ${state.internalError}`] : []),
    `- **Ruta del proyecto:** ${state.project || 'no disponible'}`,
    `- **Resumen:** ${counts.passed} aprobadas, ${counts.failed} fallidas, ${counts['not-executed']} no ejecutadas, ${counts.skipped} omitidas, ${counts.canceled} canceladas.`, '',
    '## Resultados por comando', '',
    '| Prueba | Estado | Exit code | Segundos | Comando | Log |', '|---|---|---:|---:|---|---|',
    ...results.map(r=>`| ${escapeMd(r.label)} | ${r.status.toUpperCase()} | ${r.exitCode ?? '—'} | ${((r.durationMs ?? 0)/1000).toFixed(1)} | \`${escapeMd(r.command)}\` | ${r.logFile ? `logs/${r.logFile}` : '—'} |`), '',
    '## Errores y diagnósticos', '',
  ];
  const bad = results.filter(r=>r.status!=='passed');
  if (!bad.length) lines.push('No se registraron fallos en los comandos ejecutados.');
  for (const r of bad) {
    lines.push(`### ${r.label} — ${r.status.toUpperCase()}`);
    if (r.reason) lines.push(`Motivo: ${r.reason}`);
    if (r.tail || r.errorExcerpt) lines.push('', '```text', collectErrors(r.tail || r.errorExcerpt).replace(/```/g, "'''"), '```');
    lines.push('');
  }
  for (const d of state.diagnostics || []) lines.push(`- ${d.id} / ${d.category}: ${d.confirmed}. ${d.hypothesis || ''} ${d.recommendation}`);
  lines.push('## Cobertura pendiente (no ejecutada)', '', ...(state.externalCoverage||[]).map(s=>`- ${s}`), '',
    '## Para Antigravity / ChatGPT', '',
    'Revisa el comando exacto y las líneas del error. Propón un parche mínimo y pruebas de regresión. No declares aprobadas las validaciones no ejecutadas. El archivo `console.log` y los logs de cada comando están incluidos en el ZIP.',
    '', 'Informe generado localmente, sin enviar datos a servicios externos por la aplicación.', '');
  return lines.join('\n');
}

// ZIP estándar sin dependencias: deflate + encabezados/central directory + CRC32.
const CRC_TABLE = (()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[i]=c>>>0;}return t;})();
export function crc32(buffer) {let c=0xffffffff;for(const b of buffer)c=CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zipEntryBuffers(entryName, data, time, date, offset) {
  if (!/^[a-zA-Z0-9_.\/-]+$/.test(entryName) || entryName.startsWith('/') || entryName.split('/').includes('..')) throw Error('Invalid ZIP filename');
  const name = Buffer.from(entryName, 'utf8');
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const packed = deflateRawSync(buf); const crc = crc32(buf);
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(8, 8); lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(packed.length, 18); lh.writeUInt32LE(buf.length, 22); lh.writeUInt16LE(name.length, 26);
  const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(packed.length, 20); ch.writeUInt32LE(buf.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
  return { lh, name, packed, ch };
}
function zipTimestamp() {
  const now = new Date();
  return {
    date: ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(),
    time: (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1),
  };
}
export function createZip(entries) {
  const local = [], central = []; let offset = 0;
  const { date, time } = zipTimestamp();
  for (const entry of entries) {
    const { lh, name, packed, ch } = zipEntryBuffers(entry.name, entry.data, time, date, offset);
    local.push(lh, name, packed); central.push(ch, name);
    offset += lh.length + name.length + packed.length;
  }
  const cbuf = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cbuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cbuf, end]);
}
export function zipReportToFile(state, directory, outPath) {
  const names = ['report.md', 'report.json', 'console.log', 'environment.json', 'diagnostics.json', 'antigravity-prompt.md', 'manifest.json', ...state.results.filter(r => r.logFile).map(r => `logs/${r.logFile}`)].filter(name => existsSync(`${directory}/${name}`));
  const { date, time } = zipTimestamp();
  const central = []; let offset = 0;
  const fd = openSync(outPath, 'w');
  try {
    for (const name of names) {
      const { lh, name: nbuf, packed, ch } = zipEntryBuffers(name, readFileSync(`${directory}/${name}`), time, date, offset);
      writeSync(fd, lh); writeSync(fd, nbuf); writeSync(fd, packed);
      central.push(ch, nbuf); offset += lh.length + nbuf.length + packed.length;
    }
    const cbuf = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(cbuf.length, 12); end.writeUInt32LE(offset, 16);
    writeSync(fd, cbuf); writeSync(fd, end);
  } finally { closeSync(fd); }
}
