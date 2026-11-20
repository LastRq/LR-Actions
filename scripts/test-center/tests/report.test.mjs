import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, createZip, redact, makeMarkdownReport } from '../report.mjs';

test('No se publican los formatos comunes de credenciales',()=>{
  assert.equal(redact('Authorization: Bearer secret_token_value'), 'Authorization: Bearer [REDACTED]');
  assert.doesNotMatch(redact('github_pat_12345678901234567890123456789'), /github_pat_/);
  assert.doesNotMatch(redact('ACCESS_TOKEN=super_secret_token_here'), /super_secret_token_here/);
});
test('El informe nunca convierte una prueba omitida en aprobada',()=>{
  const report=makeMarkdownReport({profile:'full',profileLabel:'Completas',startedAt:'2026-11-18',finishedAt:'2026-11-18',outcome:'INCOMPLETE',results:[{id:'cargo',label:'Rust',status:'skipped',command:'cargo test',reason:'Faltan herramientas'}],externalCoverage:[]});
  assert.match(report,/INCOMPLETE/);assert.match(report,/SKIPPED/);assert.match(report,/Faltan herramientas/);
});
test('ZIP sin dependencias: cabecera, estructura y CRC32 correctos',()=>{
  const zipped=createZip([{name:'report.md',data:'# test\n'},{name:'logs/test.log',data:'ERROR aquí\n'}]);
  assert.equal(zipped.readUInt32LE(0),0x04034b50);assert.equal(zipped.readUInt32LE(zipped.length-22),0x06054b50);
  assert.equal(zipped.readUInt16LE(zipped.length-12),2);
  assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);
});
