import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDashboard } from '../src/utils/dashboardSummary.js';

const scenario = {
  id: 'baseline', synthetic: true,
  blood_banks: [{ id: 'bank', inventory: { O: 8 } }],
  hospitals: [{ id: 'hospital', demand: { O: 5 }, urgency: { O: { category: 'critical' } } }],
  routes: [{ source: 'bank', destination: 'hospital', status: 'available' }],
  compatibility: [{ donor_group: 'O', recipient_group: 'O', allowed: true }],
};
const result = {
  scenario_id: 'baseline', method: 'milp', status: 'completed', feasibility: true,
  allocation: [{ source: 'bank', destination: 'hospital', blood_group: 'O', recipient_group: 'O', quantity: 3 }],
  unmet_demand: [{ hospital_id: 'hospital', blood_group: 'O', units: 2 }],
  total_unmet_demand: 2,
};
const entry = value => ({ endpoint: '/optimize', result: value });

test('dashboard keeps baseline fulfillment after custom and emergency runs', () => {
  const matched = entry(result);
  const latest = summarizeDashboard(scenario, [matched,
    entry({ ...result, scenario_id: 'flagship', total_unmet_demand: 1 }),
    { endpoint: '/simulate-emergency', result: { modified_scenario: { ...scenario, id: 'emergency' }, after_metrics: { total_unmet_demand: 17 }, after_allocation: [] } },
  ]);
  assert.equal(latest.latestRun, matched);
  assert.equal(latest.currentUnmet, 2);
  assert.equal(latest.totalDemand, 5);
  assert.equal(latest.satisfactionRate, 60);
  assert.equal(latest.latestAllocation, result.allocation);
});

test('a reused scenario ID cannot override inventory and demand validation', () => {
  const stale = { ...result, allocation: [{ ...result.allocation[0], quantity: 6 }], unmet_demand: [] };
  const summary = summarizeDashboard(scenario, [entry(result), entry(stale)]);
  assert.equal(summary.currentUnmet, 2);
  assert.equal(summary.latestAllocation[0].quantity, 3);
});

test('missing, infeasible or incompatible history never becomes zero unmet demand', () => {
  for (const history of [[], [entry({ ...result, feasibility: false })], [entry({ ...result, allocation: [{ ...result.allocation[0], recipient_group: 'A' }] })]]) {
    const summary = summarizeDashboard(scenario, history);
    assert.equal(summary.currentUnmet, null);
    assert.equal(summary.satisfactionRate, null);
    assert.equal(summary.latestAllocation, undefined);
  }
});

test('latest valid rows define fulfillment even if a redundant summary is inconsistent', () => {
  const later = { ...result, allocation: [{ ...result.allocation[0], quantity: 5 }], unmet_demand: [], total_unmet_demand: 99 };
  const summary = summarizeDashboard(scenario, [entry(result), entry(later)]);
  assert.equal(summary.currentUnmet, 0);
  assert.equal(summary.satisfactionRate, 100);
  assert.equal(summary.latestAllocation[0].quantity, 5);
});
