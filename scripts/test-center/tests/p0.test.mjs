import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipReportToFile } from '../report.mjs';
import { streamRedactor } from '../process.mjs';
import { diagnose } from '../diagnostics.mjs';

test('zipReportToFile empaqueta logs mayores a 60 MiB sin fallo por límite de memoria', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tc-bigzip-'));
  try {
    mkdirSync(join(dir, 'logs'), { recursive: true });
    writeFileSync(join(dir, 'report.md'), '# big\n');
    writeFileSync(join(dir, 'logs', 'big.log'), 'A'.repeat(62 * 1024 * 1024));
    const out = join(dir, 'report.zip');
    zipReportToFile({ results: [{ logFile: 'big.log' }] }, dir, out);
    const zip = readFileSync(out);
    assert.equal(zip.readUInt32LE(0), 0x04034b50);
    assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
    assert.equal(zip.readUInt16LE(zip.length - 12), 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('streamRedactor redacta credencial en línea >65 KB cerca del corte de 32 KB', async () => {
  let out = '';
  const push = streamRedactor(s => { out += s; });
  const pad = 'x '.repeat(16380); // ~32760 chars with spaces
  await push(Buffer.from(`${pad}github_pat_12345678901234567890123456789 ${'y'.repeat(34000)}\n`));
  await push(Buffer.alloc(0), true);
  assert.doesNotMatch(out, /github_pat_/);
  assert.match(out, /\[REDACTED\]/);
});

test('diagnose clasifica errores offline de Cargo como toolchain', () => {
  const diags = diagnose({ id: 'rust-tests', status: 'failed', exitCode: 101, tail: 'error: no matching package named `foo` found in offline mode\n', logFile: 'r.log' });
  assert.equal(diags[0].category, 'toolchain');
});
