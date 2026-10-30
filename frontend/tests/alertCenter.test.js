import test from 'node:test';
import assert from 'node:assert/strict';

function detectUrgentRequirements(scenario) {
  const alerts = [];
  const hospitals = scenario?.hospitals || [];
  const routes = scenario?.routes || [];

  // Check critical/high demand
  hospitals.forEach((h) => {
    const demand = h.demand || {};
    const urgency = h.urgency || {};

    Object.entries(demand).forEach(([group, units]) => {
      const u = urgency[group]?.category || '';
      const qty = Number(units || 0);

      if (qty > 0 && ['critical', 'high'].includes(u)) {
        alerts.push({
          id: `demand-${h.id}-${group}`,
          severity: u,
          category: 'demand',
          facility: h.name || h.id,
          bloodGroup: group,
          units: qty,
          actionType: 'optimize',
        });
      }
    });
  });

  // Check blocked routes
  routes.forEach((r) => {
    if (r.status === 'blocked') {
      alerts.push({
        id: `route-${r.source}-${r.destination}`,
        severity: 'high',
        category: 'route',
        source: r.source,
        destination: r.destination,
        actionType: 'emergency',
      });
    }
  });

  return alerts;
}

test('detectUrgentRequirements extracts critical hospital demands', () => {
  const mockScenario = {
    hospitals: [
      {
        id: 'h1',
        name: 'Metro General',
        demand: { 'O+': 8, 'A+': 4 },
        urgency: { 'O+': { category: 'critical' }, 'A+': { category: 'low' } },
      },
      {
        id: 'h2',
        name: 'Valley Care',
        demand: { 'B+': 10 },
        urgency: { 'B+': { category: 'high' } },
      },
    ],
    routes: [],
  };

  const alerts = detectUrgentRequirements(mockScenario);
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].severity, 'critical');
  assert.equal(alerts[0].facility, 'Metro General');
  assert.equal(alerts[0].bloodGroup, 'O+');
  assert.equal(alerts[0].units, 8);
  assert.equal(alerts[1].severity, 'high');
  assert.equal(alerts[1].facility, 'Valley Care');
});

test('detectUrgentRequirements extracts blocked route disruptions', () => {
  const mockScenario = {
    hospitals: [],
    routes: [
      { source: 'b1', destination: 'h1', status: 'available' },
      { source: 'b2', destination: 'h2', status: 'blocked' },
    ],
  };

  const alerts = detectUrgentRequirements(mockScenario);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].category, 'route');
  assert.equal(alerts[0].source, 'b2');
  assert.equal(alerts[0].destination, 'h2');
  assert.equal(alerts[0].actionType, 'emergency');
});

test('detectUrgentRequirements returns empty array when all demands are normal and routes open', () => {
  const mockScenario = {
    hospitals: [
      {
        id: 'h1',
        name: 'Safe Clinic',
        demand: { 'A+': 5 },
        urgency: { 'A+': { category: 'low' } },
      },
    ],
    routes: [{ source: 'b1', destination: 'h1', status: 'available' }],
  };

  const alerts = detectUrgentRequirements(mockScenario);
  assert.equal(alerts.length, 0);
});
