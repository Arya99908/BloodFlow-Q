export const QAOA_VARIANTS = [
  { id: 'standard', label: 'Standard QAOA · X mixer', warm_start: false, mixer: 'x', description: 'Uniform initial state with the standard X mixer.' },
  { id: 'warm', label: 'Warm-start QAOA · matched mixer', warm_start: true, mixer: 'x', description: 'LP-derived initial state with its matching product-state mixer.' },
  { id: 'xy', label: 'QAOA · XY mixer', warm_start: false, mixer: 'xy', description: 'Uniform initial state with XY exchanges. Experimental: preserves Hamming weight, not allocation feasibility.' },
  { id: 'warm_xy', label: 'Warm-start QAOA · XY mixer', warm_start: true, mixer: 'xy', description: 'LP-derived initial state with XY exchanges. Experimental: samples may violate allocation constraints.' },
];

export function getQAOAVariant(id) {
  const variant = QAOA_VARIANTS.find(item => item.id === id);
  if (!variant) throw new Error(`Unknown QAOA variant: ${id}`);
  return variant;
}

export function qaoaVariantConfig(id) {
  const { warm_start, mixer } = getQAOAVariant(id);
  return { warm_start, mixer };
}

export function qaoaConfigLabel(config) {
  if (!config) return 'QAOA · variant not recorded';
  const warm = config.warm_start || config.mixer === 'warm_start';
  return getQAOAVariant(config.mixer === 'xy' ? (warm ? 'warm_xy' : 'xy') : (warm ? 'warm' : 'standard')).label;
}

export const RESEARCH_METHODS = {
  standard: { label: 'Standard QAOA · X mixer', type: 'Live solver' },
  warm: { label: 'Warm-start QAOA · matched mixer', type: 'Live solver' },
  xy: { label: 'QAOA · XY mixer', type: 'Live solver · experimental' },
  warm_xy: { label: 'Warm-start QAOA · XY mixer', type: 'Live solver · experimental' },
  qubo_cvar: { label: 'QUBO QAOA · CVaR objective', type: 'Research prototype' },
  reduced: { label: 'Shipment-only encoding', type: 'Research prototype' },
  reduced_cvar: { label: 'Shipment-only encoding · CVaR', type: 'Research prototype' },
  feasible_grover: { label: 'Feasible-subspace Grover mixer', type: 'Research prototype' },
  transfer_only: { label: 'Transferred parameters', type: 'Research control' },
  random_schedule: { label: 'Random parameter schedule', type: 'Research control' },
  reduced_cvar_shot: { label: 'Shipment-only encoding · finite-shot CVaR', type: 'Research control' },
};

export function researchMethodRows(methods) {
  return methods.map(row => ({ ...row, ...(RESEARCH_METHODS[row.method] || { label: row.method, type: 'Recorded research method' }) }));
}
