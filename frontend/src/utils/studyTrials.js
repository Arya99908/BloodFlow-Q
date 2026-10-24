/** Resolve selectors against actual saved rows, never an assumed seed range. */
export function selectStudyTrials(study, scenarioId, seed) {
  const scenarios = Object.keys(study?.configuration?.scenario_sizes || {});
  const selectedScenario = scenarios.includes(scenarioId) ? scenarioId : scenarios[0] || '';
  const rows = (study?.results || []).filter(row => row.scenario_id === selectedScenario);
  const seeds = [...new Set(rows.filter(row => row.seed != null).map(row => String(row.seed)))].sort((a, b) => Number(a) - Number(b));
  return { scenarios, selectedScenario, seeds, selectedSeed: seeds.includes(seed) ? seed : seeds[0] || '', rows };
}
