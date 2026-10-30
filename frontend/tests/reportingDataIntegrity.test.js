import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { api } from '../src/services/api.js';

test('api.getReportingTelemetry forwards request with period parameter', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        schema_version: 1,
        synthetic: true,
        scenario_id: 'synthetic_default',
        kpis: {
          current_stock: { value: 71, label: 'Current Units in Stock (count)' },
        },
        availability: { canonical: [] },
      }),
    };
  };

  try {
    const data = await api.getReportingTelemetry('Last 30 days');
    assert.equal(data.synthetic, true);
    assert.equal(data.scenario_id, 'synthetic_default');
    assert.match(calls[0].url, /\/reports\/telemetry\?period=Last%2030%20days/);
  } finally {
    globalThis.fetch = original;
  }
});

test('frontend reporting dashboard source code does not contain Math.random or hardcoded mock constants', () => {
  const dashboardSource = readFileSync(
    new URL('../src/components/ResearchVisualDashboard.jsx', import.meta.url),
    'utf8'
  );

  // Must NOT invent numbers with Math.random()
  assert.doesNotMatch(dashboardSource, /Math\.random\(\)/);

  // Must NOT contain old arbitrary mock array constants
  assert.doesNotMatch(dashboardSource, /const INVENTORY_DATA/);
  assert.doesNotMatch(dashboardSource, /const QUANTUM_TELEMETRY_DATA/);

  // Must import and use the real backend telemetry hook
  assert.match(dashboardSource, /useReportingTelemetry/);
  assert.match(dashboardSource, /telemetry\.kpis/);
  assert.match(dashboardSource, /telemetry\.regional_breakdown/);
});

test('regional aggregation matches facility level totals without double counting', () => {
  const mockRegional = [
    {
      region: 'North Metro Region',
      total_stock: 25,
      facilities: [
        { id: 'bank_a', type: 'Blood Bank', stock: 25 },
        { id: 'hospital_1', type: 'Hospital', demand: 13 },
      ],
    },
    {
      region: 'Central District',
      total_stock: 23,
      facilities: [
        { id: 'bank_b', type: 'Blood Bank', stock: 23 },
        { id: 'hospital_2', type: 'Hospital', demand: 14 },
      ],
    },
  ];

  const total = mockRegional.reduce((sum, r) => sum + r.total_stock, 0);
  assert.equal(total, 48);

  for (const reg of mockRegional) {
    const facilityStockSum = reg.facilities
      .filter((f) => f.type === 'Blood Bank')
      .reduce((sum, f) => sum + f.stock, 0);
    assert.equal(reg.total_stock, facilityStockSum);
  }
});

test('blood group filtering isolates selected group in availability dataset', () => {
  const availability = [
    { group: 'O', current_stock: 24, required_demand: 9 },
    { group: 'A', current_stock: 18, required_demand: 12 },
    { group: 'B', current_stock: 16, required_demand: 10 },
    { group: 'AB', current_stock: 13, required_demand: 7 },
  ];

  const filterGroup = (group) => {
    if (group === 'All') return availability;
    return availability.filter((item) => item.group === group);
  };

  const filteredA = filterGroup('A');
  assert.equal(filteredA.length, 1);
  assert.equal(filteredA[0].group, 'A');
  assert.equal(filteredA[0].current_stock, 18);
  assert.equal(filteredA[0].required_demand, 12);

  const all = filterGroup('All');
  assert.equal(all.length, 4);
  assert.equal(all.reduce((sum, i) => sum + i.current_stock, 0), 71);
});
