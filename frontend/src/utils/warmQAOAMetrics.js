const VARIANTS = ['standard', 'lp_warm_start'];

function median(values) {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

export function summarizeWarmQAOARuns(rows = []) {
  return VARIANTS.map((variant) => {
    const attempts = rows.filter((row) => row.variant === variant);
    const completed = attempts.filter((row) => row.status === 'completed');
    const rates = completed.filter((row) => Number.isFinite(row.feasible_shot_rate))
      .map((row) => row.feasible_shot_rate);
    const runtimes = attempts.filter((row) => Number.isFinite(row.runtime_seconds))
      .map((row) => row.runtime_seconds).sort((a, b) => a - b);
    const objectives = completed.filter((row) => Number.isFinite(row.best_feasible_objective))
      .map((row) => row.best_feasible_objective).sort((a, b) => a - b);
    return {
      variant,
      attempts: attempts.length,
      completed: completed.length,
      failures: attempts.filter((row) => row.status !== 'completed').length,
      feasibleRuns: objectives.length,
      meanFeasibleShotRate: rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : null,
      meanRuntimeSeconds: runtimes.length ? runtimes.reduce((sum, value) => sum + value, 0) / runtimes.length : null,
      medianRuntimeSeconds: median(runtimes),
      medianBestFeasibleObjective: median(objectives),
      optimumFound: completed.filter((row) => row.known_optimum_found === true).length,
      measuredShots: completed.reduce((sum, row) => sum + (Number.isInteger(row.shots) ? row.shots : 0), 0),
      feasibleShots: completed.reduce((sum, row) => sum + (Number.isInteger(row.feasible_shots) ? row.feasible_shots : 0), 0),
    };
  });
}
