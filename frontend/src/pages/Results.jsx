import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Clock3, Play, RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';

const METHODS = ['greedy', 'exact', 'qaoa'];
const methodNames = { greedy: 'Greedy', exact: 'Exact', qaoa: 'QAOA' };

export default function Results() {
  const { data, loading, error, reload } = useApi(api.getResults, []);
  const { data: scenario, loading: scenarioLoading } = useApi(api.getScenario, []);
  const { data: experimentDefaults } = useApi(api.getExperimentDefaults, []);
  const [includeQAOA, setIncludeQAOA] = useState(false);
  const [inventoryPenalty, setInventoryPenalty] = useState('');
  const [demandPenalty, setDemandPenalty] = useState('');
  const [records, setRecords] = useState(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState('');
  const [objectiveWeights, setObjectiveWeights] = useState({ critical_unmet_weight: 10, total_unmet_weight: 5, transportation_cost_weight: 1, transportation_time_weight: 0.1, secondary_penalty_weight: 0 });
  const [qaoaConfig, setQaoaConfig] = useState({ p: 1, shots: 256, optimizer: 'COBYLA', max_iterations: 40, seed: 7 });
  const [experimentConfiguration, setExperimentConfiguration] = useState(null);

  useEffect(() => {
    if (experimentDefaults?.objective_weights) setObjectiveWeights(experimentDefaults.objective_weights);
    if (experimentDefaults?.qaoa_config) setQaoaConfig(experimentDefaults.qaoa_config);
  }, [experimentDefaults]);

  const savedBenchmarkEntry = useMemo(() => {
    const entries = data?.results || [];
    return [...entries].reverse().find((entry) => entry.endpoint === '/benchmark')?.result || null;
  }, [data]);
  const savedBenchmark = savedBenchmarkEntry?.results || null;
  const benchmarkRows = records || savedBenchmark;
  const activeScenarioId = scenario?.id;
  const rows = useMemo(() => {
    if (!benchmarkRows) return [];
    const thisScenario = benchmarkRows.filter((row) => !activeScenarioId || row.scenario_id === activeScenarioId);
    return METHODS.map((method) => thisScenario.find((row) => row.method === method) || { method, status: 'not_available', detail: 'No record was returned for this method.' });
  }, [benchmarkRows, activeScenarioId]);
  const criticalTotal = useMemo(() => {
    if (!scenario) return null;
    return (scenario.hospitals || []).reduce((sum, hospital) => sum + Object.entries(hospital.demand || {}).reduce((subtotal, [group, amount]) => {
      const urgency = hospital.urgency?.[group]?.category;
      return subtotal + (urgency === 'high' || urgency === 'critical' ? Number(amount || 0) : 0);
    }, 0), 0);
  }, [scenario]);

  const runBenchmark = async () => {
    setBenchmarkError(''); setBenchmarkLoading(true); setRecords(null);
    try {
      const request = { include_qaoa: includeQAOA, objective_weights: objectiveWeights };
      if (includeQAOA) {
        if (!inventoryPenalty || !demandPenalty) throw new Error('Enter both QUBO penalty weights to run QAOA.');
        request.qaoa_penalties = { inventory_penalty_weight: Number(inventoryPenalty), demand_penalty_weight: Number(demandPenalty) };
        request.qaoa_config = qaoaConfig;
      }
      const response = await api.benchmark(request);
      setRecords(response.results || []);
      setExperimentConfiguration(response.experiment_configuration || null);
      reload();
    } catch (issue) { setBenchmarkError(issue.message || 'The benchmark could not be completed.'); }
    finally { setBenchmarkLoading(false); }
  };

  return <>
    <PageHeader eyebrow="MEASURED COMPARISON" title="Results" description="Compare solver outputs returned by the backend. Missing or skipped measurements remain unavailable." action={<button className="button button-secondary" onClick={reload}><Clock3 size={15} /> Refresh history</button>} />
    <section className="panel results-benchmark-panel">
      <div className="panel-heading"><div><h2>Benchmark comparison</h2><p>Runs each method against the backend scenario using the shared objective.</p></div><BarChart3 size={18} className="muted-icon" /></div>
      <div className="results-benchmark-controls"><div><label className="checkbox-label"><input type="checkbox" checked={includeQAOA} onChange={(event) => setIncludeQAOA(event.target.checked)} /> Include a measured QAOA simulator run</label><p className="comparison-help">Greedy and Exact are requested by default. QAOA runs only when selected and supported by the backend.</p></div><button className="button button-primary" onClick={runBenchmark} disabled={benchmarkLoading}><Play size={14} />{benchmarkLoading ? 'RUNNING BENCHMARK…' : 'RUN BENCHMARK'}</button></div>
      {includeQAOA && <div className="comparison-qaoa-inputs results-penalties"><label>Inventory penalty weight<input type="number" min="0.0001" step="any" value={inventoryPenalty} onChange={(event) => setInventoryPenalty(event.target.value)} /></label><label>Demand penalty weight<input type="number" min="0.0001" step="any" value={demandPenalty} onChange={(event) => setDemandPenalty(event.target.value)} /></label></div>}
      <details className="demo-objective-settings results-repro-controls"><summary>Experiment configuration · objective weights</summary><div className="demo-settings-grid">{Object.entries(objectiveWeights).map(([key, value]) => <label className="demo-field" key={key}>{key.replaceAll('_', ' ')}<input className="field-control" type="number" min="0" step="any" value={value} onChange={(event) => setObjectiveWeights((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}</div></details>
      {includeQAOA && <div className="demo-settings-grid results-qaoa-settings">{[['seed','Random seed'],['p','QAOA depth'],['shots','Shots'],['max_iterations','Optimizer iterations']].map(([key,label]) => <label className="demo-field" key={key}>{label}<input className="field-control" type="number" min="0" value={qaoaConfig[key]} onChange={(event) => setQaoaConfig((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}<label className="demo-field">Classical optimizer<select className="field-control" value={qaoaConfig.optimizer} onChange={(event) => setQaoaConfig((current) => ({ ...current, optimizer: event.target.value }))}><option>COBYLA</option><option>Nelder-Mead</option><option>Powell</option></select></label></div>}
      {benchmarkLoading && <LoadingState label="The backend is running the requested benchmark methods…" />}
      {benchmarkError && <ErrorState message={benchmarkError} />}
      {!benchmarkLoading && benchmarkRows && <>
        <div className="evidence-labels"><span className="evidence-measured">MEASURED · completed backend run</span><span className="evidence-expected">EXPECTED · no expected values used</span><span className="evidence-unavailable">NOT AVAILABLE · not run or unsupported</span></div>
        {(experimentConfiguration || savedBenchmarkEntry?.experiment_configuration) && <details className="saved-result-details results-experiment-config"><summary>Reproduce this benchmark · stored configuration</summary><pre>{JSON.stringify(experimentConfiguration || savedBenchmarkEntry.experiment_configuration, null, 2)}</pre></details>}
        <div className="table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table className="data-table results-comparison-table"><thead><tr><th>Method</th><th>Result</th><th>Objective</th><th>Critical satisfaction</th><th>Total unmet</th><th>Transport cost</th><th>Average time</th><th>Feasible</th><th>Runtime</th><th>Gap vs exact</th></tr></thead><tbody>
          {rows.map((row) => <BenchmarkRow key={row.method} row={row} criticalTotal={criticalTotal} />)}
        </tbody></table></div>
        <p className="comparison-help">Critical satisfaction is derived from the returned critical/high unmet units and the active scenario’s returned critical/high demand. Runtime and objective values are backend measurements. Approximation gap is reported only when the backend supplies a defined value.</p>
        <BenchmarkCharts rows={rows} />
      </>}
      {!benchmarkRows && !loading && !benchmarkLoading && <div className="results-no-benchmark"><EmptyState title="No benchmark result is available" detail="Run a benchmark above. The page does not substitute sample values or estimate solver output." /></div>}
    </section>

    <section className="results-evidence-note"><strong>How to read this comparison</strong><span>Completed records are measured responses from this local synthetic-data prototype. “Expected” does not represent an experiment; no expected values are plotted. A skipped Exact run or unconfigured QAOA has no numeric result.</span></section>

    <section className="results-history-section"><div className="results-history-heading"><div><span className="eyebrow">BACKEND SESSION</span><h2>Saved results</h2><p>Recent optimization, emergency, and benchmark responses held in backend memory.</p></div><button className="button button-secondary button-small" onClick={reload}><RotateCcw size={13} /> Refresh</button></div>
      {loading && <LoadingState label="Loading saved results…" />}{!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && !(data?.results || []).length && <section className="panel"><EmptyState title="No saved results in this backend session" detail="Run an optimization, emergency simulation, or benchmark first. Results reset when the backend restarts." /></section>}
      {!loading && !error && (data?.results || []).length > 0 && <div className="results-list">{[...(data.results || [])].reverse().map((entry, index) => <ResultCard key={`${entry.created_at}-${index}`} entry={entry} />)}</div>}
    </section>
  </>;
}

function BenchmarkRow({ row, criticalTotal }) {
  const complete = row.status === 'completed' || row.status === 'infeasible';
  const criticalSatisfaction = complete && criticalTotal != null && criticalTotal > 0 && row.critical_unmet_demand != null ? Math.max(0, (criticalTotal - row.critical_unmet_demand) / criticalTotal) : null;
  const statusLabel = complete ? (row.feasibility === false ? 'Measured · infeasible' : 'Measured') : `Not available · ${statusText(row.status)}`;
  const gap = row.approximation_gap == null ? (row.approximation_gap_status?.startsWith('unavailable') || row.approximation_gap_status?.startsWith('undefined') ? 'Not available' : '—') : `${(row.approximation_gap * 100).toFixed(2)}%`;
  return <tr><td><strong>{methodNames[row.method] || row.method}</strong></td><td><span className={`measurement-pill ${complete ? 'measurement-done' : 'measurement-missing'}`}>{statusLabel}</span>{row.detail && !complete && <small className="missing-detail">{row.detail}</small>}</td><td>{metric(row.objective_value)}</td><td>{criticalSatisfaction == null ? 'Not available' : `${(criticalSatisfaction * 100).toFixed(1)}%`}</td><td>{metric(row.total_unmet_demand)}</td><td>{metric(row.transport_cost)}</td><td>{row.average_transport_time == null ? 'Not available' : `${metric(row.average_transport_time)} min`}</td><td>{row.feasibility == null ? 'Not available' : row.feasibility ? 'Feasible' : 'Infeasible'}</td><td>{row.runtime_seconds == null ? 'Not available' : `${Number(row.runtime_seconds).toFixed(4)} s`}</td><td>{gap}</td></tr>;
}

function BenchmarkCharts({ rows }) {
  const metrics = [
    { key: 'objective_value', label: 'Objective value', lowerBetter: true },
    { key: 'total_unmet_demand', label: 'Total unmet demand', lowerBetter: true, suffix: 'units' },
    { key: 'transport_cost', label: 'Transport cost', lowerBetter: true },
    { key: 'average_transport_time', label: 'Average transport time', lowerBetter: true, suffix: 'min' },
  ];
  return <div className="results-charts"><div className="results-chart-heading"><div><h3>Measured metric charts</h3><p>Each chart scales only the completed values shown in this benchmark.</p></div></div><div className="results-chart-grid">{metrics.map((metricSpec) => {
    const entries = rows.filter((row) => (row.status === 'completed' || row.status === 'infeasible') && Number.isFinite(Number(row[metricSpec.key]))).map((row) => ({ method: methodNames[row.method] || row.method, value: Number(row[metricSpec.key]) }));
    const max = Math.max(...entries.map((item) => item.value), 0);
    return <article className="results-chart-card" key={metricSpec.key}><div className="results-chart-card-heading"><strong>{metricSpec.label}</strong><span>MEASURED</span></div>
      {entries.length ? <div className="results-bars">{entries.map((entry) => <div className={`results-bar-row results-bar-${entry.method}`} key={entry.method}><span>{entry.method}</span><div className="results-bar-track" role="img" aria-label={`${entry.method} measured ${metricSpec.label}: ${metric(entry.value)}${metricSpec.suffix ? ` ${metricSpec.suffix}` : ''}`}><i style={{ width: `${max === 0 ? 0 : Math.max(3, (entry.value / max) * 100)}%` }} /></div><strong>{metric(entry.value)}{metricSpec.suffix ? ` ${metricSpec.suffix}` : ''}</strong></div>)}</div> : <p className="chart-unavailable">No completed backend measurement for this metric.</p>}
      <small>Lower values are smaller for this metric; this chart does not rank overall solver quality.</small>
    </article>;
  })}</div></div>;
}

function ResultCard({ entry }) {
  const result = entry.result || {}; const emergency = entry.endpoint === '/simulate-emergency';
  const metrics = emergency ? result.after_metrics || {} : result;
  const label = emergency ? 'Emergency re-optimization' : entry.endpoint === '/benchmark' ? 'Benchmark' : 'Optimization';
  return <article className="panel saved-result-card"><div className="saved-result-head"><span className="saved-result-icon"><Clock3 size={18} /></span><div><strong>{label}</strong><small>{new Date(entry.created_at).toLocaleString()}</small></div><span className="run-status"><span className="status-indicator" />recorded</span></div>
    {emergency ? <div className="saved-result-metrics"><span>Method <strong>{result.method || 'Not available'}</strong></span><span>Unmet after <strong>{metrics.total_unmet_demand ?? 'Not available'}</strong></span><span>Transport cost <strong>{metrics.transport_cost ?? 'Not available'}</strong></span><span>Allocation rows <strong>{result.after_allocation?.length ?? 0}</strong></span></div>
      : entry.endpoint === '/benchmark' ? <div className="saved-result-metrics"><span>Benchmark records <strong>{result.results?.length ?? 0}</strong></span><span>Methods with completed measurements <strong>{result.results?.filter((row) => row.status === 'completed' || row.status === 'infeasible').length ?? 0}</strong></span></div>
      : <div className="saved-result-metrics"><span>Method <strong>{result.method || 'Not available'}</strong></span><span>Objective <strong>{result.total_objective ?? 'Not available'}</strong></span><span>Unmet units <strong>{result.total_unmet_demand ?? 'Not available'}</strong></span><span>Allocation rows <strong>{result.allocation?.length ?? 0}</strong></span></div>}
    <details className="saved-result-details"><summary>View exact API response</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
  </article>;
}

function metric(value) { return value == null || !Number.isFinite(Number(value)) ? 'Not available' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 }); }
function statusText(status) { return String(status || 'unknown').replaceAll('_', ' '); }
