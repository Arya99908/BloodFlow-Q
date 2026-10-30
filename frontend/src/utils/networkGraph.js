export const GRAPH_SIZE = { width: 900, height: 520 };
export const DEFAULT_NETWORK_FILTERS = { query: '', category: 'all', status: 'all', bloodGroup: 'all', neighbors: false, allocatedOnly: false };
export const routeKey = (source, destination) => JSON.stringify([source, destination]);
export const nodeKey = (kind, id) => `${kind}:${id}`;
export const quantityTotal = values => Object.values(values || {}).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);

export function buildNetwork(scenario) {
  const warnings = [];
  const nodes = [];
  for (const [kind, items] of [['bank', scenario?.blood_banks], ['hospital', scenario?.hospitals]]) {
    if (items != null && !Array.isArray(items)) warnings.push(`Invalid ${kind} collection was ignored.`);
    const valid = (Array.isArray(items) ? items : []).filter(item => item && typeof item.id === 'string').sort((a, b) => a.id.localeCompare(b.id));
    const seen = new Set();
    for (const item of valid) {
      if (seen.has(item.id)) { warnings.push(`Duplicate ${kind} identifier ${item.id} was ignored.`); continue; }
      seen.add(item.id);
      const quantities = kind === 'bank' ? item.inventory : item.demand;
      if (!quantities || typeof quantities !== 'object' || Array.isArray(quantities) || Object.values(quantities).some(value => !Number.isInteger(value) || value < 0)) {
        warnings.push(`Invalid quantities for ${kind} ${item.id}; facility was excluded.`);
        continue;
      }
      nodes.push({ ...item, kind, key: nodeKey(kind, item.id), quantities, x: kind === 'bank' ? 190 : 710, y: 100 + (seen.size - 1) * 125 });
    }
  }
  const byKey = new Map(nodes.map(node => [node.key, node]));
  const seenRoutes = new Set();
  const edges = [];
  if (scenario?.routes != null && !Array.isArray(scenario.routes)) warnings.push('Invalid route collection was ignored.');
  for (const route of Array.isArray(scenario?.routes) ? scenario.routes : []) {
    if (!route) { warnings.push('An invalid route was ignored.'); continue; }
    const source = byKey.get(nodeKey('bank', route.source));
    const destination = byKey.get(nodeKey('hospital', route.destination));
    const key = routeKey(route.source, route.destination);
    if (!source || !destination || seenRoutes.has(key)) { warnings.push(`Unresolved or duplicate route ${route.source} → ${route.destination} was ignored.`); continue; }
    seenRoutes.add(key);
    edges.push({ ...route, key, sourceNode: source, destinationNode: destination });
  }
  return { nodes, edges, warnings };
}

export function filterNetwork(graph, filters = DEFAULT_NETWORK_FILTERS, selected = null, allocated = {}) {
  const query = String(filters.query || '').trim().toLowerCase();
  const focus = filters.neighbors && selected?.kind === 'node' ? selected.key : null;
  const incident = new Set(focus ? [focus] : []);
  if (focus) for (const edge of graph.edges) if (edge.sourceNode.key === focus || edge.destinationNode.key === focus) { incident.add(edge.sourceNode.key); incident.add(edge.destinationNode.key); }
  let nodes = graph.nodes.filter(node => (!focus || incident.has(node.key)) && (filters.category === 'all' || node.kind === filters.category) && (filters.bloodGroup === 'all' || (node.quantities[filters.bloodGroup] ?? 0) > 0));
  const keys = new Set(nodes.map(node => node.key));
  let edges = graph.edges.filter(edge => keys.has(edge.sourceNode.key) && keys.has(edge.destinationNode.key) && (filters.status === 'all' || edge.status === filters.status) && (!focus || edge.sourceNode.key === focus || edge.destinationNode.key === focus) && (!filters.allocatedOnly || (allocated[edge.key] || 0) > 0));
  if (query) {
    const matches = new Set(nodes.filter(node => `${node.id} ${node.name || ''} ${node.location_id || ''} ${Object.keys(node.quantities).join(' ')}`.toLowerCase().includes(query)).map(node => node.key));
    edges = edges.filter(edge => matches.has(edge.sourceNode.key) || matches.has(edge.destinationNode.key));
    const context = new Set(edges.flatMap(edge => [edge.sourceNode.key, edge.destinationNode.key]));
    nodes = nodes.filter(node => matches.has(node.key) || context.has(node.key));
  }
  if (filters.status !== 'all' || filters.allocatedOnly) {
    const endpoints = new Set(edges.flatMap(edge => [edge.sourceNode.key, edge.destinationNode.key]));
    nodes = nodes.filter(node => endpoints.has(node.key));
  }
  return { nodes, edges };
}

