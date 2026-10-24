import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestRequest } from '../src/utils/latestRequest.js';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const recorder = () => { const events = []; return { events, handlers: { start: () => events.push('start'), success: value => events.push(value), failure: error => events.push(error.message), finish: () => events.push('finish') } }; };
test('new request wins even when an older request finishes last', async () => {
  const runner = createLatestRequest(), old = deferred(), recent = deferred(), log = recorder();
  const first = runner.run(() => old.promise, log.handlers), second = runner.run(() => recent.promise, log.handlers);
  recent.resolve('new data'); await second; old.resolve('stale data'); await first;
  assert.deepEqual(log.events, ['start', 'start', 'new data', 'finish']);
});
test('stale errors cannot erase current loading or data state', async () => {
  const runner = createLatestRequest(), old = deferred(), recent = deferred(), log = recorder();
  const first = runner.run(() => old.promise, log.handlers), second = runner.run(() => recent.promise, log.handlers);
  old.reject(new Error('stale error')); await first;
  assert.deepEqual(log.events, ['start', 'start']);
  recent.reject(new Error('current error')); await second;
  assert.deepEqual(log.events, ['start', 'start', 'current error', 'finish']);
});
test('cleanup ignores pending responses and allows next effect to load', async () => {
  const runner = createLatestRequest(), old = deferred(), log = recorder();
  const pending = runner.run(() => old.promise, log.handlers); runner.invalidate(); old.resolve('unmounted'); await pending;
  assert.deepEqual(log.events, ['start']);
  await runner.run(() => Promise.resolve('remounted'), log.handlers);
  assert.deepEqual(log.events, ['start', 'start', 'remounted', 'finish']);
});
