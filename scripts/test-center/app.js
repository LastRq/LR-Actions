const $ = selector => document.querySelector(selector);
const base = new URL('./', import.meta.url);
let state, selected = new Set(), buffer = [], buffered = 0, renderPending = false;
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
function notify(message) { $('#toast').textContent = message; $('#toast').hidden = false; setTimeout(() => $('#toast').hidden = true, 7000); }
function view(id) { document.querySelectorAll('.view').forEach(e => e.hidden = e.id !== id); document.querySelectorAll('nav button').forEach(e => { if (e.dataset.view === id) e.setAttribute('aria-current', 'page'); else e.removeAttribute('aria-current'); }); }
document.addEventListener('click', e => { const target = e.target.closest('[data-view]'); if (target) view(target.dataset.view); });
async function api(path, data) { const res = await fetch(new URL(`api/${path}`, base), data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const value = await res.json(); if (!res.ok) throw Error(value.error || res.status); return value; }
function action(selector, fn) { $(selector).addEventListener('click', () => Promise.resolve().then(fn).catch(e => notify(e.message))); }
function link(file, label, id = state?.id) { const a = el('a', label); const url = new URL(`download/${file}`, base); if (id) url.searchParams.set('id', id); a.href = url; a.download = ''; return a; }
function table(target, headers, rows) { const t = el('table'), h = el('tr'); headers.forEach(x => h.append(el('th', x))); const head = el('thead'); head.append(h); t.append(head); const body = el('tbody'); rows.forEach(cells => { const tr = el('tr'); cells.forEach(cell => { const td = el('td'); td.append(cell instanceof Node ? cell : el('span', cell ?? '—')); tr.append(td); }); body.append(tr); }); t.append(body); $(target).replaceChildren(t); }
function status(value) { return el('span', value, `status ${value}`); }
function downloads(target, id) { $(target).replaceChildren(link('report.zip', 'Exportar informe completo', id), link('report.md', 'Markdown', id), link('report.json', 'JSON', id), link('console.log', 'Log completo', id)); }
function plan() {
  if (!state) return;
  const profile = $('#profile').value, custom = profile === 'custom';
  const ids = state.catalog.profiles[profile].ids;
  $('#plan-summary').textContent = `${custom ? selected.size : ids.length} seleccionadas. Las dependencias se añaden automáticamente; sin requisitos, una suite queda bloqueada.`;
  table('#plan', ['Selección', 'Suite', 'Comando / script original', 'Requisitos'], ids.map(id => {
    const c = state.catalog.checks[id], box = el('input'); box.type = 'checkbox'; box.checked = custom ? selected.has(id) : true; box.disabled = !custom || state.running; box.setAttribute('aria-label', c.label); box.onchange = () => { box.checked ? selected.add(id) : selected.delete(id); plan(); };
    const command = el('div'); command.append(el('code', [c.program, ...c.args].join(' '))); if (c.script) command.append(el('small', c.script));
    const req = el('div', c.requires.join(', ')); if (c.network) req.append(el('small', 'Requiere red')); if (c.dependencies.length) req.append(el('small', `Depende de: ${c.dependencies.join(', ')}`));
    return [box, c.label, command, req];
  }));
}
function resultTable(target, report) { table(target, ['Suite', 'Estado', 'Duración / exit', 'Comando / motivo', 'Log'], report.results.map(r => { const d = el('div'); d.append(el('code', r.command)); if (r.reason) d.append(el('small', r.reason)); return [r.label, status(r.status), `${(r.durationMs / 1000).toFixed(1)} s / ${r.exitCode ?? '—'}`, d, r.logFile ? link(`logs/${r.logFile}`, r.logFile, report.id) : '—']; })); }
function update(s) {
  state = s;
  $('#project').textContent = s.project; $('#reports-root').textContent = s.reportsRoot;
  const env = s.environment;
  $('#git').textContent = `Rama: ${env?.branch || s.branch || 'desconocida'} · Commit: ${env?.commit || s.commit || 'desconocido'} · Cambios locales: ${(env?.dirty ?? s.dirty) == null ? 'desconocido' : (env?.dirty ?? s.dirty) ? 'sí' : 'no'} · ${env?.platform || '…'} / ${env?.arch || '…'}`;
  $('#metrics').replaceChildren(...[['Aprobadas', ['passed']], ['Fallidas', ['failed', 'timeout', 'error']], ['Omitidas', ['skipped', 'canceled', 'interrupted']], ['Bloqueadas', ['blocked']]].map(([label, kinds]) => { const m = el('div', null, 'metric'); m.append(el('strong', s.results.filter(r => kinds.includes(r.status)).length), el('span', label)); return m; }));
  $('#last-run').textContent = s.startedAt ? `${s.profile} · ${new Date(s.startedAt).toLocaleString()} · ${(s.durationMs / 1000 || 0).toFixed(1)} s` : 'Todavía no hay resultados';
  const full = s.history.find(r => r.profile === 'full' && r.finishedAt);
  $('#last-full').textContent = full ? `Último perfil completo: ${new Date(full.startedAt).toLocaleString()} · ${full.outcome}` : 'Perfil completo: no ejecutado';
  $('#outcome').textContent = `${s.outcome || 'PREPARADO'} ${s.current ? `· ${s.current}` : ''}${s.internalError ? ` · ${s.internalError}` : ''}${s.archiveError ? ` · ZIP: ${s.archiveError}` : ''}`;
  $('#cancel').hidden = !s.running; $('#start').disabled = s.running; $('#retry').disabled = s.running || !s.results.some(r => ['failed', 'timeout', 'blocked', 'error'].includes(r.status)); $('#profile').disabled = s.running; $('#refresh').disabled = s.running || s.inspecting; $('#environment-refresh').disabled = s.running || s.inspecting;
  plan(); resultTable('#results', s);
  if (s.reportsReady) { downloads('#downloads', s.id); $('#antigravity').replaceChildren(link('antigravity-prompt.md', 'Preparar diagnóstico para Antigravity')); }
  else { $('#downloads').replaceChildren(); $('#antigravity').replaceChildren(); }
  if (s.id) $('#console-download').replaceChildren(link('console.log', 'Exportar registro completo'));
  $('#diagnostic-list').replaceChildren(...(s.diagnostics || []).map(d => { const card = el('article', null, 'card'); card.append(el('h2', `${d.category} · ${d.checkId}`), el('p', d.message), el('p', d.hypothesis || 'Sin hipótesis suficiente.'), el('p', d.recommendation), el('pre', d.evidence)); return card; }));
  if (!s.diagnostics?.length) $('#diagnostic-list').append(el('p', 'Sin diagnósticos registrados. Esto no implica cobertura completa.'));
  const logSelect = $('#log-check'), oldCheck = logSelect.value; logSelect.replaceChildren(new Option('Todas', ''), ...s.results.map(r => new Option(r.label, r.id))); logSelect.value = oldCheck;
  table('#history-list', ['Fecha', 'Perfil / commit', 'Resultado', 'Duración', 'Informe'], s.history.map(r => { const button = el('button', 'Consultar'); button.onclick = async () => { try { const report = await api(`report?id=${encodeURIComponent(r.id)}`); $('#history-detail').replaceChildren(el('h2', `${r.id} · ${r.outcome}`)); const links = el('div', null, 'toolbar'); links.append(link('report.zip', 'ZIP', r.id), link('report.md', 'Markdown', r.id), link('report.json', 'JSON', r.id), link('antigravity-prompt.md', 'Antigravity', r.id)); $('#history-detail').append(links, el('pre', JSON.stringify(report.results, null, 2))); } catch (e) { notify(e.message); } }; return [new Date(r.startedAt).toLocaleString(), `${r.profile} / ${r.commit?.slice(0, 10) || '—'}`, r.outcome, `${(r.durationMs / 1000 || 0).toFixed(1)} s`, button]; }));
  for (const selector of ['#compare-before', '#compare-after']) { const select = $(selector), old = select.value; select.replaceChildren(...s.history.map(r => new Option(`${r.startedAt} · ${r.profile} · ${r.commit?.slice(0, 8) || '—'}`, r.id))); if (s.history.some(r => r.id === old)) select.value = old; else if (selector === '#compare-before' && s.history.length > 1) select.selectedIndex = 1; }
  const maximum = Math.max(1, ...s.history.map(r => r.durationMs || 0)); $('#trend').replaceChildren(...s.history.slice(0, 20).reverse().map(r => { const row = el('div', null, 'trend'), meter = el('meter'); meter.min = 0; meter.max = maximum; meter.value = r.durationMs || 0; meter.setAttribute('aria-label', `${r.profile} duración`); row.append(meter, el('span', `${r.profile} · ${new Date(r.startedAt).toLocaleDateString()} · ${(r.durationMs / 1000 || 0).toFixed(1)} s · ${r.outcome}`)); return row; }));
  $('#environment-summary').textContent = s.inspecting ? 'Comprobando herramientas…' : `Comprobado: ${env?.checkedAt || 'pendiente'}`;
  table('#environment-list', ['Herramienta', 'Estado', 'Versión / evidencia', 'Acción'], Object.entries(env?.tools || {}).map(([id, t]) => [id, status(t.status), t.version || '—', t.guidance]));
  $('#devices').textContent = env?.devices || 'No comprobado'; $('#inventory').textContent = JSON.stringify(s.catalog.inventory, null, 2);
  table('#ci', ['Workflow / job', 'Plataforma', 'Evidencia', 'Cobertura local'], s.catalog.ci.map(c => [c.workflow + ' / ' + c.job, c.platform, `${c.line}: ${c.evidence}`, `${c.coverage}\n${c.candidates.join(', ')}`]));
  if (!$('#settings-form').contains(document.activeElement)) { $('#timeout').value = s.settings.timeoutMs / 1000; $('#network').checked = s.settings.allowNetwork; }
}
$('#profile').onchange = plan;
action('#start', async () => { buffer = []; buffered = 0; renderLog(); await api('run', { profile: $('#profile').value, ids: [...selected], fingerprint: state.catalog.fingerprint }); });
action('#retry', async () => { selected = new Set(state.results.filter(r => ['failed', 'timeout', 'blocked', 'error'].includes(r.status) && state.catalog.checks[r.id]).map(r => r.id)); $('#profile').value = 'custom'; plan(); notify('Fallidas seleccionadas. Revisa el plan y pulsa Ejecutar selección.'); });
for (const id of ['#cancel', '#console-cancel']) action(id, () => api('cancel', {}));
for (const id of ['#refresh', '#environment-refresh']) action(id, async () => update(await api('refresh', {})));
action('#shutdown', async () => { await api('shutdown', {}); $('#connection').textContent = 'Sesión cerrándose'; });
$('#settings-form').onsubmit = async e => { e.preventDefault(); try { await api('settings', { timeoutMs: Number($('#timeout').value) * 1000, allowNetwork: $('#network').checked }); notify('Configuración guardada'); } catch (e) { notify(e.message); } };
action('#compare-button', async () => { const c = await api(`compare?before=${encodeURIComponent($('#compare-before').value)}&after=${encodeURIComponent($('#compare-after').value)}`); $('#comparison').replaceChildren(el('p', c.warning), ...[['Resueltos', c.resolved], ['Regresiones observadas', c.regressions], ['Suites añadidas', c.added], ['Suites retiradas', c.removed], ['Comandos cambiados (no comparables)', c.changed], ['No verificables', c.unverified]].map(([label, ids]) => el('p', `${label}: ${ids.length} ${ids.join(', ')}`)), el('p', `Mismo entorno registrado: ${c.sameEnvironment ? 'sí' : 'no'} · Δ duración ${(c.durationDeltaMs / 1000).toFixed(1)} s`)); });
function renderLog() { const id = $('#log-check').value, level = $('#log-level').value, query = $('#log-search').value.toLowerCase(); $('#terminal').textContent = buffer.filter(x => !id || id === x.checkId).flatMap(x => x.text.split('\n').map(line => ({ ...x, line }))).filter(x => (!query || x.line.toLowerCase().includes(query)) && (!level || (level === 'stderr' ? x.channel === 'stderr' : level === 'error' ? /error|failed|panic|not ok/i.test(x.line) : /warn/i.test(x.line)))).map(x => `[${x.checkId}/${x.channel}] ${x.line}`).join('\n'); }
for (const id of ['#log-check', '#log-level', '#log-search']) $(id).addEventListener('input', renderLog);
action('#copy-log', () => navigator.clipboard.writeText($('#terminal').textContent));
action('#first-error', () => { $('#log-level').value = 'error'; renderLog(); $('#terminal').scrollTop = 0; $('#terminal').focus(); });
action('#clear-log', () => { buffer = []; buffered = 0; renderLog(); });
api('state').then(update).catch(e => notify(e.message));
const events = new EventSource(new URL('events', base));
events.onopen = () => $('#connection').textContent = 'Conectado · solo este equipo';
events.addEventListener('state', e => { try { update(JSON.parse(e.data)); } catch (error) { notify(error.message); } });
events.addEventListener('output', e => { const item = JSON.parse(e.data); buffer.push(item); buffered += item.text.length; while (buffered > 180000 && buffer.length) buffered -= buffer.shift().text.length; if (!renderPending) { renderPending = true; setTimeout(() => { renderPending = false; renderLog(); $('#terminal').scrollTop = $('#terminal').scrollHeight; }, 100); } });
events.onerror = () => $('#connection').textContent = 'Sin conexión · reconectando';
