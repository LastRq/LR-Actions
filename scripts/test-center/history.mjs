import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { makeMarkdownReport, zipReportToFile, redact } from './report.mjs';
import { antigravityPrompt, groupDiagnostics } from './diagnostics.mjs';

export function atomicJson(path, data) {
  const safe = value => typeof value === 'string' ? redact(value) : Array.isArray(value) ? value.map(safe) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k, safe(v)])) : value;
  writeFileSync(`${path}.tmp`, JSON.stringify(safe(data), null, 2), 'utf8');
  renameSync(`${path}.tmp`, path);
}
export function readReport(root, id) {
  if (!/^[\w.-]+$/.test(id)) throw Error('ID inválido');
  const path = join(root, id, 'report.json');
  if (statSync(path).size > 16 * 1024 * 1024) throw Error('Reporte demasiado grande');
  return JSON.parse(readFileSync(path, 'utf8'));
}
export function listHistory(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && !d.isSymbolicLink()).flatMap(d => {
    try { const r = readReport(root, d.name); return [{ id: d.name, profile: r.profile, commit: r.commit, branch: r.branch, startedAt: r.startedAt, finishedAt: r.finishedAt, outcome: r.outcome, counts: counts(r.results), durationMs: r.durationMs }]; } catch { return []; }
  }).sort((a, b) => b.id.localeCompare(a.id));
}
export function counts(results) {
  return Object.fromEntries(['passed', 'failed', 'blocked', 'skipped', 'canceled', 'timeout', 'interrupted', 'error'].map(s => [s, results.filter(r => r.status === s).length]));
}
export function saveReport(root, report, finalize = false) {
  const directory = join(root, report.id); mkdirSync(directory, { recursive: true });
  const safe = { ...report, results: report.results.map(({ tail, ...r }) => ({ ...r, errorExcerpt: tail?.slice(-9000) || r.errorExcerpt || '' })) };
  atomicJson(join(directory, 'report.json'), safe);
  if (!finalize) return;
  writeFileSync(join(directory, 'report.md'), redact(makeMarkdownReport(report)));
  atomicJson(join(directory, 'environment.json'), report.environment || {});
  atomicJson(join(directory, 'diagnostics.json'), { diagnostics: report.diagnostics, groups: groupDiagnostics(report.diagnostics || []) });
  writeFileSync(join(directory, 'antigravity-prompt.md'), antigravityPrompt(report));
  const paths = ['report.json', 'report.md', 'environment.json', 'diagnostics.json', 'antigravity-prompt.md', 'console.log', ...report.results.filter(r => r.logFile).map(r => `logs/${r.logFile}`)];
  const entries = paths.filter(p => existsSync(join(directory, p))).map(p => ({ path: p, bytes: statSync(join(directory, p)).size }));
  atomicJson(join(directory, 'manifest.json'), { schemaVersion: 1, runId: report.id, files: entries, redaction: 'Patrones y bloques de claves privadas; revisar antes de compartir. Nunca se incluye el entorno completo.' });
  try { zipReportToFile(report, directory, join(directory, 'report.zip')); }
  catch (e) { report.archiveError = e.message; atomicJson(join(directory, 'report.json'), { ...safe, archiveError: e.message }); }
}
export function exportReportToProject(project, root, report) {
  const srcDir = join(root, report.id);
  const d = new Date(report.finishedAt || report.startedAt || Date.now());
  const pad = n => String(n).padStart(2, '0');
  const datePart = `${d.getFullYear()} ${pad(d.getMonth() + 1)} ${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}`;
  const dateSlug = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  const logId = String(report.id?.split('-').pop() || '00000000').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8);
  const mode = String(report.profile || 'CUSTOM').replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
  const destDir = join(project, '.lr-actions', `${datePart} LOG(${logId}) MODE(${mode})`);
  mkdirSync(destDir, { recursive: true });
  for (const [src, dst] of [['report.md', `report-${dateSlug}.md`], ['report.json', `report-${dateSlug}.json`], ['report.zip', `report-${dateSlug}.zip`], ['console.log', 'console.log'], ['environment.json', 'environment.json'], ['diagnostics.json', 'diagnostics.json'], ['antigravity-prompt.md', 'antigravity-prompt.md'], ['manifest.json', 'manifest.json']]) {
    const from = join(srcDir, src);
    if (existsSync(from)) copyFileSync(from, join(destDir, dst));
  }
  const logsSrc = join(srcDir, 'logs');
  if (existsSync(logsSrc)) {
    const logsDst = join(destDir, 'logs');
    mkdirSync(logsDst, { recursive: true });
    for (const f of readdirSync(logsSrc)) copyFileSync(join(logsSrc, f), join(logsDst, f));
  }
  return destDir;
}
export function recoverHistory(root) {
  for (const item of listHistory(root)) {
    if (item.finishedAt) continue;
    const report = readReport(root, item.id);
    report.running = false; report.outcome = 'INTERRUPTED'; report.finishedAt = new Date().toISOString();
    report.recovery = 'Sesión sin cierre; no se reejecutó automáticamente ni se asumió éxito.';
    report.results = report.results.map(r => r.status === 'running' ? { ...r, status: 'interrupted', reason: report.recovery } : r);
    for (const step of report.plan || []) if (!report.results.some(r => r.id === step.id)) report.results.push({ id: step.id, label: step.label, command: step.command, status: 'interrupted', exitCode: null, durationMs: 0, reason: report.recovery });
    saveReport(root, report, true);
  }
}
export function compareReports(before, after) {
  const previous = new Map(before.results.map(r => [r.id, r]));
  const current = new Map(after.results.map(r => [r.id, r]));
  const added = [...current.keys()].filter(id => !previous.has(id));
  const removed = [...previous.keys()].filter(id => !current.has(id));
  const changed = [], resolved = [], regressions = [], unverified = [];
  for (const [id, r] of current) {
    const old = previous.get(id); if (!old) continue;
    if (old.command !== r.command || old.definitionHash !== r.definitionHash) { changed.push(id); continue; }
    if (old.status === 'failed' && r.status === 'passed') resolved.push(id);
    if (old.status === 'passed' && r.status === 'failed') regressions.push(id);
    if (!['passed', 'failed'].includes(old.status) || !['passed', 'failed'].includes(r.status)) unverified.push(id);
  }
  return { before: before.id, after: after.id, added, removed, changed, resolved, regressions, unverified, sameEnvironment: before.os === after.os && JSON.stringify(before.environment?.tools) === JSON.stringify(after.environment?.tools), durationDeltaMs: (after.durationMs || 0) - (before.durationMs || 0), warning: 'Comparación por comando y definición; diferencias de suites, dependencias, entorno o commit no prueban causalidad.' };
}
