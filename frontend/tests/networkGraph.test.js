import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildNetwork, filterNetwork, fitNetwork, zoomNetwork, DEFAULT_NETWORK_FILTERS as defaults, routeKey, nodeKey, validateNetworkAllocation, latestNetworkAllocation } from '../src/utils/networkGraph.js';
const fixture = () => ({ id: 'test', blood_banks: [{ id: 'b', name: 'Central bank', location_id: 'north', inventory: { O: 4, A: 0 } }, { id: 'c', name: 'West bank', inventory: { O: 3, A: 1 } }], hospitals: [{ id: 'h', name: 'City hospital', demand: { O: 3, A: 2 } }, { id: 'i', name: 'Hill hospital', demand: { O: 1, A: 0 } }], routes: [{ source: 'b', destination: 'h', status: 'available' }, { source: 'b', destination: 'i', status: 'blocked' }, { source: 'c', destination: 'h', status: 'available' }], compatibility: [{ donor_group: 'O', recipient_group: 'O', allowed: true }, { donor_group: 'O', recipient_group: 'A', allowed: true }, { donor_group: 'A', recipient_group: 'A', allowed: true }] });
const feasible = () => ({ scenario_id: 'test', feasibility: true, method: 'greedy', allocation: [{ source: 'b', destination: 'h', blood_group: 'O', recipient_group: 'O', quantity: 3 }, { source: 'c', destination: 'h', blood_group: 'A', recipient_group: 'A', quantity: 1 }], unmet_demand: [{ hospital_id: 'h', blood_group: 'O', units: 0 }, { hospital_id: 'h', blood_group: 'A', units: 1 }, { hospital_id: 'i', blood_group: 'O', units: 1 }, { hospital_id: 'i', blood_group: 'A', units: 0 }] });

test('layout is deterministic across input ordering and filters retain original coordinates', () => {
  const s = fixture(), graph = buildNetwork(s);
  assert.deepEqual(buildNetwork({ ...s, blood_banks: [...s.blood_banks].reverse() }).nodes, graph.nodes);
  const selected = filterNetwork(graph, { ...defaults, query: 'north' });
  assert.deepEqual(selected.nodes.map(n => n.key), ['bank:b', 'hospital:h', 'hospital:i']);
  assert.equal(selected.nodes[0], graph.nodes[0]);
  assert.equal(selected.edges.length, 2);
});

test('status, category, group, direct-neighbor and allocation filters use real attributes', () => {
  const graph = buildNetwork(fixture());
  const blocked = filterNetwork(graph, { ...defaults, status: 'blocked' });
  assert.equal(blocked.edges.length, 1); assert.equal(blocked.nodes.length, 2);
  assert.equal(filterNetwork(graph, { ...defaults, category: 'bank' }).edges.length, 0);
  assert.deepEqual(filterNetwork(graph, { ...defaults, bloodGroup: 'A' }).nodes.map(n => n.key), ['bank:c', 'hospital:h']);
  assert.equal(filterNetwork(graph, { ...defaults, neighbors: true }, { kind: 'node', key: nodeKey('bank', 'c') }).edges.length, 1);
  assert.equal(filterNetwork(graph, { ...defaults, query: 'does not exist' }).nodes.length, 0);
  assert.equal(filterNetwork(graph, { ...defaults, allocatedOnly: true }, null, { [routeKey('c', 'h')]: 2 }).edges.length, 1);
});

test('fit includes complete node bounds and zoom keeps the anchored world point fixed', () => {
  const nodes = buildNetwork(fixture()).nodes, view = fitNetwork(nodes);
  for (const node of nodes) {
    assert.ok((node.x - 110) * view.scale + view.x >= 0);
    assert.ok((node.x + 110) * view.scale + view.x <= 900);
    assert.ok((node.y - 37) * view.scale + view.y >= 0);
    assert.ok((node.y + 37) * view.scale + view.y <= 520);
  }
  const anchor = { x: 220, y: 180 }, zoom = zoomNetwork(view, 1.2, anchor);
  assert.ok(Math.abs((anchor.x - view.x) / view.scale - (anchor.x - zoom.x) / zoom.scale) < 1e-8);
  assert.equal(zoomNetwork(view, 10000).scale, 4);
  assert.equal(zoomNetwork(view, 0.00001).scale, 0.1);
  assert.deepEqual(fitNetwork([]), { x: 0, y: 0, scale: 1 });
});

