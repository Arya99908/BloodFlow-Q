import test from 'node:test';
import assert from 'node:assert/strict';
import { solverPresentation } from '../src/utils/solverPresentation.js';
test('legacy skipped timing is never presented as solver execution', () => {
  for (const status of ['skipped_too_large','not_requested','unsupported','error','failed','running','pending','not_run','not_available']) {
    const view = solverPresentation({status, runtime_seconds: 0.0002});
    assert.equal(view.runtime, '—');
    assert.equal(view.measured, false);
    assert.ok(view.explanation);
  }
});
test('completed and infeasible executions retain real measured timings including zero', () => {
  for (const status of ['completed','infeasible']) {
    assert.equal(solverPresentation({status,runtime_seconds:0}).runtime,'0.0000 s');
    assert.equal(solverPresentation({status,runtime_seconds:0.0123}).runtime,'0.0123 s');
    for (const runtime_seconds of [null,undefined,NaN,-1]) assert.equal(solverPresentation({status,runtime_seconds}).runtime,'—');
  }
});
test('unselected, unsupported, missing and failed states have distinct labels', () => {
  const statuses = ['completed','running','skipped_too_large','not_requested','unsupported','failed','not_available'];
  assert.equal(new Set(statuses.map(status=>solverPresentation({status}).label)).size,statuses.length);
});
