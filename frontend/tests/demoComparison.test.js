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

test('uses the actual after-state metrics for emergency solver comparisons', () => {
  const response = {
    method: 'qaoa',
    result: {
      result: {
        method: 'qaoa',
        after_metrics: {
          feasibility: true,
          total_objective: 215.6,
          critical_satisfaction: { rate: 0.75 },
          total_unmet_demand: 4,
          transport_cost: 54,
        },
        after_qaoa: { runtime_seconds: 0.81 },
      },
    },
  };

  assert.deepEqual(getComparableResult(response), {
    method: 'qaoa',
    feasibility: true,
    total_objective: 215.6,
    critical_satisfaction: { rate: 0.75 },
    total_unmet_demand: 4,
    transport_cost: 54,
    after_metrics: response.result.result.after_metrics,
    after_qaoa: response.result.result.after_qaoa,
    runtime_seconds: 0.81,
  });
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