export function fitNetwork(nodes, size = GRAPH_SIZE) {
  if (!nodes.length) return { x: 0, y: 0, scale: 1 };
  const minX = Math.min(...nodes.map(node => node.x)) - 135;
  const maxX = Math.max(...nodes.map(node => node.x)) + 135;
  const minY = Math.min(...nodes.map(node => node.y)) - 55;
  const maxY = Math.max(...nodes.map(node => node.y)) + 55;
  const scale = Math.min(1.8, Math.max(0.1, Math.min((size.width - 60) / (maxX - minX), (size.height - 60) / (maxY - minY))));
  return { scale, x: size.width / 2 - (maxX + minX) / 2 * scale, y: size.height / 2 - (maxY + minY) / 2 * scale };
}

export function zoomNetwork(view, factor, anchor = { x: GRAPH_SIZE.width / 2, y: GRAPH_SIZE.height / 2 }) {
  const scale = Math.min(4, Math.max(0.1, view.scale * factor));
  const ratio = scale / view.scale;
  return { scale, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio };
}

// Recheck saved proposals against the CURRENT scenario before drawing shipment weights.
// This is a display safeguard, not a replacement for the backend domain validator.
export function validateNetworkAllocation(scenario, result) {
  if (!scenario || result?.scenario_id !== scenario.id || result.feasibility !== true || !Array.isArray(result.allocation) || !Array.isArray(result.unmet_demand)) return null;
  const graph = buildNetwork(scenario);
  if (graph.warnings.length || graph.nodes.some(node => Object.values(node.quantities).some(value => !Number.isInteger(value) || value < 0))) return null;
  const banks = new Map(graph.nodes.filter(n => n.kind === 'bank').map(n => [n.id, n]));
  const hospitals = new Map(graph.nodes.filter(n => n.kind === 'hospital').map(n => [n.id, n]));
  const routes = new Map(graph.edges.map(edge => [edge.key, edge]));
  if (!Array.isArray(scenario.compatibility) || scenario.compatibility.some(row => !row || typeof row.donor_group !== 'string' || typeof row.recipient_group !== 'string' || typeof row.allowed !== 'boolean')) return null;
  const compatibility = new Set(scenario.compatibility.filter(row => row.allowed === true).map(row => routeKey(row.donor_group, row.recipient_group)));
  const used = new Map(), served = new Map(), unmet = new Map(), totals = {};
  const add = (map, key, quantity) => map.set(key, (map.get(key) || 0) + quantity);
  for (const row of result.allocation) {
    if (!row || !Number.isInteger(row.quantity) || row.quantity < 0) return null;
    const key = routeKey(row.source, row.destination);
    if (!banks.has(row.source) || !hospitals.has(row.destination) || routes.get(key)?.status !== 'available' || !compatibility.has(routeKey(row.blood_group, row.recipient_group))) return null;
    if (!Object.hasOwn(banks.get(row.source).quantities, row.blood_group) || !Object.hasOwn(hospitals.get(row.destination).quantities, row.recipient_group)) return null;
    add(used, routeKey(row.source, row.blood_group), row.quantity);
    add(served, routeKey(row.destination, row.recipient_group), row.quantity);
    totals[key] = (totals[key] || 0) + row.quantity;
  }
  for (const row of result.unmet_demand) {
    if (!row || !Number.isInteger(row.units) || row.units < 0 || !hospitals.has(row.hospital_id) || !Object.hasOwn(hospitals.get(row.hospital_id).quantities, row.blood_group)) return null;
    const key = routeKey(row.hospital_id, row.blood_group);
    if (unmet.has(key)) return null;
    unmet.set(key, row.units);
  }
  for (const bank of banks.values()) for (const [group, quantity] of Object.entries(bank.quantities)) if ((used.get(routeKey(bank.id, group)) || 0) > quantity) return null;
  for (const hospital of hospitals.values()) for (const [group, quantity] of Object.entries(hospital.quantities)) if ((served.get(routeKey(hospital.id, group)) || 0) + (unmet.get(routeKey(hospital.id, group)) || 0) !== quantity) return null;
  return { totals, allocation: result.allocation, method: result.method, scenarioId: result.scenario_id, result, used: Object.fromEntries(used), served: Object.fromEntries(served), unmet: Object.fromEntries(unmet) };
}

export function latestNetworkAllocation(scenario, entries = []) {
  if (!Array.isArray(entries)) return null;
  for (const entry of [...entries].reverse()) {
    if (entry?.endpoint !== '/optimize') continue;
    const checked = validateNetworkAllocation(scenario, entry.result);
    if (checked) return { ...checked, createdAt: entry.created_at };
  }
  return null;
}
