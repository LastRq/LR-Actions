import test from 'node:test';
import assert from 'node:assert/strict';
import { StringDecoder } from 'node:string_decoder';
import { decodeChunk } from '../process.mjs';
test('Salida CP850 de Windows se decodifica; UTF-8 válido no cambia', () => {
  assert.equal(decodeChunk(Buffer.from([0x49,0x4e,0x46,0x4f,0x52,0x4d,0x41,0x43,0x49,0xa2,0x4e]), new StringDecoder('utf8'), true), 'INFORMACIóN');
  assert.equal(decodeChunk(Buffer.from('información'), new StringDecoder('utf8'), true), 'información');
});
