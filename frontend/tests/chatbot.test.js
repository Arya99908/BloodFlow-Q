import test from 'node:test';
import assert from 'node:assert/strict';
import { generateClientDomainResponse } from '../src/services/aiAssistant.js';

const mockScenario = {
  id: 'scen-test',
  blood_banks: [
    { id: 'b1', name: 'Central Blood Bank', location_id: 'LOC-A', inventory: { 'O+': 10, 'A+': 20 } },
    { id: 'b2', name: 'North Depot', location_id: 'LOC-B', inventory: { 'O+': 5, 'B+': 15 } },
  ],
  hospitals: [
    {
      id: 'h1',
      name: 'Memorial Hospital',
      location_id: 'LOC-C',
      demand: { 'O+': 12, 'A+': 5 },
      urgency: { 'O+': { category: 'critical' }, 'A+': { category: 'medium' } },
    },
    {
      id: 'h2',
      name: 'County Clinic',
      location_id: 'LOC-D',
      demand: { 'B+': 25 },
      urgency: { 'B+': { category: 'high' } },
    },
  ],
  routes: [
    { source: 'b1', destination: 'h1', distance_km: 14, transport_time_hours: 0.4, status: 'available' },
    { source: 'b2', destination: 'h2', distance_km: 35, transport_time_hours: 0.9, status: 'blocked' },
  ],
};

test('AI Assistant detects critical shortages and suggests optimization', () => {
  const res = generateClientDomainResponse('What are the critical unmet demands?', { scenario: mockScenario });

  assert.ok(res.reply.includes('Critical Demand'));
  assert.ok(res.reply.includes('Memorial Hospital') || res.reply.includes('County Clinic'));
  assert.ok(res.suggested_actions.some((a) => a.type === 'optimize'));
  assert.ok(res.suggested_actions.some((a) => a.type === 'navigate' && a.payload === 'emergency'));
});

test('AI Assistant provides blood bank inventory breakdown by blood group', () => {
  const res = generateClientDomainResponse('How much O+ blood inventory do we have?', { scenario: mockScenario });

  assert.ok(res.reply.includes('Regional Blood Bank Inventory'));
  assert.ok(res.reply.includes('O+'));
  assert.ok(res.reply.includes('15 units')); // 10 + 5
  assert.ok(res.suggested_actions.some((a) => a.payload === 'blood-banks'));
});

test('AI Assistant explains QAOA quantum formulation and penalty weights', () => {
  const res = generateClientDomainResponse('How do QAOA penalty weights work?', { scenario: mockScenario });

  assert.ok(res.reply.includes('QAOA Quantum Allocation'));
  assert.ok(res.reply.includes('QUBO'));
  assert.ok(/penalt/i.test(res.reply));
  assert.ok(res.suggested_actions.some((a) => a.payload === 'optimization'));
});

test('AI Assistant compares MILP, Greedy, and QAOA solvers', () => {
  const res = generateClientDomainResponse('Compare MILP vs Greedy solvers', { scenario: mockScenario });

  assert.ok(res.reply.includes('Allocation Solvers Compared'));
  assert.ok(res.reply.includes('MILP (HiGHS)'));
  assert.ok(res.reply.includes('Greedy'));
  assert.ok(res.suggested_actions.some((a) => a.payload === 'results'));
});

test('AI Assistant reports route disruptions and blocked corridors', () => {
  const res = generateClientDomainResponse('Are there any blocked routes?', { scenario: mockScenario });

  assert.ok(res.reply.includes('Transport Corridors'));
  assert.ok(res.reply.includes('b2 ➔ h2'));
  assert.ok(res.suggested_actions.some((a) => a.payload === 'network'));
});

test('AI Assistant handles theme toggle action request', () => {
  const res = generateClientDomainResponse('Switch to dark theme', { scenario: mockScenario });

  assert.ok(res.reply.includes('Dark theme') || res.reply.includes('Light theme'));
  assert.ok(res.suggested_actions.some((a) => a.type === 'theme'));
});

test('AI Assistant fallback provides helpful greeting with prompt chips', () => {
  const res = generateClientDomainResponse('Hello', { scenario: mockScenario });

  assert.ok(res.reply.includes('Q-Bot'));
  assert.ok(res.suggested_actions.length > 0);
});
