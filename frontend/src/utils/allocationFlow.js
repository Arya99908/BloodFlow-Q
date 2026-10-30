import { validateNetworkAllocation, quantityTotal } from "./networkGraph.js";

export function allocationFlow(scenario, result) {
  if (
    scenario?.synthetic !== true ||
    !validateNetworkAllocation(scenario, result)
  )
    return null;
  const nodes = [],
    links = [],
    byId = new Map();
  const node = (id, label, stage, kind) => {
    if (!byId.has(id)) {
      const n = { id, label, stage, kind, value: 0 };
      nodes.push(n);
      byId.set(id, n);
    }
    return id;
  };
  const link = (source, target, value, kind = "allocation") => {
    if (value > 0) links.push({ source, target, value, kind });
  };
  const banks = scenario.blood_banks.map((bank) => {
    const stock = quantityTotal(bank.inventory),
      rows = result.allocation.filter((a) => a.source === bank.id),
      used = rows.reduce((s, a) => s + a.quantity, 0);
    const bankId = node(`bank:${bank.id}`, bank.name || bank.id, 0, "bank");
    for (const [group, quantity] of Object.entries(bank.inventory)) {
      if (!quantity) continue;
      const inv = node(
        `inventory:${bank.id}:${group}`,
        `${bank.name || bank.id} · ${group}`,
        1,
        "inventory",
      );
      link(bankId, inv, quantity, "inventory");
      const outgoing = rows.filter(
          (a) => a.blood_group === group && a.quantity > 0,
        ),
        allocated = outgoing.reduce((s, a) => s + a.quantity, 0);
      for (const a of outgoing) {
        const compat = node(
          `compatible:${a.blood_group}:${a.recipient_group}`,
          `${a.blood_group} → ${a.recipient_group}`,
          2,
          "compatible",
        );
        const alloc = node(
          `allocation:${a.destination}:${a.recipient_group}`,
          `${a.recipient_group} allocation`,
          3,
          "allocation",
        );
        const hospital = scenario.hospitals.find((h) => h.id === a.destination);
        const target = node(
          `hospital:${a.destination}`,
          hospital.name || hospital.id,
          4,
          "hospital",
        );
        link(inv, compat, a.quantity);
        link(compat, alloc, a.quantity);
        link(alloc, target, a.quantity);
      }
      if (quantity > allocated)
        link(
          inv,
          node("remaining", "Unallocated inventory", 2, "remaining"),
          quantity - allocated,
          "remaining",
        );
    }
    return {
      id: bank.id,
      name: bank.name || bank.id,
      stock,
      used,
      remaining: stock - used,
    };
  });
  const hospitals = scenario.hospitals.map((h) => {
    const demand = quantityTotal(h.demand),
      served = result.allocation
        .filter((a) => a.destination === h.id)
        .reduce((s, a) => s + a.quantity, 0);
    const isCritical = (g) =>
      ["critical", "high"].includes(h.urgency?.[g]?.category);
    return {
      id: h.id,
      name: h.name || h.id,
      demand,
      served,
      unmet: demand - served,
      criticalDemand: Object.entries(h.demand)
        .filter(([g]) => isCritical(g))
        .reduce((s, [, v]) => s + v, 0),
      criticalServed: result.allocation
        .filter((a) => a.destination === h.id && isCritical(a.recipient_group))
        .reduce((s, a) => s + a.quantity, 0),
    };
  });
  const merged = new Map();
  for (const l of links) {
    const key = JSON.stringify([l.source, l.target]);
    if (merged.has(key)) merged.get(key).value += l.value;
    else merged.set(key, { ...l });
  }
  for (const n of nodes)
    n.value = Math.max(
      [...merged.values()]
        .filter((l) => l.source === n.id)
        .reduce((s, l) => s + l.value, 0),
      [...merged.values()]
        .filter((l) => l.target === n.id)
        .reduce((s, l) => s + l.value, 0),
    );
  return {
    nodes: nodes.filter((n) => n.value > 0),
    links: [...merged.values()],
    banks,
    hospitals,
    stock: banks.reduce((s, b) => s + b.stock, 0),
    allocated: banks.reduce((s, b) => s + b.used, 0),
    remaining: banks.reduce((s, b) => s + b.remaining, 0),
    unmet: hospitals.reduce((s, h) => s + h.unmet, 0),
  };
}

// Emergency API stores allocations and aggregate metrics; unmet rows are derived
// from the returned scenario, then checked against the recorded unmet total.
export function emergencyAllocationResult(report, phase = "after") {
  const scenario =
    report?.[phase === "before" ? "original_scenario" : "modified_scenario"];
  const allocation = report?.[`${phase}_allocation`],
    metrics = report?.[`${phase}_metrics`];
  if (!scenario || !Array.isArray(allocation) || metrics?.feasibility !== true)
    return null;
  const unmet_demand = (scenario.hospitals || []).flatMap((h) =>
    Object.entries(h.demand).map(([group, demand]) => ({
      hospital_id: h.id,
      blood_group: group,
      units:
        demand -
        allocation
          .filter((a) => a.destination === h.id && a.recipient_group === group)
          .reduce((s, a) => s + a.quantity, 0),
    })),
  );
  if (
    unmet_demand.reduce((s, r) => s + r.units, 0) !== metrics.total_unmet_demand
  )
    return null;
  const result = {
    scenario_id: scenario.id,
    method: report.method,
    feasibility: true,
    allocation,
    unmet_demand,
  };
  return validateNetworkAllocation(scenario, result) ? result : null;
}
