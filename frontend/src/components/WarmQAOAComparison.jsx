import { useMemo, useState } from 'react';
import { Download, Info } from 'lucide-react';
import { useWarmQAOAStudy } from '../hooks/useWarmQAOAStudy';
import { summarizeWarmQAOARuns } from '../utils/warmQAOAMetrics';

const label = (value) => value.replaceAll('_', ' ');
const percent = (value) => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'Unavailable';
const percentagePoints = (value) => Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pp` : 'Unavailable';
const objective = (value) => Number.isFinite(value) ? value.toFixed(2) : 'No feasible sample';
const runCount = (value) => Number.isInteger(value) ? value : 0;
const SCENARIO_LABELS = { demo_emergency_demand_spike_emergency: 'Emergency demand spike' };

export default function WarmQAOAComparison() {
  const { study, error } = useWarmQAOAStudy();
  const [scenarioId, setScenarioId] = useState('normal_reference');
  const scenarios = study?.configuration?.scenarios || [];
  const selected = scenarios.includes(scenarioId) ? scenarioId : scenarios[0];
  const rows = useMemo(() => (study?.results || []).filter((row) => row.scenario_id === selected), [study, selected]);
  const summary = study?.summary?.paired_scenario_summary?.find((row) => row.scenario_id === selected);
  const variantSummaries = summarizeWarmQAOARuns(rows);
  const allScenarioSummaries = study?.summary?.paired_scenario_summary || [];
  const matchedPairs = allScenarioSummaries.reduce((total, item) => total + runCount(item.paired_completed_seeds), 0);
  const scenarioObjectiveQuality = useMemo(() => Object.fromEntries(allScenarioSummaries.map((item) => {
    const scenarioRuns = (study?.results || []).filter((row) => row.scenario_id === item.scenario_id);
    const variants = summarizeWarmQAOARuns(scenarioRuns);
    return [item.scenario_id, variants.map((variant) => ({ variant: variant.variant, median: variant.medianBestFeasibleObjective }))];
  })), [study, allScenarioSummaries]);
  const runs = useMemo(() => {
    const seeds = [...new Set(rows.map((row) => row.seed))].sort((a, b) => a - b);
    return seeds.map((seed) => ({ seed, standard: rows.find((row) => row.seed === seed && row.variant === 'standard'), warm: rows.find((row) => row.seed === seed && row.variant === 'lp_warm_start') }));
  }, [rows]);
  const config = study?.configuration?.qaoa;
  if (error) return <section className="panel warm-study-panel"><p role="status">Warm-start comparison unavailable: {error}</p></section>;
  if (!study) return <section className="panel warm-study-panel" aria-busy="true"><p>Loading paired warm-start experiment…</p></section>;
  if (!summary) return <section className="panel warm-study-panel"><p role="status">No paired warm-start measurements are available for this scenario.</p></section>;
  return <section className="panel warm-study-panel" aria-labelledby="warm-study-title">
    <header className="warm-study-heading"><div><span className="eyebrow">SAVED PAIRED LOCAL SIMULATOR STUDY · {study.summary.scenario_count} SYNTHETIC SCENARIOS</span><h2 id="warm-study-title">Warm-Start QAOA — Paired Experiment</h2><p>Standard uniform-start and LP warm-start share seeds, circuit depth, shots, and optimizer budget. The warm variant adds LP preprocessing; the older confirmatory benchmark below is a separate study.</p></div><a className="button button-secondary button-small" href="/warm-qaoa-paired-20261022.json" download><Download size={14}/> Raw results</a></header>
    <div className="warm-study-study-counts" aria-label="Paired experiment scope"><strong>{study.summary.completed_runs}/{study.summary.run_count}<small>completed method-runs</small></strong><strong>{matchedPairs}<small>matched seed pairs</small></strong><strong>{study.summary.scenario_count}<small>synthetic scenarios</small></strong><strong>{study.summary.paired_seed_count}<small>paired seeds per scenario</small></strong></div>
    <nav className="warm-study-doc-links" aria-label="Warm-start study documents"><a href="/research/warm-qaoa-study-report.md" target="_blank" rel="noreferrer">Experiment report</a><a href="/research/warm-qaoa-reproducibility.md" target="_blank" rel="noreferrer">Reproducibility guide</a></nav>
    <div className="warm-study-controls"><label htmlFor="warm-scenario">Synthetic scenario</label><select id="warm-scenario" className="field-control" value={selected} onChange={(event) => setScenarioId(event.target.value)}>{scenarios.map((scenario) => <option key={scenario} value={scenario}>{SCENARIO_LABELS[scenario] || label(scenario)}</option>)}</select><span>{config.p} layer · {config.shots} shots · {config.max_iterations} optimizer iterations · {config.optimizer}</span></div>
    <div className="warm-study-metrics">
      {variantSummaries.map((item) => { const name = item.variant === 'standard' ? 'Standard' : 'LP warm-start'; const rate = item.meanFeasibleShotRate; const runtime = item.medianRuntimeSeconds; return <article key={item.variant}><strong>{name}</strong><span className="warm-study-rate">{percent(rate)}<small>mean feasible shots</small></span><div className="research-progress" role="img" aria-label={`${name}: ${percent(rate)} feasible samples`}><i style={{ width: `${Math.max(0, Math.min(100, (rate || 0) * 100))}%` }}/></div><small>Median total runtime {runtime == null ? 'Unavailable' : `${(runtime * 1000).toFixed(1)} ms`}</small><small>Completed {item.completed}/{item.attempts} · exact optimum {item.optimumFound}</small></article>; })}
      <article className="warm-study-difference"><strong>Paired change</strong><span className="warm-study-rate">{percentagePoints(summary.mean_paired_difference_warm_minus_standard)}<small>warm-start minus standard</small></span><small>Bootstrap 95% interval: {summary.paired_difference_bootstrap_95_percentile_ci?.map(percentagePoints).join(' to ') || 'Unavailable'}</small><small>Warm higher / tied / lower: {summary.seeds_warm_better} / {summary.seeds_tied} / {summary.seeds_warm_worse} seeds</small></article>
    </div>
    <div className="warm-study-all-cases"><div className="warm-study-cases-title"><h3>Feasible-shot rate across all synthetic cases</h3><span>Mean across paired seeds · bar length is probability</span></div>{allScenarioSummaries.map((item) => { const size = study.configuration.scenario_sizes[item.scenario_id]; const caseName = SCENARIO_LABELS[item.scenario_id] || label(item.scenario_id); const objectiveQuality = scenarioObjectiveQuality[item.scenario_id] || []; const standardQuality = objectiveQuality.find((entry) => entry.variant === 'standard')?.median; const warmQuality = objectiveQuality.find((entry) => entry.variant === 'lp_warm_start')?.median; return <article className="warm-study-case" key={item.scenario_id}><div className="warm-study-case-name"><strong>{caseName}</strong><small>{size.qubo_variables_qubits} qubits · {item.paired_completed_seeds} paired seeds</small></div><div className="warm-study-case-bars"><span>Standard</span><div className="warm-study-track"><i style={{ width: `${Math.max(0, item.standard_mean_feasible_shot_rate * 100)}%` }} /></div><strong>{percent(item.standard_mean_feasible_shot_rate)}</strong><span>LP warm-start</span><div className="warm-study-track warm"><i style={{ width: `${Math.max(0, item.warm_start_mean_feasible_shot_rate * 100)}%` }} /></div><strong>{percent(item.warm_start_mean_feasible_shot_rate)}</strong></div><div className="warm-study-case-quality"><small>Median best feasible objective (lower is better)</small><strong>Standard {objective(standardQuality)} · Warm {objective(warmQuality)}</strong><small>Exact optimum found: {item.standard_optimal_runs}/{item.paired_completed_seeds} standard · {item.warm_start_optimal_runs}/{item.paired_completed_seeds} warm-start</small></div></article>; })}</div>
    <div className="warm-study-table-scroll"><table className="data-table warm-study-table"><thead><tr><th>Seed</th><th>Standard feasible shots</th><th>Warm feasible shots</th><th>Best feasible objective</th><th>Exact reference gap</th><th>Status</th></tr></thead><tbody>{runs.map(({ seed, standard, warm }) => <tr key={seed}><th scope="row">{seed}</th><td>{percent(standard?.feasible_shot_rate)}</td><td>{percent(warm?.feasible_shot_rate)}</td><td>Standard {objective(standard?.best_feasible_objective)} · Warm {objective(warm?.best_feasible_objective)}</td><td>{standard?.optimality_gap == null ? '—' : `${(standard.optimality_gap * 100).toFixed(2)}%`} · {warm?.optimality_gap == null ? '—' : `${(warm.optimality_gap * 100).toFixed(2)}%`}</td><td>{standard?.status || 'Missing'} · {warm?.status || 'Missing'}</td></tr>)}</tbody></table></div>
    <p className="warm-study-caveat"><Info size={14}/> Raw QAOA samples are not feasibility-preserving. Every result is independently decoded and checked; infeasible shots remain in the denominator. The LP seed already matched the exact optimum in all 60 warm runs. This small local Aer study does not establish quantum advantage.</p>
  </section>;
}
