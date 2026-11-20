import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recoverHistory } from '../history.mjs';

test('Recuperación de un checkpoint previo a la inspección (sin environment)', () => {
  const root = mkdtempSync(join(tmpdir(), 'tc-recover-'));
  mkdirSync(join(root, 'r1'));
  writeFileSync(join(root, 'r1', 'report.json'), JSON.stringify({ id: 'r1', profile: 'quick', startedAt: 'x', results: [], plan: [{ id: 'a', label: 'A', command: 'npm test' }] }));
  recoverHistory(root);
  const report = JSON.parse(readFileSync(join(root, 'r1', 'report.json'), 'utf8'));
  assert.equal(report.outcome, 'INTERRUPTED');
  assert.equal(report.results[0].status, 'interrupted');
  assert.ok(existsSync(join(root, 'r1', 'environment.json')));
});
