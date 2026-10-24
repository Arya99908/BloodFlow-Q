import test from 'node:test';
import assert from 'node:assert/strict';
import { isFiniteMeasurement } from '../src/utils/measurementValues.js';
import { copyText } from '../src/utils/clipboard.js';

test('charts retain measured zero and reject absent or malformed measurements', () => {
  for (const value of [0, 1.5, -2, '0', '1.25']) assert.equal(isFiniteMeasurement(value), true);
  for (const value of [null, undefined, '', '  ', true, false, NaN, Infinity, 'missing', [], {}]) assert.equal(isFiniteMeasurement(value), false);
});

test('clipboard success waits for the browser write instead of reporting early', async () => {
  let resolveWrite; let completed = false; let captured;
  const clipboard = { writeText: text => { captured = text; return new Promise(resolve => { resolveWrite = resolve; }); } };
  const task = copyText('BANK-01', clipboard).then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(captured, 'BANK-01');
  resolveWrite(); await task;
  assert.equal(completed, true);
});

test('clipboard unavailable and denied writes produce actionable errors', async () => {
  await assert.rejects(copyText('BANK-01', {}), /unavailable/);
  await assert.rejects(copyText('BANK-01', { writeText: async () => { throw new Error('denied'); } }), /could not copy/);
});
