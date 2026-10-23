import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveRoute, routePath, NAV_ITEMS } from '../src/navigation.js';
import { api } from '../src/services/api.js';
import { generateClientDomainResponse } from '../src/services/aiAssistant.js';

test('all public navigation routes resolve and malformed URLs show not-found', () => {
  for (const item of NAV_ITEMS) assert.equal(resolveRoute(routePath(item.id)), item.id);
  assert.equal(resolveRoute('/%broken'), 'not-found');
  assert.equal(resolveRoute('/missing-page'), 'not-found');
});

test('API boundary forwards methods, content types, settings and action logs', async () => {
  const calls = []; const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ ok: true }) }; };
  try {
    const config = { method: 'qaoa', qaoa_config: { warm_start: true, mixer: 'xy', seed: 7 } };
    await api.optimize(config); await api.advanceEmergencyRequestDemo([{ action: 'accept_donor', donor_id: 'demo' }], 'arrange_appointment');
    assert.equal(calls[0].url, 'http://127.0.0.1:8000/optimize');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(calls[0].options.body), config);
    assert.deepEqual(JSON.parse(calls[1].options.body), { actions: [{ action: 'accept_donor', donor_id: 'demo' }], action: 'arrange_appointment', donor_id: null });
  } finally { globalThis.fetch = original; }
});

test('offline assistant does not invent zero inventory or claim an action ran', () => {
  const missing = generateClientDomainResponse('inventory');
  assert.match(missing.reply, /no scenario data/i);
  const response = generateClientDomainResponse('run optimization', { scenario: { blood_banks: [], hospitals: [], routes: [] } });
  assert.match(response.reply, /No optimization has started/);
  const route = generateClientDomainResponse('blocked routes', { scenario: { routes: [{ source: 'a', destination: 'b', status: 'blocked', travel_time_minutes: 18, distance_km: 4 }] } });
  assert.match(route.reply, /18 minutes/); assert.doesNotMatch(route.reply, /undefined/);
});

test('follow-up snapshot is sourced from current saved experiment analyses', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../public/quantum-followup-study.json', import.meta.url)));
  const q = JSON.parse(readFileSync(new URL('../../research/quantum_experiments/results/study/analysis.json', import.meta.url)));
  const n = JSON.parse(readFileSync(new URL('../../research/quantum_experiments/results/necessity/analysis.json', import.meta.url)));
  assert.deepEqual(snapshot.quantum.methods, q.aggregate);
  assert.equal(snapshot.replacement.runs, n.records);
  assert.equal(snapshot.kind, 'saved_research_snapshot');
  assert.equal(snapshot.replacement.comparisons.filter(row => row.classical_replacement === 'milp').reduce((sum, row) => sum + row.ties, 0), 60);
});