test('malformed graph endpoints and duplicate IDs are diagnosed instead of silently drawn', () => {
  const s = fixture(); s.blood_banks.push(s.blood_banks[0]); s.routes.push({ source: 'missing', destination: 'h' });
  const graph = buildNetwork(s);
  assert.equal(graph.nodes.length, 4); assert.equal(graph.edges.length, 3); assert.equal(graph.warnings.length, 2);
});

test('allocation overlay requires matching scenario and current feasibility constraints', () => {
  const s = fixture(), valid = feasible();
  assert.equal(validateNetworkAllocation(s, valid).totals[routeKey('b', 'h')], 3);
  assert.equal(validateNetworkAllocation(s, { ...valid, scenario_id: 'other' }), null);
  assert.equal(validateNetworkAllocation(s, { ...valid, feasibility: false }), null);
  for (const change of [
    row => { row.quantity = 5; },
    row => { row.destination = 'i'; },
    row => { row.blood_group = 'AB'; },
    row => { row.quantity = 1.2; },
    row => { row.quantity = -1; },
  ]) {
    const bad = structuredClone(valid); change(bad.allocation[0]); assert.equal(validateNetworkAllocation(s, bad), null);
  }
  const wrongUnmet = structuredClone(valid); wrongUnmet.unmet_demand[0].units = 2;
  assert.equal(validateNetworkAllocation(s, wrongUnmet), null);
  assert.equal(validateNetworkAllocation({ ...s, compatibility: [] }, valid), null);
});

test('overlay selects latest usable optimize proposal and never interprets missing as zero', () => {
  const s = fixture(), old = feasible(), recent = feasible(); recent.method = 'milp';
  const entries = [{ endpoint: '/optimize', created_at: 'older', result: old }, { endpoint: '/optimize', created_at: 'new', result: recent }, { endpoint: '/optimize', result: { ...recent, feasibility: false } }];
  assert.equal(latestNetworkAllocation(s, entries).method, 'milp');
  assert.equal(latestNetworkAllocation(s, [{ endpoint: '/demo-run', result: recent }]), null);
  assert.equal(latestNetworkAllocation(s), null);
});

test('bundled production scenario graphs have resolvable data and every route stays visible without filters', () => {
  const load = name => JSON.parse(readFileSync(new URL(`../../data/${name}.json`, import.meta.url)));
  const s = { ...load('blood_banks'), ...load('hospitals'), ...load('routes') };
  // The scenario API normalizes source-file demand rows into group quantities.
  s.hospitals = s.hospitals.map(h => ({ ...h, demand: Object.fromEntries(h.demand.map(row => [row.blood_group, row.units])) }));
  const graph = buildNetwork(s), visible = filterNetwork(graph);
  assert.deepEqual(graph.warnings, []);
  assert.equal(visible.edges.length, s.routes.length);
  assert.equal(visible.nodes.length, s.blood_banks.length + s.hospitals.length);
});


test('malformed scenario quantities and compatibility never produce a fabricated allocation overlay', () => {
  for (const invalid of [undefined, null, '4', [4], { O: -1 }, { O: NaN }]) {
    const s = fixture(); s.blood_banks[0].inventory = invalid;
    assert.ok(buildNetwork(s).warnings.some(message => message.includes('Invalid quantities')));
    assert.equal(validateNetworkAllocation(s, feasible()), null);
  }
  assert.equal(validateNetworkAllocation({ ...fixture(), compatibility: [null] }, feasible()), null);
  assert.equal(latestNetworkAllocation(fixture(), { results: [] }), null);
  assert.equal(latestNetworkAllocation(fixture(), [null]), null);
});

test('changed stock invalidates an otherwise feasible historical proposal', () => {
  const changed = fixture(); changed.blood_banks[0].inventory.O = 2;
  assert.equal(latestNetworkAllocation(changed, [{ endpoint: '/optimize', result: feasible() }]), null);
});

test('fit and filters handle a 24-bank 24-hospital graph without dropping routes', () => {
  const s = { blood_banks: [], hospitals: [], routes: [] };
  for (let i = 0; i < 24; i++) {
    s.blood_banks.push({ id: `b${i}`, inventory: { O: 5 } });
    s.hospitals.push({ id: `h${i}`, demand: { O: 4 } });
    for (let j = 0; j < 24; j++) s.routes.push({ source: `b${i}`, destination: `h${j}`, status: 'available' });
  }
  const graph = buildNetwork(s), view = fitNetwork(graph.nodes);
  assert.equal(graph.nodes.length, 48); assert.equal(filterNetwork(graph).edges.length, 576);
  for (const node of graph.nodes) {
    assert.ok((node.y - 37) * view.scale + view.y >= 0);
    assert.ok((node.y + 37) * view.scale + view.y <= 520);
  }
});
