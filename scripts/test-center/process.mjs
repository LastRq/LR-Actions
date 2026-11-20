import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { redact } from './report.mjs';

// npm.cmd needs cmd.exe on Windows. Only catalog-owned, shell-safe tokens enter it.
export function spawnSpec(program, args) {
  if (process.platform === 'win32' && program === 'npm') {
    if (!args.every(x => /^[a-zA-Z0-9_./:@=-]+$/.test(x))) throw Error('Argumento npm no seguro');
    return ['cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`]];
  }
  return [program, args];
}

export async function stopTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.on('error', resolve); killer.on('close', resolve);
    });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    await new Promise(r => setTimeout(r, 200));
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
}

// shortcut: solo letras españolas de CP850 (salida de herramientas nativas de Windows); ampliar si aparecen otras.
const CP850 = { 0x81: 'ü', 0x82: 'é', 0x83: 'â', 0x84: 'ä', 0x85: 'à', 0x87: 'ç', 0x88: 'ê', 0x8a: 'è', 0x90: 'É', 0xa0: 'á', 0xa1: 'í', 0xa2: 'ó', 0xa3: 'ú', 0xa4: 'ñ', 0xa5: 'Ñ', 0xa8: '¿', 0xb5: 'Á', 0xd6: 'Í', 0xe0: 'Ó', 0xe9: 'Ú' };
// Excluye una secuencia UTF-8 truncada al final del chunk (se completa en el siguiente).
function completeLength(b) {
  for (let i = 1; i <= Math.min(3, b.length); i++) {
    const c = b[b.length - i];
    if (c >= 0xc0) return c >= 0xf0 ? (i < 4 ? b.length - i : b.length) : c >= 0xe0 ? (i < 3 ? b.length - i : b.length) : (i < 2 ? b.length - i : b.length);
    if (c < 0x80) break;
  }
  return b.length;
}
export function decodeChunk(chunk, utf8, win = process.platform === 'win32') {
  if (!win) return utf8.write(chunk);
  const all = utf8.tail?.length ? Buffer.concat([utf8.tail, chunk]) : chunk;
  const n = completeLength(all);
  utf8.tail = all.subarray(n);
  const body = all.subarray(0, n);
  try { new TextDecoder('utf-8', { fatal: true }).decode(body); } catch { return [...body].map(b => b < 128 ? String.fromCharCode(b) : CP850[b] || '?').join(''); }
  return utf8.write(body);
}
export function streamRedactor(emit) {
  const decoder = new StringDecoder('utf8');
  let pending = '', privateKey = false, longSecret = false;
  async function flush(line) {
    if (/-----BEGIN .*PRIVATE KEY-----/.test(line)) privateKey = true;
    const hidden = privateKey || longSecret;
    if (/-----END .*PRIVATE KEY-----/.test(line)) privateKey = false;
    await emit(hidden ? '[REDACTED SENSITIVE BLOCK]\n' : redact(line));
    longSecret = !line.endsWith('\n') && (hidden || /(?:password|secret|token|api[_-]?key|authorization)\s*["']?\s*[:=]/i.test(line));
  }
  return async (chunk, end = false) => {
    pending += end ? decoder.end() : decodeChunk(chunk, decoder);
    let i;
    while ((i = pending.indexOf('\n')) >= 0) {
      await flush(pending.slice(0, i + 1)); pending = pending.slice(i + 1); longSecret = false;
    }
    // Keep overlap for credentials fragmented across very long lines; never retain unbounded output.
    while (pending.length > 65536) {
      const ws = pending.lastIndexOf(' ', 32768);
      const cut = ws > 31744 ? ws + 1 : 32768;
      await flush(pending.slice(0, cut)); pending = pending.slice(cut);
    }
    if (end && pending) { await flush(pending); pending = ''; }
  };
}

export async function runProcess({ program, args, cwd, timeoutMs = 900000, signal, onOutput = async () => {}, env = {} }) {
  const start = Date.now();
  if (signal?.aborted) return { status: 'canceled', exitCode: null, durationMs: 0 };
  let child, timedOut = false, canceled = false, spawnError, ioError;
  let stopping;
  const stop = () => stopping ??= stopTree(child);
  try {
    const [executable, argv] = spawnSpec(program, args);
    child = spawn(executable, argv, { cwd, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1', CARGO_TERM_COLOR: 'never', CI: '1', CARGO_BUILD_JOBS: '2', RUSTUP_AUTO_INSTALL: '0', ...env } });
  } catch (e) { return { status: 'blocked', exitCode: null, durationMs: Date.now() - start, reason: e.message }; }
  const abort = () => { canceled = true; void stop(); };
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; void stop(); }, timeoutMs);
  const closed = new Promise(resolve => {
    child.on('error', e => { spawnError = e; });
    child.on('close', (code, exitSignal) => resolve({ code, exitSignal }));
  });
  async function drain(stream, channel) {
    const capture = streamRedactor(text => onOutput(text, channel));
    try { for await (const chunk of stream) await capture(chunk); await capture(null, true); }
    catch (e) { ioError = e; await stop(); }
  }
  const [exit] = await Promise.all([closed, drain(child.stdout, 'stdout'), drain(child.stderr, 'stderr')]);
  clearTimeout(timer); signal?.removeEventListener('abort', abort);
  await stopping;
  const reason = spawnError?.message || ioError?.message || (timedOut ? `Timeout de ${timeoutMs} ms` : canceled ? 'Cancelado por el usuario' : null);
  return { status: canceled ? 'canceled' : timedOut ? 'timeout' : spawnError ? 'blocked' : ioError ? 'error' : exit.code === 0 ? 'passed' : 'failed', exitCode: exit.code, signal: exit.exitSignal, durationMs: Date.now() - start, reason };
}

export async function probe(program, args, cwd) {
  let output = '';
  const result = await runProcess({ program, args, cwd, timeoutMs: 10000, onOutput: async text => { output = (output + text).slice(-12000); } });
  return { ...result, output: output.trim() };
}
