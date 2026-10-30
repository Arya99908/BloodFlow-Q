/**
 * Return the metric object used by the Demo Mode comparison table.
 *
 * Live `/demo-run` responses store metrics in `record.result`. Some older
 * saved experiment records wrap that API response in another `result` field.
 * Handling both shapes keeps real values visible without inventing defaults.
 */
export function getComparableResult(record) {
  let result = record ?? null;
  // API responses can be wrapped by either Demo Mode or a saved experiment.
  // Unwrap every result envelope before interpreting the metric fields.
  for (let depth = 0; depth < 3; depth += 1) {
    const nested = result?.result;
    if (!nested || typeof nested !== 'object') break;
    result = nested;
  }

  if (!result || typeof result !== 'object') return null;

  // Emergency runs put the metrics for the newly optimized state under
  // `after_metrics`. Flatten those same returned values for the comparison
  // table; otherwise it incorrectly labels a feasible QAOA sample infeasible
  // and prints its metrics as unavailable.
  if (result.after_metrics && typeof result.after_metrics === 'object') {
    return {
      ...result,
      ...result.after_metrics,
      runtime_seconds: result.after_qaoa?.runtime_seconds ?? result.runtime_seconds,
    };
  }

  return result;
}

/** Keep preformatted percentages intact while formatting numeric metrics. */
export function formatDemoMetric(value) {
  if (typeof value === 'string' && /^\d+(?:\.\d+)?%$/.test(value.trim())) return value;
  if (value == null || !Number.isFinite(Number(value))) return 'Not available';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
}
