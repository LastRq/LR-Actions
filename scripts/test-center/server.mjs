#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, mkdirSync, openSync, closeSync, unlinkSync, lstatSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { discover, digest, inspectEnvironment, planChecks } from './discovery.mjs';
import { Runner } from './runner.mjs';
import { atomicJson, compareReports, listHistory, readReport, recoverHistory } from './history.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const project = resolve(arg('--project') || process.cwd());
const reportsRoot = resolve(arg('--reports') || join(process.env.LOCALAPPDATA || process.env.HOME || dirname(dir), 'IdentityCoreTestCenter', 'reports', digest(project).slice(0, 16)));
let catalog = discover(project);
mkdirSync(reportsRoot, { recursive: true });
const lockPath = join(reportsRoot, 'session.lock');
if (existsSync(lockPath)) {
  const pid = Number(readFileSync(lockPath, 'utf8'));
  let alive = false; try { process.kill(pid, 0); alive = true; } catch (e) { alive = e.code !== 'ESRCH'; }
  if (alive) throw Error('Ya hay otro Test Center para este proyecto. Cierra la sesión anterior.');
  unlinkSync(lockPath);
}
const lock = openSync(lockPath, 'wx');
import { writeSync } from 'node:fs';
writeSync(lock, String(process.pid)); closeSync(lock);
process.on('exit', () => { try { unlinkSync(lockPath); } catch {} });
recoverHistory(reportsRoot);
const settingsPath = join(reportsRoot, 'settings.json');
let settings = { timeoutMs: 900000, allowNetwork: false };
try { const saved = JSON.parse(readFileSync(settingsPath, 'utf8')); if (Number.isInteger(saved.timeoutMs) && saved.timeoutMs >= 100 && saved.timeoutMs <= 7200000 && typeof saved.allowNetwork === 'boolean') settings = saved; } catch {}
let environment = null, inspecting = false;
const clients = new Set();
const prefix = `/${randomBytes(24).toString('hex')}/`;
const runner = new Runner(project, reportsRoot, publish);
const previous = listHistory(reportsRoot)[0];
if (previous) runner.state = { ...readReport(reportsRoot, previous.id), running: false };
function snapshot() { return { ...runner.state, results: runner.state.results.map(({ tail, ...r }) => r), project, reportsRoot, catalog, settings, environment: environment || runner.state.environment, inspecting, history: listHistory(reportsRoot), reportsReady: Boolean(runner.state.finishedAt) }; }
function send(res, event, value) {
  if (res.writableLength > 256 * 1024) { res.destroy(); clients.delete(res); return; }
  res.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
}
function publish(event, value) { for (const res of clients) send(res, event, event === 'state' ? snapshot() : value); }
async function refresh() {
  if (inspecting) return;
  inspecting = true; publish('state');
  try { catalog = discover(project); environment = await inspectEnvironment(project); }
  finally { inspecting = false; publish('state'); }
}
function respond(res, status, value, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
  res.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
}
async function body(req) {
  let text = ''; for await (const part of req) { text += part; if (text.length > 32000) throw Error('Solicitud excesiva'); }
  return JSON.parse(text || '{}');
}
let runningTask = null;
const server = http.createServer(async (req, res) => {
  try {
    const expectedHost = `127.0.0.1:${server.address().port}`;
    if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== `http://${expectedHost}`) || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return respond(res, 403, { error: 'Solo acceso local de la misma sesión' });
    const url = new URL(req.url, `http://${expectedHost}`);
    if (!url.pathname.startsWith(prefix)) return respond(res, 404, { error: 'No encontrado' });
    const route = url.pathname.slice(prefix.length);
    if (req.method === 'GET' && ['', 'app.js', 'style.css'].includes(route)) return respond(res, 200, readFileSync(join(dir, route || 'index.html')), route.endsWith('.js') ? 'text/javascript; charset=utf-8' : route.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
    if (route === 'api/state' && req.method === 'GET') return respond(res, 200, snapshot());
    if (route === 'events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' });
      clients.add(res); send(res, 'state', snapshot()); req.on('close', () => clients.delete(res)); return;
    }
    if (route === 'api/refresh' && req.method === 'POST') {
      if (runner.state.running) return respond(res, 409, { error: 'Espera a que finalice la ejecución' });
      await refresh(); return respond(res, 200, snapshot());
    }
    if (route === 'api/settings' && req.method === 'POST') {
      const options = await body(req);
      if (runner.state.running) return respond(res, 409, { error: 'Hay una ejecución activa' });
      if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 7200000 || typeof options.allowNetwork !== 'boolean') throw Error('Timeout entre 100 y 7200000 ms; allowNetwork booleano');
      settings = { timeoutMs: options.timeoutMs, allowNetwork: options.allowNetwork }; atomicJson(settingsPath, settings); publish('state'); return respond(res, 200, settings);
    }
    if (route === 'api/run' && req.method === 'POST') {
      const options = await body(req);
      if (runner.state.running) return respond(res, 409, { error: 'Ya hay una ejecución en curso' });
      const discovered = discover(project);
      if (options.fingerprint !== discovered.fingerprint) { catalog = discovered; publish('state'); return respond(res, 409, { error: 'El catálogo cambió. Revisa los comandos antes de ejecutar.' }); }
      catalog = discovered;
      const plan = planChecks(catalog, options.profile, options.ids);
      // run() reserves synchronously, after body parsing and validation, before another request can enter.
      runningTask = runner.run(plan, options.profile, catalog.fingerprint, { ...settings });
      void runningTask.catch(e => { runner.state.internalError = e.message; publish('state'); });
      return respond(res, 202, { id: runner.state.id });
    }
    if (route === 'api/cancel' && req.method === 'POST') { runner.cancel(); return respond(res, 202, { ok: true }); }
    if (route === 'api/compare' && req.method === 'GET') return respond(res, 200, compareReports(readReport(reportsRoot, url.searchParams.get('before') || ''), readReport(reportsRoot, url.searchParams.get('after') || '')));
    if (route === 'api/report' && req.method === 'GET') return respond(res, 200, readReport(reportsRoot, url.searchParams.get('id') || ''));
    if (route.startsWith('download/') && req.method === 'GET') {
      const id = url.searchParams.get('id') || runner.state.id;
      const report = readReport(reportsRoot, id || '');
      const file = route.slice(9);
      const allowed = ['report.zip', 'report.md', 'report.json', 'console.log', 'antigravity-prompt.md', 'environment.json', 'diagnostics.json', 'manifest.json', ...report.results.filter(r => r.logFile).map(r => `logs/${r.logFile}`)];
      if (!allowed.includes(file) || file.includes('..') || file.includes('\\')) return respond(res, 404, { error: 'Archivo no permitido' });
      const runDir = join(reportsRoot, id);
      const path = join(runDir, file);
      if (!existsSync(path) || lstatSync(runDir).isSymbolicLink() || lstatSync(path).isSymbolicLink()) return respond(res, 404, { error: 'Archivo no generado o enlace simbólico rechazado; consulta archiveError en report.json' });
      res.writeHead(200, { 'Content-Type': file.endsWith('.zip') ? 'application/zip' : 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.split('/').at(-1)}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      const stream = createReadStream(path); stream.on('error', () => res.destroy()); stream.pipe(res); return;
    }
    if (route === 'api/shutdown' && req.method === 'POST') { respond(res, 202, { ok: true }); void shutdown(); return; }
    respond(res, 404, { error: 'No encontrado' });
  } catch (e) { if (!res.headersSent) respond(res, 400, { error: e.message }); else res.destroy(); }
});
server.requestTimeout = 15000;
server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}${prefix}`;
  console.log(`READY_URL=${url}`);
  console.log(`Reportes: ${reportsRoot}`);
  void refresh().catch(e => console.error(e.message));
  if (!process.argv.includes('--no-browser')) {
    const [cmd, args] = process.platform === 'win32' ? ['powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}'`]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    const child = spawn(cmd, args, { windowsHide: true, stdio: 'ignore', detached: true }); child.on('error', () => {}); child.unref();
  }
});
let closing = false;
async function shutdown() {
  if (closing) return; closing = true;
  runner.cancel(); await runningTask;
  for (const client of clients) client.end(); server.close(() => process.exit(0)); server.closeIdleConnections();
}
if (process.argv.includes('--exit-on-stdin-close')) { process.stdin.resume(); process.stdin.on('end', shutdown); process.stdin.on('error', shutdown); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
