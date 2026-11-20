import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { probe } from './process.mjs';

export const digest = value => createHash('sha256').update(value).digest('hex');
export function filesUnder(root, depth = 5) {
  if (!existsSync(root) || depth < 0) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap(e => {
    if (e.isSymbolicLink() || ['node_modules', 'target', '.git', 'gen', 'dist'].includes(e.name)) return [];
    const path = join(root, e.name);
    return e.isDirectory() ? filesUnder(path, depth - 1) : [path];
  });
}

export function discover(project) {
  const pkg = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
  const cargo = readFileSync(join(project, 'Cargo.toml'), 'utf8');
  const checks = {};
  function add(id, label, program, args, extra = {}) {
    checks[id] = { id, label, program, args, group: program === 'npm' ? 'Frontend' : 'Rust', dependencies: [], requires: [program], ...extra };
  }
  const scripts = pkg.scripts || {};
  const rejected = [];
  for (const [name, command] of Object.entries(scripts)) {
    if (!/^(?:test(?::[\w:-]+)?|verify:[\w:-]+|typecheck|lint|format:check|build)$/.test(name)) continue;
    if (typeof command !== 'string') continue;
    // Validation scripts may be arbitrary repository code; show them, but reject explicit destructive/write modes.
    if (/--(?:write|fix)\b|\b(?:rm\s+-|del\s|Remove-Item|npm\s+(?:install|ci|publish)|git\s+(?:push|reset|clean))/.test(command)) { rejected.push({ name, reason: 'Escritura/instalación explícita', command }); continue; }
    add(`npm-${name}`, name, 'npm', ['--ignore-scripts', 'run', name], { source: 'package.json', script: command, group: /phase\d+/.test(name) ? 'Fases' : 'Frontend', aggregate: /^(verify:|test$)/.test(name), requires: ['npm', 'node', 'node_modules'] });
  }
  add('rust-format', 'Rustfmt workspace', 'cargo', ['fmt', '--check'], { requires: ['cargo', 'rustfmt'] });
  add('rust-clippy', 'Clippy estricto', 'cargo', ['clippy', '--locked', '--offline', '--workspace', '--all-targets', '--', '-D', 'warnings'], { requires: ['cargo', 'rustc', 'clippy', 'native'] });
  add('rust-tests', 'Tests Rust workspace', 'cargo', ['test', '--locked', '--offline', '--workspace', '--', '--nocapture'], { requires: ['cargo', 'rustc', 'native'] });
  const manifests = [...filesUnder(join(project, 'crates')), ...filesUnder(join(project, 'apps'))].filter(p => p.endsWith('Cargo.toml'));
  const crates = manifests.map(path => ({ path: relative(project, path).replaceAll('\\', '/'), name: readFileSync(path, 'utf8').match(/^name\s*=\s*"([\w-]+)"/m)?.[1] })).filter(x => x.name);
  for (const crate of crates) {
    if (crate.path.startsWith('crates/')) add(`crate-${crate.name}`, `Tests ${crate.name}`, 'cargo', ['test', '--locked', '--offline', '-p', crate.name, '--', '--nocapture'], { specialized: true, requires: ['cargo', 'rustc', 'native'], source: crate.path });
    if (crate.path.includes('src-tauri/')) {
      const id = crate.path.includes('/mobile/') ? 'mobile' : 'desktop';
      add(`${id}-format`, `Rustfmt ${id}`, 'cargo', ['fmt', '--check', '--manifest-path', crate.path], { requires: ['cargo', 'rustfmt'], source: crate.path });
      if (id === 'desktop') for (const mode of ['check', 'build']) add(`desktop-${mode}`, `Tauri desktop ${mode}`, 'cargo', [mode, '--locked', '--offline', '--manifest-path', crate.path], { requires: ['cargo', 'rustc', 'native'], dependencies: checks['npm-build'] ? ['npm-build'] : [], needsDist: true, source: crate.path });
      else add('android-build', 'Android NDK · tres ABIs', 'cargo', ['ndk', '-t', 'arm64-v8a', '-t', 'armeabi-v7a', '-t', 'x86_64', 'build', '--locked', '--offline', '--lib', '--manifest-path', crate.path], { requires: ['cargo', 'rustc', 'cargo-ndk', 'android-sdk', 'android-ndk', 'android-targets', 'native'], dependencies: checks['npm-build'] ? ['npm-build'] : [], needsDist: true, source: crate.path });
    }
  }
  if (existsSync(join(project, 'package-lock.json'))) add('npm-audit', 'Auditoría npm', 'npm', ['audit'], { network: true });
  for (const lock of ['Cargo.lock', 'apps/desktop/src-tauri/Cargo.lock', 'apps/mobile/src-tauri/Cargo.lock']) {
    if (existsSync(join(project, lock))) add(`audit-${lock.replaceAll('/', '-')}`, `RustSec ${lock}`, 'cargo', ['audit', '--file', lock], { requires: ['cargo', 'cargo-audit'], network: true });
  }
  if (existsSync(join(project, 'deny.toml'))) add('rust-deny', 'Licencias y cadena de suministro', 'cargo', ['deny', 'check'], { requires: ['cargo', 'cargo-deny'], network: true });
  const ids = Object.keys(checks);
  const quick = ['npm-typecheck', 'npm-lint', 'npm-format:check', 'npm-test:contracts', 'rust-format'].filter(id => checks[id]);
  const standard = [...new Set([...quick, ...ids.filter(id => /^npm-test(?::|$)/.test(id)), 'rust-tests'])];
  const full = ids.filter(id => !checks[id].specialized && !id.startsWith('npm-verify:') && id !== 'desktop-check');
  const profiles = {
    quick: { label: 'Rápido', ids: quick }, standard: { label: 'Estándar', ids: standard },
    full: { label: 'Completo', ids: full }, custom: { label: 'Personalizado', ids },
  };
  const workflows = filesUnder(join(project, '.github/workflows'), 1).filter(p => /\.ya?ml$/.test(p)).map(path => ({ path: relative(project, path).replaceAll('\\', '/'), text: readFileSync(path, 'utf8') }));
  const ci = workflows.flatMap(({ path, text }) => {
    let job = '', platform = 'No resuelto (workflow reutilizable/matriz)';
    return text.split('\n').flatMap((line, i) => {
      const j = line.match(/^  ([\w-]+):\s*$/); if (j) { job = j[1]; platform = 'No resuelto (workflow reutilizable/matriz)'; }
      const os = line.match(/^    runs-on:\s*(.+)/); if (os) platform = os[1];
      if (!/\b(?:npm (?:run|test|audit|ci)|cargo (?:test|fmt|clippy|check|build|ndk|audit)|uses:|Sensitive file)/.test(line)) return [];
      const matches = ids.filter(id => { const c = checks[id]; return c.program === 'npm' ? c.args.includes('run') ? line.includes(`npm run ${c.args.at(-1)}`) : line.includes(`npm ${c.args[0]}`) : line.includes(`cargo ${c.args[0]}`); });
      return [{ workflow: path, job, platform, line: i + 1, evidence: line.trim(), candidates: matches, coverage: matches.length ? 'Parcial: revisar flags, dependencias, matriz y entorno' : 'No reproducido localmente' }];
    });
  });
  const inventory = { name: pkg.name, crates, scripts: Object.keys(scripts), rejected, tests: filesUnder(join(project, 'tests')).map(p => relative(project, p)), workflows: workflows.map(x => x.path), sqlcipher: cargo.includes('sqlcipher') };
  const fingerprint = digest(JSON.stringify({ scripts, cargo, manifests: manifests.map(p => readFileSync(p, 'utf8')), workflows }));
  return { checks, profiles, inventory, ci, fingerprint };
}

