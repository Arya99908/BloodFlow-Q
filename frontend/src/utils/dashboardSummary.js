import { validateNetworkAllocation } from "./networkGraph.js";

export function summarizeDashboard(scenario, savedResults) {
  const banks = scenario.blood_banks || [];
  const hospitals = scenario.hospitals || [];
  const demand = hospitals.flatMap((hospital) =>
    Object.entries(hospital.demand || {}).map(([group, units]) => ({
      group,
      units,
      urgency: hospital.urgency?.[group]?.category || "unknown",
    })),
  );
  const totalDemand = demand.reduce((sum, item) => sum + item.units, 0);
  // A flagship/custom run or emergency after-state belongs to a different
  // scenario. Revalidate before combining any saved shipment with this baseline.
  const latestRun = [...savedResults]
    .reverse()
    .find(
      (entry) =>
        entry.endpoint === "/optimize" &&
        validateNetworkAllocation(scenario, entry.result),
    );
  const latestPayload = latestRun?.result || null;
  const currentUnmet = latestPayload
    ? latestPayload.unmet_demand.reduce((sum, row) => sum + row.units, 0)
    : null;
  const runStatus = latestPayload?.status || "not_run";
  const satisfactionRate =
    currentUnmet != null && totalDemand > 0
      ? Math.max(
          0,
          Math.round(((totalDemand - currentUnmet) / totalDemand) * 100),
        )
      : null;
  return {
    banks: banks.length,
    hospitals: hospitals.length,
    totalInventory: banks.reduce(
      (sum, bank) =>
        sum +
        Object.values(bank.inventory || {}).reduce(
          (subtotal, units) => subtotal + units,
          0,
        ),
      0,
    ),
    totalDemand,
    criticalDemand: demand
      .filter((item) => ["critical", "high"].includes(item.urgency))
      .reduce((sum, item) => sum + item.units, 0),
    currentUnmet,
    satisfactionRate,
    runStatus,
    latestRun,
    latestAllocation: latestPayload?.allocation,
  };
}
