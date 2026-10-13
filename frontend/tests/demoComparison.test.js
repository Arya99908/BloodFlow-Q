import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDemoMetric, getComparableResult } from '../src/utils/demoComparison.js';

test('reads metrics from the current live API response shape', () => {
  const metrics = { total_objective: 82.6, feasibility: true };
  const response = { method: 'qaoa', result: metrics };

  assert.equal(getComparableResult(response), metrics);
});

test('supports a saved experiment wrapped around the API response', () => {
  const metrics = { total_objective: 91.2, feasibility: true };
  const record = { method: 'qaoa', result: { result: metrics } };

  assert.equal(getComparableResult(record), metrics);
});

test('does not turn a missing result into fabricated metrics', () => {
  assert.equal(getComparableResult({ method: 'qaoa' }).method, 'qaoa');
  assert.equal(getComparableResult(null), null);
});

test('preserves computed percentage metrics in before-and-after tables', () => {
  assert.equal(formatDemoMetric('50.0%'), '50.0%');
  assert.equal(formatDemoMetric('37.5%'), '37.5%');
  assert.equal(formatDemoMetric(16), '16');
  assert.equal(formatDemoMetric(null), 'Not available');
});