export async function inspectEnvironment(project) {
  const definitions = { node: ['node', ['--version']], npm: ['npm', ['--version']], git: ['git', ['--version']], rustc: ['rustc', ['--version']], cargo: ['cargo', ['--version']], rustfmt: ['rustfmt', ['--version']], clippy: ['cargo', ['clippy', '--version']], 'cargo-audit': ['cargo', ['audit', '--version']], 'cargo-deny': ['cargo', ['deny', '--version']], 'cargo-ndk': ['cargo', ['ndk', '--version']], perl: ['perl', ['-MConfig', '-e', 'print $Config{osname}']], nasm: ['nasm', ['-v']], adb: ['adb', ['version']], java: ['java', ['-version']] };
  const tools = {};
  // Probe at most three tools at a time, rather than spawning a toolchain stampede.
  const entries = Object.entries(definitions);
  for (let i = 0; i < entries.length; i += 3) await Promise.all(entries.slice(i, i + 3).map(async ([id, [cmd, args]]) => {
    const r = await probe(cmd, args, project);
    tools[id] = { status: r.status === 'passed' ? 'available' : 'missing', version: r.output.slice(0, 800), guidance: `Instala/configura ${id} y vuelve a comprobar el entorno. No se instala automáticamente.` };
  }));
  const major = Number(tools.node.version.match(/v(\d+)/)?.[1]);
  if (major < 22) tools.node.status = 'incompatible';
  const requiredRust = existsSync(join(project, 'rust-toolchain.toml')) ? readFileSync(join(project, 'rust-toolchain.toml'), 'utf8').match(/channel\s*=\s*"([\d.]+)"/)?.[1] : null;
  if (requiredRust && tools.rustc.status === 'available' && !tools.rustc.version.includes(` ${requiredRust} `)) tools.rustc.status = 'incompatible';
  tools.node_modules = { status: existsSync(join(project, 'node_modules/.bin')) ? 'available' : 'missing', guidance: 'Preparar las dependencias del proyecto manualmente (npm ci), solo si confías en él.' };
  for (const [id, vars] of [['android-sdk', ['ANDROID_HOME', 'ANDROID_SDK_ROOT']], ['android-ndk', ['ANDROID_NDK_HOME', 'ANDROID_NDK_ROOT']]]) tools[id] = { status: vars.some(v => process.env[v] && existsSync(process.env[v])) ? 'available' : 'configuration', guidance: `Configura ${vars.join(' o ')} con una instalación existente.` };
  const targets = await probe('rustup', ['target', 'list', '--installed'], project);
  tools['android-targets'] = { status: ['aarch64-linux-android', 'armv7-linux-androideabi', 'x86_64-linux-android'].every(x => targets.output.includes(x)) ? 'available' : 'configuration', version: targets.output, guidance: 'Instala explícitamente los tres targets Android con rustup.' };
  const compiler = await probe(process.platform === 'win32' ? 'where.exe' : 'cc', process.platform === 'win32' ? ['cl.exe'] : ['--version'], project);
  // Cargo/cc localiza Visual Studio sin cl.exe en PATH; vswhere lo detecta sin tocar el entorno.
  if (process.platform === 'win32' && compiler.status !== 'passed') { const vsw = join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'); if (existsSync(vsw)) { const vs = await probe(vsw, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], project); if (vs.status === 'passed' && vs.output?.trim()) Object.assign(compiler, { status: 'passed', output: 'MSVC (vswhere): ' + vs.output.trim() }); } }
  tools.native = { status: compiler.status === 'passed' && tools.perl.status === 'available' && (process.platform !== 'win32' || (tools.perl.version === 'MSWin32' && tools.nasm.status === 'available')) ? 'available' : 'configuration', version: compiler.output, guidance: 'Windows: iniciar desde entorno MSVC x64, Perl nativo y NASM. Linux: compiler/pkg-config/GTK/OpenSSL según CI. La disponibilidad no garantiza enlace correcto.' };
  const devices = tools.adb.status === 'available' ? (await probe('adb', ['devices'], project)).output : 'ADB no disponible';
  const head = await probe('git', ['rev-parse', 'HEAD'], project);
  const branch = await probe('git', ['branch', '--show-current'], project);
  const dirty = await probe('git', ['status', '--porcelain'], project);
  return { checkedAt: new Date().toISOString(), platform: process.platform, arch: process.arch, release: os.release(), tools, devices, commit: head.status === 'passed' ? head.output : null, branch: branch.status === 'passed' ? branch.output : null, dirty: dirty.status === 'passed' ? Boolean(dirty.output) : null };
}

export function planChecks(catalog, profile, selection = []) {
  if (!Object.hasOwn(catalog.profiles, profile)) throw Error('Perfil inválido');
  const selected = profile === 'custom' ? selection : catalog.profiles[profile].ids;
  if (!Array.isArray(selected) || !selected.length || selected.length > 500) throw Error('Selecciona al menos una prueba');
  const ordered = [], visiting = new Set();
  function visit(id) {
    if (!Object.hasOwn(catalog.checks, id)) throw Error('Prueba no descubierta');
    if (visiting.has(id)) throw Error('Dependencias cíclicas');
    if (ordered.includes(id)) return;
    visiting.add(id); for (const dep of catalog.checks[id].dependencies) visit(dep); visiting.delete(id); ordered.push(id);
  }
  selected.forEach(visit);
  return ordered.map(id => catalog.checks[id]);
}
