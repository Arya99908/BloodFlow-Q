export const isNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);
export const label = (value) =>
  ({
    lp: "HiGHS LP",
    milp: "HiGHS MILP",
    exact: "Exact",
    greedy: "Greedy",
    standard: "Standard QAOA",
    warm: "LP warm-start",
    warm_xy: "Warm + XY",
    xy: "XY mixer",
    warm_keep: "Warm + retain",
    warm_zero: "Warm zero angles",
    warm_zero_keep: "Warm zero + retain",
    greedy_warm: "Greedy-seeded QAOA",
  })[value] || String(value).replaceAll("_", " ");
export const classical = (value) =>
  ["lp", "milp", "exact", "greedy"].includes(value);
export const fmt = (value, digits = 2) =>
  isNumber(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "Not recorded";
export function quantile(values, p) {
  const a = values.filter(isNumber).sort((x, y) => x - y);
  if (!a.length) return null;
  const i = (a.length - 1) * p,
    lo = Math.floor(i);
  return a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo);
}
export function statistics(values, { confidence = false } = {}) {
  const a = values.filter(isNumber),
    n = a.length;
  if (!n)
    return {
      n: 0,
      mean: null,
      median: null,
      q1: null,
      q3: null,
      min: null,
      max: null,
      ci: null,
    };
  const mean = a.reduce((s, x) => s + x, 0) / n;
  return {
    n,
    mean,
    median: quantile(a, 0.5),
    q1: quantile(a, 0.25),
    q3: quantile(a, 0.75),
    min: Math.min(...a),
    max: Math.max(...a),
    ci: confidence ? bootstrapCI(a) : null,
  };
}
// A reproducible percentile bootstrap over observations, never fabricated observations.
export function bootstrapCI(values, repetitions = 2000) {
  if (values.length < 3 || !values.every(isNumber)) return null;
  let state = 20261030;
  const next = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const means = Array.from(
    { length: repetitions },
    () =>
      values.reduce((s) => s + values[Math.floor(next() * values.length)], 0) /
      values.length,
  );
  return [quantile(means, 0.025), quantile(means, 0.975)];
}
export function pairedRows(rows, left, right, metric) {
  const key = (row) => `${row.family}|${row.scenario}|${row.seed}`;
  const unique = (solver) => {
    const grouped = new Map();
    rows
      .filter((r) => r.solver === solver && r.seed != null)
      .forEach((r) => {
        const k = key(r);
        grouped.set(k, grouped.has(k) ? null : r);
      });
    return grouped;
  };
  const a = unique(left),
    b = unique(right);
  return [...a].flatMap(([key, x]) => {
    const y = b.get(key);
    if (
      !x ||
      !y ||
      x.status !== "completed" ||
      y.status !== "completed" ||
      !isNumber(x[metric]) ||
      !isNumber(y[metric])
    )
      return [];
    if (
      ["relative_gap", "absolute_gap", "objective"].includes(metric) &&
      (x.feasible !== true || y.feasible !== true)
    )
      return [];
    return [
      {
        key,
        scenario: x.scenario,
        seed: x.seed,
        left: x[metric],
        right: y[metric],
        difference: y[metric] - x[metric],
      },
    ];
  });
}
export function paretoFront(rows) {
  const valid = rows.filter(
    (r) =>
      r.status === "completed" &&
      r.feasible === true &&
      isNumber(r.relative_gap) &&
      isNumber(r.runtime_seconds) &&
      r.runtime_seconds > 0,
  );
  return valid
    .filter(
      (a) =>
        !valid.some(
          (b) =>
            b.runtime_seconds <= a.runtime_seconds &&
            b.relative_gap <= a.relative_gap &&
            (b.runtime_seconds < a.runtime_seconds ||
              b.relative_gap < a.relative_gap),
        ),
    )
    .sort((a, b) => a.runtime_seconds - b.runtime_seconds);
}
export function density(values, points = 40) {
  const a = values.filter(isNumber);
  if (a.length < 3 || Math.min(...a) === Math.max(...a)) return [];
  const s = statistics(a),
    deviation = Math.sqrt(
      a.reduce((t, x) => t + (x - s.mean) ** 2, 0) / (a.length - 1),
    );
  const h = 1.06 * deviation * Math.pow(a.length, -0.2);
  return Array.from({ length: points }, (_, i) => {
    const x = s.min + ((s.max - s.min) * i) / (points - 1);
    return [
      x,
      a.reduce((t, v) => t + Math.exp(-0.5 * ((x - v) / h) ** 2), 0) /
        (a.length * h * Math.sqrt(2 * Math.PI)),
    ];
  });
}
export function validCounts(row) {
  const entries = Object.entries(row?.counts || {});
  return entries.length &&
    entries.every(
      ([bits, n]) =>
        /^[01]+$/.test(bits) &&
        bits.length === row.qubits &&
        Number.isInteger(n) &&
        n > 0,
    ) &&
    entries.reduce((s, [, n]) => s + n, 0) === row.shots
    ? entries.sort((a, b) => b[1] - a[1])
    : [];
}
