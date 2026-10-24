import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QAOA_VARIANTS, qaoaVariantConfig, qaoaConfigLabel, researchMethodRows } from '../src/utils/qaoaVariants.js';
import { api } from '../src/services/api.js';

test('each visible QAOA variant forwards the correct initialization and mixer to the API', async () => {
  const expected = [
    { warm_start: false, mixer: 'x' }, { warm_start: true, mixer: 'x' },
    { warm_start: false, mixer: 'xy' }, { warm_start: true, mixer: 'xy' },
  ];
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, json: async () => ({}) }; };
  try {
    for (const variant of QAOA_VARIANTS) {
      const config = qaoaVariantConfig(variant.id);
      await api.runDemo({ scenario_id: 'normal', method: 'qaoa', qaoa_config: config });
      await api.optimize({ method: 'qaoa', qaoa_config: config });
      await api.benchmark({ include_qaoa: true, qaoa_config: config });
      assert.equal(qaoaConfigLabel(config), variant.label);
    }
    assert.deepEqual(requests.map(row => row.qaoa_config), expected.flatMap(config => [config, config, config]));
  } finally { globalThis.fetch = original; }
});

test('saved research shows every measured method without dropping XY or controls', () => {
  const saved = JSON.parse(readFileSync(new URL('../public/quantum-followup-study.json', import.meta.url)));
  const rows = researchMethodRows(saved.quantum.methods);
  assert.equal(rows.length, 11);
  assert.deepEqual(rows.map(row => row.method), saved.quantum.methods.map(row => row.method));
  for (const [index, row] of rows.entries()) {
    assert.equal(row.mean_p_optimal, saved.quantum.methods[index].mean_p_optimal);
    assert.equal(row.mean_p_feasible, saved.quantum.methods[index].mean_p_feasible);
    assert.ok(row.label);
  }
  assert.match(rows.find(row => row.method === 'xy').label, /XY/);
  assert.match(rows.find(row => row.method === 'warm_xy').label, /Warm-start.*XY/);
  assert.equal(rows.find(row => row.method === 'feasible_grover').type, 'Research prototype');
  assert.equal(researchMethodRows([{ method: 'future_method' }])[0].label, 'future_method');
});

test('missing settings are not labeled as a known standard run', () => {
  assert.match(qaoaConfigLabel(null), /not recorded/);
  assert.match(qaoaConfigLabel({ mixer: 'warm_start' }), /Warm-start/);
  assert.throws(() => qaoaVariantConfig('typo'), /Unknown/);
});
