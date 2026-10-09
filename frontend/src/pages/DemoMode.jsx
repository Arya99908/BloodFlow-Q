import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Play, ShieldCheck, Settings2 } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';
import { StatItem, MetaRow, StatusBadge } from '../components/DataField';

const FALLBACK_WEIGHTS = { critical_unmet_weight: 10, total_unmet_weight: 5, transportation_cost_weight: 1, transportation_time_weight: 0.1, secondary_penalty_weight: 0 };
const FALLBACK_QAOA = { p: 1, shots: 256, optimizer: 'COBYLA', max_iterations: 40, seed: 7 };

export default function DemoMode() {
  const { data: catalog, loading, error, reload } = useApi(api.getDemoScenarios, []);
  const { data: defaults } = useApi(api.getExperimentDefaults, []);
  const { data: precomputed, loading: precomputedLoading, error: precomputedError, reload: reloadPrecomputed } = useApi(api.getPrecomputedDemo, []);
  const [mode, setMode] = useState('live');
  const [scenarioId, setScenarioId] = useState('normal');
  const [method, setMethod] = useState('qaoa');
  const [weights, setWeights] = useState(FALLBACK_WEIGHTS);
  const [qaoa, setQaoa] = useState(FALLBACK_QAOA);
  const [penalties, setPenalties] = useState({ inventory_penalty_weight: '10000', demand_penalty_weight: '10000' });
  const [result, setResult] = useState(null);
  const [liveRuns, setLiveRuns] = useState({});
  const [selectedPrecomputedId, setSelectedPrecomputedId] = useState('normal-qaoa');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');

  useEffect(() => {
    if (defaults?.objective_weights) setWeights(defaults.objective_weights);
    if (defaults?.qaoa_config) setQaoa(defaults.qaoa_config);
  }, [defaults]);

  const objectiveWeights = weights;
  const qaoaSettings = qaoa;
  const cases = catalog?.scenarios || [];
  const storedRuns = precomputed?.runs || [];
  const selectedCase = cases.find((item) => item.id === scenarioId);
  const selectedStoredRun = storedRuns.find((item) => item.run_id === selectedPrecomputedId) || storedRuns[0];
  const shownResult = mode === 'live' ? result : selectedStoredRun?.result;
  const output = shownResult?.result;
  const beforeMetrics = output?.before_metrics;
  const afterMetrics = output?.after_metrics || output;
  const allocations = output?.after_allocation || output?.allocation || [];
  const actualScenario = output?.modified_scenario || output?.scenario || null;
  const comparableRuns = useMemo(() => {
    if (mode === 'precomputed') return storedRuns.filter((run) => run.scenario_id === 'normal');
    return ['greedy', 'milp', 'exact', 'qaoa'].map((solver) => liveRuns[`normal:${solver}`]).filter(Boolean);
  }, [liveRuns, mode, storedRuns]);

  const setWeight = (key, value) => setWeights((current) => ({ ...current, [key]: Number(value) }));
  const setQaoaValue = (key, value) => setQaoa((current) => ({ ...current, [key]: key === 'optimizer' ? value : Number(value) }));

  const demoBound = useMemo(() => {
    const costWeight = Number(objectiveWeights?.transportation_cost_weight ?? 1);
    const timeWeight = Number(objectiveWeights?.transportation_time_weight ?? 0.1);
    const totalUnmetWeight = Number(objectiveWeights?.total_unmet_weight ?? 5);
    const critUnmetWeight = Number(objectiveWeights?.critical_unmet_weight ?? 10);
    const routeCoef = costWeight * 4.5 + timeWeight * 18;
    const unmetCoef = totalUnmetWeight + critUnmetWeight * 3.0;
    if (scenarioId === 'emergency_demand_spike') {
      return Number((routeCoef * 12 + unmetCoef * 16).toFixed(1));
    }
    if (scenarioId === 'transport_disruption') {
      return Number((unmetCoef * 4).toFixed(1));
    }
    return Number((routeCoef * 4 + unmetCoef * 4).toFixed(1));
  }, [scenarioId, objectiveWeights]);

  const switchToPrecomputed = () => {
    const match = storedRuns.find((item) => item.scenario_id === scenarioId && item.method === method) || storedRuns[0];
    if (match) setSelectedPrecomputedId(match.run_id);
    setMode('precomputed');
    setRunError('');
  };

  const run = async () => {
    setRunning(true); setRunError(''); setResult(null);
    const request = { scenario_id: scenarioId, method, objective_weights: objectiveWeights };
    if (method === 'qaoa') {
      const inv = Number(penalties.inventory_penalty_weight);
      const dem = Number(penalties.demand_penalty_weight);
      if (inv <= demoBound || dem <= demoBound) {
        setRunError(`Penalty weights must strictly exceed the conservative objective upper bound (> ${demoBound}) to mathematically enforce valid QUBO constraint penalties. Please increase the penalty weights (e.g. ${Math.ceil(demoBound * 1.5)} or 10000).`);
        setRunning(false);
        return;
      }
      request.qaoa_config = qaoaSettings;
      request.qaoa_penalties = {
        inventory_penalty_weight: inv,
        demand_penalty_weight: dem,
      };
    }
    try {
      const measured = await api.runDemo(request);
      setResult(measured);
      setLiveRuns((current) => ({ ...current, [`${scenarioId}:${method}`]: measured }));
    } catch (issue) { setRunError(issue.message || 'The requested demo run failed.'); }
    finally { setRunning(false); }
  };

  const chooseStoredRun = (runId) => {
    setSelectedPrecomputedId(runId);
    const stored = storedRuns.find((item) => item.run_id === runId);
    if (stored) { setScenarioId(stored.scenario_id); setMethod(stored.method); }
  };

  return <>
    <PageHeader eyebrow="CONTROLLED SYNTHETIC EXPERIMENT" title="Demo mode" description="Run the live backend pipeline, or inspect a separately labeled record of real, previously measured experiments." />
    <section className="demo-mode-switch" role="radiogroup" aria-label="Choose live computation or precomputed experiment">
      <button type="button" role="radio" aria-checked={mode === 'live'} className={mode === 'live' ? 'demo-mode-active' : ''} onClick={() => setMode('live')}><strong>LIVE COMPUTATION</strong><span>New request to the running optimization backend</span></button>
      <button type="button" role="radio" aria-checked={mode === 'precomputed'} className={mode === 'precomputed' ? 'demo-mode-active' : ''} onClick={switchToPrecomputed} disabled={!storedRuns.length}><strong>PRECOMPUTED EXPERIMENT</strong><span>{storedRuns.length ? 'Saved measurements with configuration and provenance' : precomputedLoading ? 'Loading stored experiment…' : 'No stored experiment is available'}</span></button>
    </section>
    {mode === 'live' && loading && <LoadingState label="Loading the fixed demo scenarios from the backend…" />}
    {mode === 'live' && !loading && error && <ErrorState message={error} onRetry={reload} />}
    {(mode === 'precomputed' || (!loading && !error)) && <>
      {mode === 'live' && <div className="demo-case-grid" role="radiogroup" aria-label="Select a deterministic demo scenario">
        {cases.map((item, index) => <button type="button" role="radio" aria-checked={scenarioId === item.id} key={item.id} className={`demo-case ${scenarioId === item.id ? 'demo-case-selected' : ''}`} onClick={() => { setScenarioId(item.id); setResult(null); }}>
          <span className="demo-case-index">{String(index + 1).padStart(2, '0')}</span><strong>{item.name}</strong><span>{item.description}</span>
        </button>)}
      </div>}
      {!cases.length && mode === 'live' && <EmptyState title="No demo scenarios are available" detail="The API did not return the controlled scenario catalog." />}
      <div className="demo-layout">
        {mode === 'live' ? <section className="panel demo-config">
          <div className="panel-heading"><div><h2>Run configuration</h2><p>Every setting is passed to the API with the run.</p></div><Settings2 size={17} className="muted-icon" /></div>
          <label className="field-label" htmlFor="demo-method">Optimization method</label>
          <select id="demo-method" className="field-control" value={method} onChange={(event) => setMethod(event.target.value)}><option value="greedy">Greedy baseline</option><option value="milp">MILP (HiGHS classical optimal)</option><option value="exact">Exact small-instance solver</option><option value="qaoa">QAOA local simulator</option></select>
          {method === 'qaoa' && <>
            <div className="demo-settings-grid">
              <NumberField label="Random seed" value={qaoaSettings.seed} onChange={(value) => setQaoaValue('seed', value)} min="0" />
              <NumberField label="QAOA depth (p)" value={qaoaSettings.p} onChange={(value) => setQaoaValue('p', value)} min="1" max="5" />
              <NumberField label="Shots" value={qaoaSettings.shots} onChange={(value) => setQaoaValue('shots', value)} min="1" max="10000" />
              <NumberField label="Optimizer iterations" value={qaoaSettings.max_iterations} onChange={(value) => setQaoaValue('max_iterations', value)} min="1" max="500" />
              <label className="demo-field">Classical optimizer<select className="field-control" value={qaoaSettings.optimizer} onChange={(event) => setQaoaValue('optimizer', event.target.value)}><option>COBYLA</option><option>Nelder-Mead</option><option>Powell</option></select></label>
            </div>
            <div className="demo-settings-grid demo-penalties"><NumberField label={`Inventory penalty weight (min > ${demoBound})`} value={penalties.inventory_penalty_weight} onChange={(value) => setPenalties((current) => ({ ...current, inventory_penalty_weight: value }))} min={(demoBound + 0.1).toFixed(1)} placeholder={`> ${demoBound}`} /><NumberField label={`Demand penalty weight (min > ${demoBound})`} value={penalties.demand_penalty_weight} onChange={(value) => setPenalties((current) => ({ ...current, demand_penalty_weight: value }))} min={(demoBound + 0.1).toFixed(1)} placeholder={`> ${demoBound}`} /></div>
            <p className="comparison-help"><strong>Minimum penalty weight: &gt; {demoBound}</strong>. Required by QUBO formulation: penalty weights must strictly exceed the theoretical objective upper bound so that constraint violations cannot be chosen over valid allocations.</p>
          </>}
          <details className="demo-objective-settings"><summary>Objective weights</summary><div className="demo-settings-grid">{Object.entries(objectiveWeights).map(([key, value]) => <NumberField key={key} label={key.replaceAll('_', ' ')} value={value} min="0" onChange={(next) => setWeight(key, next)} />)}</div></details>
          <p className="comparison-help">To build a same-scenario comparison, run Greedy, Exact, then QAOA in turn. Completed responses stay visible for this browser session.</p>
          <button type="button" className="button button-primary button-wide run-optimization-button" onClick={run} disabled={running || !selectedCase}><Play size={15} />{running ? 'RUNNING REAL PIPELINE…' : 'RUN DEMO'}</button>
          <p className="demo-qaoa-status"><ShieldCheck size={14} /> QAOA availability reported by backend: <strong>{defaults?.qaoa_available == null ? 'checking' : defaults.qaoa_available ? 'available' : 'unavailable'}</strong>. {defaults?.qaoa_unavailable_reason || 'A failed QAOA request stays an error.'}</p>
        </section> : <section className="panel demo-config">
          <div className="panel-heading"><div><h2>Stored experiment</h2><p>Choose a captured run. Values are read-only.</p></div></div>
          <label className="demo-field" htmlFor="precomputed-run">Stored scenario and method</label>
          <select id="precomputed-run" className="field-control" value={selectedStoredRun?.run_id || ''} onChange={(event) => chooseStoredRun(event.target.value)}>{storedRuns.map((item) => <option key={item.run_id} value={item.run_id}>{item.scenario_id.replaceAll('_', ' ').toUpperCase()} · {item.method.toUpperCase()}</option>)}</select>
          {precomputedLoading && <LoadingState label="Loading the stored experiment artifact…" />}
          {precomputedError && <ErrorState message={precomputedError} onRetry={reloadPrecomputed} />}
          {precomputed && (
            <div className="precomputed-provenance">
              <strong>Recorded experiment provenance</strong>
              <span>Selected run captured: {formatDate(selectedStoredRun?.timestamp_utc)}</span>
              <span>Artifact captured: {formatDate(precomputed.created_at_utc)}</span>
              <span>Reproduction command: <code>{precomputed.reproducibility?.command || 'Not available'}</code></span>
              <details className="saved-result-details">
                <summary>Environment, settings and source hashes</summary>
                <pre>{JSON.stringify({ run: selectedStoredRun, reproducibility: precomputed.reproducibility }, null, 2)}</pre>
              </details>
            </div>
          )}
        </section>}
        <section className="panel demo-output" aria-live="polite">
          <div className="panel-heading"><div><h2>{mode === 'live' ? 'Run output' : 'Archived run output'}</h2><p>{mode === 'live' ? selectedCase?.name || 'Select a scenario' : selectedStoredRun?.scenario_id?.replaceAll('_', ' ').toUpperCase()}</p></div></div>
          {mode === 'live' && running && <LoadingState label={`Running ${method.toUpperCase()} against the selected scenario…`} />}
          {mode === 'live' && runError && <><ErrorState message={runError} />{storedRuns.length > 0 && <button type="button" className="button button-secondary demo-fallback-button" onClick={switchToPrecomputed}>Show a PRECOMPUTED EXPERIMENT</button>}</>}
          {mode === 'live' && !running && !runError && !result && (
            <EmptyState
              title="No live run yet"
              detail="Select a scenario and run it to see an actual backend response."
            />
          )}
          {mode === 'precomputed' && !selectedStoredRun && <EmptyState title="No precomputed result is available" detail="The repository has no captured experiment to display." />}
          {shownResult && <>
            <div className={`demo-result-header-bar ${mode === 'precomputed' ? 'demo-header-precomputed' : ''}`}>
              <span className="demo-mode-tag">
                {mode === 'live' ? 'LIVE COMPUTATION · NEW API RESPONSE' : 'PRECOMPUTED EXPERIMENT · HISTORICAL ARTIFACT'}
              </span>
              <StatusBadge
                status={afterMetrics?.feasibility ? 'feasible' : 'infeasible'}
                label={`${shownResult.method?.toUpperCase()} · ${afterMetrics?.feasibility ? 'FEASIBLE' : 'INFEASIBLE'}`}
              />
            </div>
            {mode === 'precomputed' && <p className="comparison-help">This is the saved response from the experiment capture date, not a computation performed now.</p>}
            {output?.emergency_event && <EmergencyChange output={output} />}
            <details className="saved-result-details"><summary>Experiment configuration recorded for this run</summary><pre>{JSON.stringify(shownResult.experiment_configuration, null, 2)}</pre></details>
            {beforeMetrics && <BeforeAfter before={beforeMetrics} after={afterMetrics} output={output} />}
            {!beforeMetrics && <MetricGrid metrics={afterMetrics} />}
            {shownResult.method === 'qaoa' && <>
              <div className="panel solver-metadata-panel">
                <div className="metadata-panel-heading">QAOA circuit & execution telemetry</div>
                <div className="metadata-row-grid">
                  <MetaRow label="QUBO variables" value={(output?.after_qaoa || output)?.qubo_variable_count ?? 'Not available'} />
                  <MetaRow label="Ansatz depth (p)" value={(output?.after_qaoa || output)?.qaoa_depth ?? 'Not available'} />
                  <MetaRow label="Circuit shots" value={(output?.after_qaoa || output)?.shots ?? 'Not available'} />
                  <div className="bitstring-box">
                    <span className="bitstring-label">Best measured bitstring:</span>
                    <code className="bitstring-code">{(output?.after_qaoa || output)?.best_measured_bitstring ?? 'Not available'}</code>
                  </div>
                </div>
              </div>
              {(output?.after_qaoa || output)?.counts && <details className="saved-result-details"><summary>Measured bitstring counts ({(output?.after_qaoa || output).shots} shots)</summary><pre>{JSON.stringify((output?.after_qaoa || output).counts, null, 2)}</pre></details>}
              {output?.before_qaoa && <details className="saved-result-details"><summary>Before/after QAOA samples</summary><pre>{JSON.stringify({ before: output.before_qaoa, after: output.after_qaoa }, null, 2)}</pre></details>}
            </>}
            {afterMetrics?.feasibility != null && <details className="saved-result-details"><summary>Classical validation report · {afterMetrics.feasibility ? 'FEASIBLE' : 'INFEASIBLE'}</summary><pre>{JSON.stringify({ feasible: afterMetrics.feasibility, violations: afterMetrics.violations || output?.violations || [], feasibility_status: output?.feasibility_status || null }, null, 2)}</pre></details>}
            <h3 className="result-section-title">{output?.after_allocation ? 'New allocation decisions' : 'Shipment allocation'}</h3>
            {allocations.length ? <div className="table-scroll" role="region" aria-label="Measured allocation" tabIndex={0}><table className="data-table allocation-table"><thead><tr><th>Source</th><th>Hospital</th><th>Blood group</th><th className="text-right">Units</th></tr></thead><tbody>{allocations.map((row, index) => <tr key={`${row.source}-${row.destination}-${row.blood_group}-${index}`}><td>{row.source}</td><td>{row.destination}</td><td><span className="group-token">{row.blood_group}{row.recipient_group !== row.blood_group ? ` → ${row.recipient_group}` : ''}</span></td><td className="text-right num-cell"><strong>{row.quantity} units</strong></td></tr>)}</tbody></table></div> : <p className="muted-copy">The backend returned no allocation rows for this run.</p>}
            {output?.allocation_changes?.length > 0 && <><h3 className="result-section-title">Allocation adjustments</h3><div className="table-scroll" role="region" aria-label="Allocation changes" tabIndex={0}><table className="data-table"><thead><tr><th>Source</th><th>Hospital</th><th>Group</th><th className="text-right">Unit change</th></tr></thead><tbody>{output.allocation_changes.map((change, index) => <tr key={`${change.source}-${change.destination}-${index}`}><td>{change.source}</td><td>{change.destination}</td><td><span className="group-token">{change.blood_group}</span></td><td className="text-right num-cell"><strong>{change.quantity_change > 0 ? '+' : ''}{change.quantity_change} units</strong></td></tr>)}</tbody></table></div></>}
            {actualScenario && <details className="saved-result-details"><summary>View exact scenario returned by API</summary><pre>{JSON.stringify(actualScenario, null, 2)}</pre></details>}
            <details className="saved-result-details"><summary>View full API response</summary><pre>{JSON.stringify(shownResult, null, 2)}</pre></details>
          </>}
        </section>
      </div>
      <section className="panel demo-comparison"><div className="panel-heading"><div><h2>Greedy · MILP · Exact · QAOA comparison</h2><p>{mode === 'precomputed' ? 'Historical measured runs for the same compact normal scenario.' : 'Live results collected from this page session for the same compact normal scenario.'}</p></div></div>
        {comparableRuns.length ? (
          <div className="table-scroll" role="region" aria-label="Solver comparison" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th className="text-right">Objective</th>
                  <th className="text-right">Critical satisfaction</th>
                  <th className="text-right">Unmet units</th>
                  <th className="text-right">Transport cost</th>
                  <th>Feasibility</th>
                </tr>
              </thead>
              <tbody>
                {comparableRuns.map((record) => {
                  const row = record.result?.result;
                  return (
                    <tr key={record.run_id || `${record.scenario_id}-${record.method}`}>
                      <td><strong>{record.method.toUpperCase()}</strong></td>
                      <td className="text-right num-cell">{showMetric(row?.total_objective)}</td>
                      <td className="text-right num-cell">{row?.critical_satisfaction?.rate == null ? 'Not available' : `${(row.critical_satisfaction.rate * 100).toFixed(1)}%`}</td>
                      <td className="text-right num-cell">{showMetric(row?.total_unmet_demand)}</td>
                      <td className="text-right num-cell">{showMetric(row?.transport_cost)}</td>
                      <td><StatusBadge status={row?.feasibility ? 'feasible' : 'infeasible'} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No same-scenario method comparison yet"
            detail="Run Greedy, Exact and QAOA live on this scenario, or select the precomputed comparison."
          />
        )}
      </section>
    </>}
  </>;
}

function MetricGrid({ metrics }) {
  return (
    <div className="demo-metric-kpi-grid">
      <StatItem label="Objective score" value={showMetric(metrics?.total_objective)} />
      <StatItem label="Total unmet demand" value={showMetric(metrics?.total_unmet_demand)} unit="units" />
      <StatItem label="Transport cost" value={showMetric(metrics?.transport_cost)} />
      <StatItem
        label="Critical satisfaction"
        value={metrics?.critical_satisfaction?.rate == null ? 'Not available' : `${(metrics.critical_satisfaction.rate * 100).toFixed(1)}%`}
      />
    </div>
  );
}

function BeforeAfter({ before, after, output }) {
  const sumDemand = (scenario) => (scenario?.hospitals || []).reduce((total, hospital) => total + Object.values(hospital.demand || {}).reduce((sum, value) => sum + Number(value || 0), 0), 0);
  const rows = [
    ['Total demand', sumDemand(output?.original_scenario), sumDemand(output?.modified_scenario)],
    ['Unmet demand', before?.total_unmet_demand, after?.total_unmet_demand],
    ['Critical satisfaction', percent(before?.critical_satisfaction), percent(after?.critical_satisfaction)],
    ['Transport cost', before?.transport_cost, after?.transport_cost],
  ];
  return <div className="demo-before-after"><h3>Before / after metrics</h3><div className="table-scroll"><table className="data-table"><thead><tr><th>Metric</th><th className="text-right">Before</th><th className="text-right">After</th></tr></thead><tbody>{rows.map(([label, oldValue, newValue]) => <tr key={label}><th scope="row">{label}</th><td className="text-right num-cell">{showMetric(oldValue)}</td><td className="text-right num-cell">{showMetric(newValue)}</td></tr>)}</tbody></table></div><p className="comparison-help">Demand is taken from the original and modified scenario returned by the API. A missing metric remains “Not available.”</p></div>;
}

function EmergencyChange({ output }) {
  const event = output.emergency_event;
  if (event.source && event.destination) {
    const source = output.original_scenario?.blood_banks?.find((item) => item.id === event.source)?.name || event.source;
    const destination = output.original_scenario?.hospitals?.find((item) => item.id === event.destination)?.name || event.destination;
    return (
      <div className="demo-event-detail-box">
        <div className="event-detail-header">
          <span className="event-tag tag-disruption">TRANSPORT DISRUPTION</span>
          <strong>Route connection blocked</strong>
        </div>
        <p className="event-detail-summary">
          Route <code>{source}</code> → <code>{destination}</code> was marked blocked before re-optimization.
        </p>
      </div>
    );
  }
  if (event.bank_id) {
    const bank = output.original_scenario?.blood_banks?.find((item) => item.id === event.bank_id)?.name || event.bank_id;
    return (
      <div className="demo-event-detail-box">
        <div className="event-detail-header">
          <span className="event-tag tag-reduction">INVENTORY REDUCTION</span>
          <strong>Supply stock removed</strong>
        </div>
        <div className="event-chips-grid">
          <div className="event-chip">
            <span className="chip-label">Blood bank:</span>
            <strong>{bank}</strong>
          </div>
          <div className="event-chip">
            <span className="chip-label">Blood group:</span>
            <strong>{event.blood_group}</strong>
          </div>
          <div className="event-chip">
            <span className="chip-label">Units removed:</span>
            <strong>{event.units_to_remove} units</strong>
          </div>
        </div>
      </div>
    );
  }
  if (event.hospital_id && event.blood_group && event.new_demand == null) {
    const hospital = output.original_scenario?.hospitals?.find((item) => item.id === event.hospital_id)?.name || event.hospital_id;
    return (
      <div className="demo-event-detail-box">
        <div className="event-detail-header">
          <span className="event-tag tag-priority">PRIORITY UPDATE</span>
          <strong>Hospital clinical urgency escalated</strong>
        </div>
        <div className="event-chips-grid">
          <div className="event-chip">
            <span className="chip-label">Hospital:</span>
            <strong>{hospital}</strong>
          </div>
          <div className="event-chip">
            <span className="chip-label">Blood group:</span>
            <strong>{event.blood_group}</strong>
          </div>
          <div className="event-chip">
            <span className="chip-label">New urgency tier:</span>
            <strong>{event.urgency?.category ? event.urgency.category.charAt(0).toUpperCase() + event.urgency.category.slice(1) : 'Not available'}</strong>
          </div>
        </div>
      </div>
    );
  }
  const oldHospital = output.original_scenario?.hospitals?.find((item) => item.id === event.hospital_id);
  const newHospital = output.modified_scenario?.hospitals?.find((item) => item.id === event.hospital_id);
  const group = event.blood_group;
  return (
    <div className="demo-event-detail-box">
      <div className="event-detail-header">
        <span className="event-tag tag-demand">DEMAND SPIKE</span>
        <strong>Emergency demand change: {oldHospital?.name || event.hospital_id}</strong>
      </div>
      <div className="event-chips-grid">
        <div className="event-chip">
          <span className="chip-label">Blood group:</span>
          <strong>{group}</strong>
        </div>
        <div className="event-chip">
          <span className="chip-label">Demand update:</span>
          <strong>
            {oldHospital?.demand?.[group] ?? '—'} <ArrowRight size={12} /> {newHospital?.demand?.[group] ?? event.new_demand ?? '—'} units
          </strong>
        </div>
        <div className="event-chip">
          <span className="chip-label">Urgency tier:</span>
          <strong>
            {oldHospital?.urgency?.[group]?.category || '—'} <ArrowRight size={12} /> {newHospital?.urgency?.[group]?.category || event.urgency?.category || '—'}
          </strong>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max }) {
  return <label className="demo-field">{label}<input className="field-control" type="number" value={value} min={min} max={max} step="any" onChange={(event) => onChange(event.target.value)} /></label>;
}

function showMetric(value) { return value == null || !Number.isFinite(Number(value)) ? 'Not available' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 }); }
function percent(value) { return value?.rate == null ? null : `${(value.rate * 100).toFixed(1)}%`; }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString(); }
