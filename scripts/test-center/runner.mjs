import { mkdir, open } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { runProcess } from './process.mjs';
import { digest, inspectEnvironment } from './discovery.mjs';
import { diagnose } from './diagnostics.mjs';
import { exportReportToProject, saveReport } from './history.mjs';
import { redact } from './report.mjs';

export const commandOf = step => [step.program, ...step.args].join(' ');
export class Runner {
  constructor(project, root, publish = () => {}) { this.project = project; this.root = root; this.publish = publish; this.state = { running: false, results: [], diagnostics: [] }; }
  cancel() { this.controller?.abort(); }
  async run(plan, profile, fingerprint, options) {
    if (this.state.running) throw Error('Ya hay una ejecución en curso');
    this.controller = new AbortController();
    const started = Date.now();
    const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(4).toString('hex');
    this.state = { schemaVersion: 1, id, project: this.project, profile, profileLabel: profile, fingerprint, options, startedAt: new Date(started).toISOString(), finishedAt: null, running: true, outcome: 'RUNNING', current: null, results: [], diagnostics: [], plan: plan.map(s => ({ id: s.id, label: s.label, command: commandOf(s) })), externalCoverage: ['CI usa plataformas, caches, secretos y acciones que no se reproducen completamente aquí.', 'Compilar Android no ejecuta pruebas físicas ni instrumentadas.'] };
    const report = this.state;
    const folder = join(this.root, id);
    let combined;
    const update = () => { saveReport(this.root, report); this.publish('state'); };
    try {
      await mkdir(join(folder, 'logs'), { recursive: true });
      combined = await open(join(folder, 'console.log'), 'w');
      update();
      report.environment = await inspectEnvironment(this.project);
      Object.assign(report, { commit: report.environment.commit, branch: report.environment.branch, dirty: report.environment.dirty, os: `${report.environment.platform} ${report.environment.arch} ${report.environment.release}` });
      update();
      for (const step of plan) {
        const r = { id: step.id, label: step.label, command: commandOf(step), definitionHash: digest(JSON.stringify(step)), status: 'running', exitCode: null, durationMs: 0, startedAt: new Date().toISOString(), logFile: null, tail: '' };
        report.results.push(r); report.current = step.id;
        const missing = step.requires.filter(id => report.environment.tools[id]?.status !== 'available');
        const dependency = step.dependencies.find(id => report.results.find(x => x.id === id)?.status !== 'passed');
        if (this.controller.signal.aborted) { r.status = 'skipped'; r.reason = 'Ejecución cancelada'; }
        else if (step.network && !options.allowNetwork) { r.status = 'blocked'; r.reason = 'Requiere acceso a red autorizado en Configuración'; }
        else if (missing.length) { r.status = 'blocked'; r.reason = `Requisitos: ${missing.join(', ')}`; }
        else if (dependency) { r.status = 'blocked'; r.reason = `Dependencia no aprobada: ${dependency}`; }
        else if (step.needsDist && !existsSync(join(this.project, 'dist/index.html'))) { r.status = 'blocked'; r.reason = 'No existe dist/index.html'; }
        else {
          r.logFile = `${String(report.results.length).padStart(3, '0')}-${step.id.replace(/[^\w.-]/g, '_')}.log`;
          update();
          const log = await open(join(folder, 'logs', r.logFile), 'w');
          let writing = Promise.resolve();
          const output = (text, channel) => {
            writing = writing.then(async () => {
              await log.write(text); await combined.write(`[${step.id}/${channel}] ${text}`);
              r.tail = (r.tail + text).slice(-65000);
              this.publish('output', { checkId: step.id, channel, text });
            });
            return writing;
          };
          try {
            const args = options.allowNetwork ? step.args.filter(a => a !== '--offline') : step.args;
            r.command = commandOf({ ...step, args });
            const result = await runProcess({ ...step, args, cwd: this.project, timeoutMs: options.timeoutMs, signal: this.controller.signal, onOutput: output, env: { RUSTUP_AUTO_INSTALL: '0' } });
            Object.assign(r, result); await writing;
          } finally { await log.close(); }
        }
        r.finishedAt = new Date().toISOString(); report.diagnostics.push(...diagnose(r)); update();
      }
      report.outcome = this.controller.signal.aborted ? 'CANCELED' : report.results.some(r => ['failed', 'timeout', 'error'].includes(r.status)) ? 'FAILED' : report.results.every(r => r.status === 'passed') && report.results.length ? 'PASSED' : 'INCOMPLETE';
    } catch (e) {
      report.outcome = 'ERROR'; report.internalError = redact(e.message);
      for (const r of report.results) if (r.status === 'running') { r.status = 'error'; r.reason = report.internalError; report.diagnostics.push(...diagnose(r)); }
    } finally {
      try { await combined?.close(); } catch (e) { report.outcome = 'ERROR'; report.internalError = redact(e.message); }
      report.running = false; report.current = null; report.finishedAt = new Date().toISOString(); report.durationMs = Date.now() - started;
      try {
        saveReport(this.root, report, true);
        report.exportedDir = exportReportToProject(this.project, this.root, report);
        saveReport(this.root, report, false);
      } catch (e) { report.outcome = 'ERROR'; report.internalError = `No se pudo guardar/exportar el reporte: ${redact(e.message)}`; }
      this.publish('state');
    }
    return report;
  }
}
