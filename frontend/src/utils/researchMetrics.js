const METHOD_ORDER = ['classical_multistart', 'qaoa', 'hybrid_qaoa_local_search'];

export function safeRate(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

export function summarizeResearchRows(rows = []) {
  return METHOD_ORDER.map((method) => {
    const attempts = rows.filter((row) => row.method === method);
    // An infeasible candidate is still a completed/evaluated solver trial.
    const completed = attempts.filter((row) => row.status === 'completed' || row.status === 'infeasible');
    const feasible = completed.filter((row) => row.feasibility === true);
    const exactMatches = feasible.filter((row) => Number.isFinite(row.approximation_gap) && row.approximation_gap === 0);
    const runtimes = attempts.map((row) => row.runtime_seconds).filter(Number.isFinite);
    const meanRuntimeSeconds = runtimes.length ? runtimes.reduce((sum, value) => sum + value, 0) / runtimes.length : null;
    return {
      method,
      attempts: attempts.length,
      completed: completed.length,
      feasible: feasible.length,
      infeasible: attempts.filter((row) => row.status === 'infeasible' || (row.status === 'completed' && row.feasibility === false)).length,
      skipped: attempts.filter((row) => row.status?.startsWith('skipped')).length,
      exactMatches: exactMatches.length,
      feasibilityRate: safeRate(feasible.length, completed.length),
      exactMatchRateAmongFeasible: safeRate(exactMatches.length, feasible.length),
      meanRuntimeSeconds,
    };
  });
}

export function formatRuntime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Unavailable';
  if (seconds < 0.001) return `${(seconds * 1000).toFixed(3)} ms`;
  if (seconds < 1) return `${(seconds * 1000).toFixed(1)} ms`;
  return `${seconds.toFixed(2)} s`;
}

export function formatPercent(rate) {
  return Number.isFinite(rate) ? `${(rate * 100).toFixed(1)}%` : 'Unavailable';
}
