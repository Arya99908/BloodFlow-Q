/**
 * Shared scenario calculations matching the backend QUBO and solver constraints.
 */

function binaryWeights(upperBound) {
  if (upperBound <= 0) return [];
  const weights = [];
  let covered = 0;
  while (covered < upperBound) {
    const weight = Math.min(1 << weights.length, upperBound - covered);
    weights.push(weight);
    covered += weight;
  }
  return weights;
}

/**
 * Calculates the exact conservative objective upper bound for a scenario.
 * Penalty weights must strictly exceed this bound (P > bound) to guarantee
 * that constraint violations cannot be favored over valid allocations.
 */
export function calculateObjectiveUpperBound(scenario, weights = {}) {
  if (!scenario || !scenario.routes || !scenario.hospitals || !scenario.blood_banks) {
    return 165.2; // Default conservative bound fallback
  }

  const criticalWeight = weights.critical_unmet_weight ?? 10;
  const totalWeight = weights.total_unmet_weight ?? 5;
  const costWeight = weights.transportation_cost_weight ?? 1;
  const timeWeight = weights.transportation_time_weight ?? 0.1;

  const banksById = Object.fromEntries((scenario.blood_banks || []).map((b) => [b.id, b]));
  const hospitalsById = Object.fromEntries((scenario.hospitals || []).map((h) => [h.id, h]));
  const compat = new Set(
    (scenario.compatibility || [])
      .filter((c) => c.allowed)
      .map((c) => `${c.donor_group}|${c.recipient_group}`)
  );

  let bound = 0.0;
  const routes = (scenario.routes || []).filter((r) => r.status === 'available');

  for (const route of routes) {
    const bank = banksById[route.source];
    const hospital = hospitalsById[route.destination];
    if (!bank || !hospital) continue;

    const coeff = costWeight * Number(route.transport_cost || 0)
      + timeWeight * Number(route.travel_time_minutes || 0);

    for (const bg of scenario.blood_groups || []) {
      for (const rg of scenario.blood_groups || []) {
        if (!compat.has(`${bg}|${rg}`)) continue;
        const inv = Number(bank.inventory?.[bg] || 0);
        const dem = Number(hospital.demand?.[rg] || 0);
        const upperBound = Math.min(inv, dem);
        if (upperBound > 0) {
          bound += coeff * upperBound;
        }
      }
    }
  }

  for (const hospital of scenario.hospitals || []) {
    for (const [group, demand] of Object.entries(hospital.demand || {})) {
      const urgency = hospital.urgency?.[group];
      let coeff = totalWeight;
      if (urgency?.category === 'high' || urgency?.category === 'critical') {
        coeff += criticalWeight * Number(urgency.priority_weight || 1);
      }
      bound += coeff * Number(demand || 0);
    }
  }

  return Number(bound.toFixed(1));
}

/**
 * Calculates the exact number of binary QUBO variables required to encode this scenario.
 */
export function countScenarioQubits(scenario) {
  if (!scenario || !scenario.routes || !scenario.hospitals || !scenario.blood_banks) {
    return 0;
  }

  const banksById = Object.fromEntries((scenario.blood_banks || []).map((b) => [b.id, b]));
  const hospitalsById = Object.fromEntries((scenario.hospitals || []).map((h) => [h.id, h]));
  const compat = new Set(
    (scenario.compatibility || [])
      .filter((c) => c.allowed)
      .map((c) => `${c.donor_group}|${c.recipient_group}`)
  );

  let totalBits = 0;
  const routes = (scenario.routes || []).filter((r) => r.status === 'available');

  for (const route of routes) {
    const bank = banksById[route.source];
    const hospital = hospitalsById[route.destination];
    if (!bank || !hospital) continue;

    for (const bg of scenario.blood_groups || []) {
      for (const rg of scenario.blood_groups || []) {
        if (!compat.has(`${bg}|${rg}`)) continue;
        const inv = Number(bank.inventory?.[bg] || 0);
        const dem = Number(hospital.demand?.[rg] || 0);
        const bound = Math.min(inv, dem);
        if (bound > 0) {
          totalBits += binaryWeights(bound).length;
        }
      }
    }
  }

  for (const hospital of scenario.hospitals || []) {
    for (const demand of Object.values(hospital.demand || {})) {
      if (Number(demand) > 0) {
        totalBits += binaryWeights(Number(demand)).length;
      }
    }
  }

  for (const bank of scenario.blood_banks || []) {
    for (const available of Object.values(bank.inventory || {})) {
      if (Number(available) > 0) {
        totalBits += binaryWeights(Number(available)).length;
      }
    }
  }

  return totalBits;
}

/**
 * Estimates candidate states for the brute-force Exact solver.
 * Capped at 50,000 for performance.
 */
export function estimateCandidateStates(scenario) {
  if (!scenario || !scenario.routes || !scenario.blood_banks || !scenario.hospitals) return 0;
  const banksById = Object.fromEntries((scenario.blood_banks || []).map((b) => [b.id, b]));
  const hospitalsById = Object.fromEntries((scenario.hospitals || []).map((h) => [h.id, h]));
  const compat = new Set(
    (scenario.compatibility || [])
      .filter((c) => c.allowed)
      .map((c) => `${c.donor_group}|${c.recipient_group}`)
  );

  let totalStates = 1;
  const routes = (scenario.routes || []).filter((r) => r.status === 'available');
  for (const route of routes) {
    const bank = banksById[route.source];
    const hospital = hospitalsById[route.destination];
    if (!bank || !hospital) continue;
    for (const bg of scenario.blood_groups || []) {
      for (const rg of scenario.blood_groups || []) {
        if (!compat.has(`${bg}|${rg}`)) continue;
        const inv = Number(bank.inventory?.[bg] || 0);
        const dem = Number(hospital.demand?.[rg] || 0);
        const bound = Math.min(inv, dem);
        if (bound > 0) {
          totalStates *= (bound + 1);
          if (totalStates > 50000) return totalStates;
        }
      }
    }
  }
  return totalStates;
}
