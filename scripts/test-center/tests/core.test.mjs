import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';
import { discover, planChecks } from '../discovery.mjs';
import { runProcess, stopTree, streamRedactor } from '../process.mjs';
import { diagnose, groupDiagnostics } from '../diagnostics.mjs';
import { atomicJson, readReport, recoverHistory, compareReports } from '../history.mjs';
import { Runner } from '../runner.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'identity-center-fixture-'));
  mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { typecheck: 'node pass.cjs', 'test:phase42': 'node fail.cjs', 'test:slow': 'node slow.cjs', 'format:check': 'node pass.cjs', 'test:unsafe': 'prettier --write .', clean: 'rm -rf dist' } }));
  writeFileSync(join(root, 'Cargo.toml'), '[workspace]\nmembers=[]\n');
  writeFileSync(join(root, 'pass.cjs'), 'console.log("fixture stdout"); console.error("fixture stderr");');
  writeFileSync(join(root, 'fail.cjs'), 'console.error("src/a.ts(4,2): error TS2322: fixture failure"); process.exitCode=7;');
  writeFileSync(join(root, 'slow.cjs'), 'console.log("started"); setInterval(()=>{}, 1000);');
  return root;
}
test('descubrimiento real, fase futura, rechazo destructivo y dependencias', () => {
  const catalog = discover(fixture());
  assert.ok(catalog.checks['npm-test:phase42']); assert.equal(catalog.checks['npm-test:unsafe'], undefined);
  assert.equal(catalog.checks['npm-clean'], undefined); assert.equal(catalog.inventory.rejected.length, 1);
  assert.deepEqual(Object.keys(catalog.profiles), ['quick', 'standard', 'full', 'custom']);
  assert.throws(() => planChecks(catalog, 'custom', ['cmd.exe']));
  catalog.checks['npm-test:phase42'].dependencies = ['npm-typecheck'];
  assert.deepEqual(planChecks(catalog, 'custom', ['npm-test:phase42']).map(x => x.id), ['npm-typecheck', 'npm-test:phase42']);
  catalog.checks['npm-typecheck'].dependencies = ['npm-test:phase42'];
  assert.throws(() => planChecks(catalog, 'custom', ['npm-typecheck']), /cíclicas/);
});
test('procesos: stdout, stderr, UTF-8, exit 7 y herramienta ausente', async () => {
  let output = []; const root = fixture();
  const result = await runProcess({ program: process.execPath, args: ['fail.cjs'], cwd: root, onOutput: async (text, channel) => output.push({ text, channel }) });
  assert.equal(result.exitCode, 7); assert.equal(result.status, 'failed'); assert.equal(output[0].channel, 'stderr');
  const pass = await runProcess({ program: process.execPath, args: ['pass.cjs'], cwd: root, onOutput: async (text, channel) => output.push({ text, channel }) });
  assert.equal(pass.status, 'passed'); assert.ok(output.some(x => x.channel === 'stdout'));
  const missing = await runProcess({ program: 'identity-nonexistent-command-418', args: [], cwd: root });
  assert.equal(missing.status, 'blocked');
});
test('timeout mata el árbol y cancelación es distinta de fallo', async () => {
  const root = fixture(); let pid;
  writeFileSync(join(root, 'tree.cjs'), 'const {spawn}=require("node:child_process");const c=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});console.log(c.pid);setInterval(()=>{},1000);');
  const timeout = await runProcess({ program: process.execPath, args: ['tree.cjs'], cwd: root, timeoutMs: 800, onOutput: async text => { pid = Number(text.trim()); } });
  assert.equal(timeout.status, 'timeout'); assert.ok(pid); assert.throws(() => process.kill(pid, 0));
  const controller = new AbortController();
  const canceled = await runProcess({ program: process.execPath, args: ['slow.cjs'], cwd: root, signal: controller.signal, onOutput: async () => controller.abort() });
  assert.equal(canceled.status, 'canceled');
});
test('redacción antes de persistir: token fragmentado, UTF-8 y clave privada multilínea', async () => {
  let value = ''; const capture = streamRedactor(async text => value += text);
  const data = Buffer.from('á🙂\nACCESS_TOKEN=fragmented_secret\n-----BEGIN PRIVATE KEY-----\nprivate-material\n-----END PRIVATE KEY-----\nfin\n');
  for (const byte of data) await capture(Buffer.from([byte]));
  await capture(null, true);
  assert.match(value, /á🙂/); assert.match(value, /fin/); assert.doesNotMatch(value, /fragmented_secret|private-material/);
});
test('diagnóstico conserva evidencia y diferencia hipótesis', () => {
  const ds = diagnose({ id: 'ts', status: 'failed', exitCode: 2, tail: 'src/a.ts(4,2): error TS2322: wrong type' });
  assert.equal(ds[0].category, 'typescript'); assert.equal(ds[0].line, 4); assert.ok(ds[0].hypothesis); assert.match(ds[0].evidence, /TS2322/);
  assert.equal(groupDiagnostics([...ds, ...ds])[0].references.length, 2);
});
test('historial JSON y recuperación no aprueban sesiones interrumpidas', () => {
  const root = fixture(); mkdirSync(join(root, 'run'));
  atomicJson(join(root, 'run/report.json'), { schemaVersion: 1, id: 'run', running: true, finishedAt: null, environment: {}, diagnostics: [], plan: [{ id: 'later', label: 'Later', command: 'node later' }], results: [{ id: 'a', status: 'running', label: 'A', command: 'node a', tail: 'PASSWORD=secret-value' }] });
  recoverHistory(root); const report = readReport(root, 'run');
  assert.equal(report.outcome, 'INTERRUPTED'); assert.equal(report.results[0].status, 'interrupted'); assert.equal(report.results[1].status, 'interrupted');
  assert.doesNotMatch(readFileSync(join(root, 'run/report.json'), 'utf8'), /secret-value/);
  assert.throws(() => readReport(root, '../escape'));
});
test('comparación no presenta bloqueos o comandos diferentes como resueltos', () => {
  const before = { results: [{ id: 'a', status: 'failed', command: 'old' }, { id: 'b', status: 'failed', command: 'b' }] };
  const after = { results: [{ id: 'a', status: 'passed', command: 'new' }, { id: 'b', status: 'blocked', command: 'b' }] };
  const c = compareReports(before, after); assert.deepEqual(c.changed, ['a']); assert.deepEqual(c.resolved, []); assert.deepEqual(c.unverified, ['b']);
});
test('runner: independencia, bloqueo, concurrencia, reportes y ZIP verificable', async () => {
  const root = fixture(), reports = join(root, 'reports'), catalog = discover(root), runner = new Runner(root, reports);
  const plan = planChecks(catalog, 'custom', ['npm-test:phase42', 'npm-typecheck']);
  plan.push({ id: 'blocked', label: 'Blocked', program: 'node', args: [], requires: ['missing'], dependencies: [] });
  const running = runner.run(plan, 'custom', catalog.fingerprint, { timeoutMs: 5000, allowNetwork: false });
  await assert.rejects(runner.run(plan, 'custom', catalog.fingerprint, {}), /ejecución/);
  const r = await running;
  assert.deepEqual(r.results.map(x => x.status), ['failed', 'passed', 'blocked']); assert.equal(r.outcome, 'FAILED');
  const folder = join(reports, r.id);
  for (const file of ['report.md', 'report.json', 'environment.json', 'diagnostics.json', 'manifest.json', 'antigravity-prompt.md', 'console.log', 'report.zip']) assert.ok(existsSync(join(folder, file)), file);
  const zip = readFileSync(join(folder, 'report.zip')); let pos = 0, names = [];
  while (zip.readUInt32LE(pos) === 0x04034b50) {
    const size = zip.readUInt32LE(pos + 18), n = zip.readUInt16LE(pos + 26), extra = zip.readUInt16LE(pos + 28);
    names.push(zip.subarray(pos + 30, pos + 30 + n).toString());
    const unpacked = inflateRawSync(zip.subarray(pos + 30 + n + extra, pos + 30 + n + extra + size)); assert.ok(unpacked.length >= 0);
    pos += 30 + n + extra + size;
  }
  assert.ok(names.includes('antigravity-prompt.md')); assert.ok(names.some(n => n.startsWith('logs/')));
  assert.ok(r.exportedDir && r.exportedDir.includes('.lr-actions'));
  assert.match(r.exportedDir, /\d{4} \d{2} \d{2} \d{2}-\d{2} LOG\([0-9a-f]{8}\) MODE\(CUSTOM\)$/);
  const exportedFiles = readdirSync(r.exportedDir);
  assert.ok(exportedFiles.some(f => /^report-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.md$/.test(f)));
  assert.ok(exportedFiles.some(f => /^report-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/.test(f)));
  assert.ok(exportedFiles.some(f => /^report-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.zip$/.test(f)));
  assert.ok(exportedFiles.includes('console.log') && existsSync(join(r.exportedDir, 'logs')));
  const okRun = await runner.run(planChecks(catalog, 'full').slice(0, 1), 'full', catalog.fingerprint, { timeoutMs: 5000, allowNetwork: false });
  assert.equal(okRun.outcome, 'PASSED');
  assert.match(okRun.exportedDir, /MODE\(FULL\)$/);
});
test('API real: token, origen, SSE, doble inicio y descarga', async t => {
  const root = fixture(), reports = join(root, 'reports');
  const child = spawn(process.execPath, ['scripts/test-center/server.mjs', '--no-browser', '--project', root, '--reports', reports], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => stopTree(child));
  let stderr = ''; child.stderr.on('data', x => stderr += x);
  const url = await new Promise((resolve, reject) => { let output = ''; const timer = setTimeout(() => reject(Error(stderr || 'server timeout')), 15000); child.stdout.on('data', x => { output += x; const m = output.match(/READY_URL=(\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } }); child.on('exit', code => { clearTimeout(timer); reject(Error(`server exit ${code} ${stderr}`)); }); });
  assert.equal((await fetch(new URL('/api/state', url))).status, 404);
  assert.equal((await fetch(url + 'api/state', { headers: { Origin: 'https://example.com' } })).status, 403);
  const state = await (await fetch(url + 'api/state')).json();
  const abort = new AbortController(); const events = await fetch(url + 'events', { signal: abort.signal });
  assert.match(events.headers.get('content-type'), /event-stream/);
  const reader = events.body.getReader(); const first = await reader.read(); assert.match(Buffer.from(first.value).toString(), /event: state/); abort.abort();
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: 'custom', ids: ['npm-typecheck'], fingerprint: state.catalog.fingerprint }) };
  const starts = await Promise.all([fetch(url + 'api/run', options), fetch(url + 'api/run', options)]);
  assert.deepEqual(starts.map(x => x.status).sort(), [202, 409]);
  let final;
  for (let i = 0; i < 150; i++) { final = await (await fetch(url + 'api/state')).json(); if (!final.running) break; await new Promise(r => setTimeout(r, 200)); }
  assert.equal(final.outcome, 'PASSED'); assert.equal((await fetch(url + 'download/report.zip')).status, 200);
  assert.equal(final.history.length, 1);
  await fetch(url + 'api/shutdown', { method: 'POST' });
});
