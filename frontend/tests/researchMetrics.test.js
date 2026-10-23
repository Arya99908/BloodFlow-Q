import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeResearchRows, safeRate, formatRuntime, formatPercent } from '../src/utils/researchMetrics.js';

const artifact = JSON.parse(await readFile(new URL('../../experiments/results/quantum-value-confirmatory-seed301-20261015.json', import.meta.url), 'utf8'));

test('saved study summary matches raw confirmatory artifact denominators', () => {
  const summary = Object.fromEntries(summarizeResearchRows(artifact.results).map((item) => [item.method, item]));
  assert.deepEqual([summary.classical_multistart.attempts, summary.classical_multistart.completed, summary.classical_multistart.feasible, summary.classical_multistart.exactMatches], [60, 60, 60, 60]);
  assert.deepEqual([summary.qaoa.attempts, summary.qaoa.completed, summary.qaoa.feasible, summary.qaoa.infeasible], [60, 60, 53, 7]);
  assert.deepEqual([summary.hybrid_qaoa_local_search.attempts, summary.hybrid_qaoa_local_search.completed, summary.hybrid_qaoa_local_search.feasible, summary.hybrid_qaoa_local_search.skipped, summary.hybrid_qaoa_local_search.exactMatches], [60, 53, 53, 7, 52]);
});

test('rates and runtime formatting retain denominators, units, and missing values', () => {
  assert.equal(safeRate(53, 60), 53 / 60);
  assert.equal(safeRate(0, 0), null);
  assert.equal(safeRate(1, Number.NaN), null);
  assert.equal(formatPercent(safeRate(53, 60)), '88.3%');
  assert.equal(formatRuntime(0.000746888), '0.747 ms');
  assert.equal(formatRuntime(Number.NaN), 'Unavailable');
});

test('failed, infeasible, skipped, and missing measurements are not coerced to success', () => {
  const summary = summarizeResearchRows([
    { method: 'qaoa', status: 'error', feasibility: null, runtime_seconds: null },
    { method: 'qaoa', status: 'infeasible', feasibility: false, runtime_seconds: 0.2 },
    { method: 'hybrid_qaoa_local_search', status: 'skipped_infeasible_qaoa_seed', feasibility: false },
  ]);
  const qaoa = summary.find((item) => item.method === 'qaoa');
  const hybrid = summary.find((item) => item.method === 'hybrid_qaoa_local_search');
  assert.deepEqual([qaoa.attempts, qaoa.completed, qaoa.feasible, qaoa.infeasible], [2, 1, 0, 1]);
  assert.equal(qaoa.feasibilityRate, 0);
  assert.equal(qaoa.meanRuntimeSeconds, 0.2);
  assert.deepEqual([hybrid.attempts, hybrid.completed, hybrid.skipped, hybrid.feasibilityRate], [1, 0, 1, null]);
});
