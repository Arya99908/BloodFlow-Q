import { useState } from 'react';
import { Activity, CheckCircle2, Play, RotateCcw, TriangleAlert } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';

export default function Optimization({ initialRun, initialLoading, initialError, onNavigate }) {
  const { data: scenario, loading: scenarioLoading, error: scenarioError, reload: reloadScenario } = useApi(api.getScenario, []);
  const [method, setMethod] = useState('greedy');
  const [inventoryPenalty, setInventoryPenalty] = useState('');
  const [demandPenalty, setDemandPenalty] = useState('');
  const [localResult, setLocalResult] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [comparison, setComparison] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [includeQAOA, setIncludeQAOA] = useState(false);
  const result = localResult || initialRun;
  const loading = localLoading || initialLoading;
  const error = localError || initialError;
  const qaoaInstanceTooLarge = method === 'qaoa' && /local QAOA limited to .* qubits.*this QUBO has .* binary variables/i.test(error);

  const submit = async (event) => {
    event.preventDefault();
    setLocalError(''); setLocalLoading(true); setLocalResult(null); setComparison(null);
    try {
      const request = { method };
      if (method === 'qaoa') {
        if (!inventoryPenalty || !demandPenalty) throw new Error('Enter both explicit QUBO penalty weights before running QAOA.');
        request.qaoa_penalties = {
          inventory_penalty_weight: Number(inventoryPenalty),
          demand_penalty_weight: Number(demandPenalty),
        };
      }
      setLocalResult(await api.optimize(request));
    } catch (issue) {
      setLocalError(issue.message || 'Optimization could not be completed.');
    } finally {
      setLocalLoading(false);
    }
  };

  const runComparison = async () => {
    setCompareError(''); setCompareLoading(true); setComparison(null);
    try {
      const request = { include_qaoa: includeQAOA };
      if (includeQAOA) {
        if (!inventoryPenalty || !demandPenalty) throw new Error('Enter both QUBO penalty weights before including QAOA in the comparison.');
        request.qaoa_penalties = {
          inventory_penalty_weight: Number(inventoryPenalty),
          demand_penalty_weight: Number(demandPenalty),
        };
      }
      const response = await api.benchmark(request);
      setComparison(response.results || []);
    } catch (issue) {
      setCompareError(issue.message || 'The benchmark comparison could not be completed.');
    } finally {
      setCompareLoading(false);
    }
  };

  return <>
    <PageHeader eyebrow="SOLVER WORKSPACE" title="Optimization" description="Inspect the active scenario, run an allocator, and compare methods when results are available." />
    {scenarioLoading && <LoadingState label="Loading current scenario…" />}
    {!scenarioLoading && scenarioError && <ErrorState message={scenarioError} onRetry={reloadScenario} />}
    {!scenarioLoading && !scenarioError && scenario?.synthetic === true && <ScenarioPreview scenario={scenario} variableCount={result?.qubo_variable_count} />}
    {!scenarioLoading && !scenarioError && scenario?.synthetic !== true && scenario && <div className="notice notice-error">The backend scenario is not marked synthetic. Optimization is disabled.</div>}

    <div className="optimization-layout">
      <section className="panel form-panel">
        <div className="panel-heading"><div><h2>Configure a run</h2><p>Uses scenario <strong>{scenario?.id || '—'}</strong> returned by the backend.</p></div></div>
        <form onSubmit={submit} className="form-stack">
          <label className="field-label" htmlFor="solver-method">Solver method</label>
          <select id="solver-method" className="field-control" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="greedy">Greedy baseline</option><option value="exact">Exact (tiny instances only)</option><option value="qaoa">QAOA (local simulator; small instances)</option>
          </select>
          {method === 'qaoa' && <div className="qaoa-config-box"><div className="notice notice-info"><TriangleAlert size={16} /> QUBO penalty weights must be explicit and exceed this model’s objective bound. The API will reject insufficient values.</div>
            <label className="field-label" htmlFor="inventory-penalty">Inventory penalty weight</label><input id="inventory-penalty" className="field-control" type="number" min="0.0001" step="any" required value={inventoryPenalty} onChange={(event) => setInventoryPenalty(event.target.value)} />
            <label className="field-label" htmlFor="demand-penalty">Demand penalty weight</label><input id="demand-penalty" className="field-control" type="number" min="0.0001" step="any" required value={demandPenalty} onChange={(event) => setDemandPenalty(event.target.value)} />
          </div>}
          <button className="button button-primary button-wide run-optimization-button" type="submit" disabled={loading || scenarioLoading || !scenario || scenario?.synthetic !== true}><Play size={16} fill="currentColor" />{loading ? 'OPTIMIZING…' : 'RUN OPTIMIZATION'}</button>
        </form>
        <div className="optimization-note"><CheckCircle2 size={16} /><span>Returned candidates are classically validated. An infeasible QAOA sample stays visible and is never silently repaired.</span></div>
      </section>
      <section className="panel result-panel">
        <div className="panel-heading"><div><h2>Run output</h2><p>Only values returned by the backend are shown.</p></div><RotateCcw size={16} className="muted-icon" /></div>
        {loading && <LoadingState label="The solver is working…" />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && qaoaInstanceTooLarge && <div className="notice notice-info" role="note"><div><strong>The full scenario exceeds the local simulator limit.</strong><p>Use the compact, deterministic scenario in Demo mode to run the same real QUBO → QAOA → decoder → validator pipeline. The full-scenario request above was not replaced with a demo result.</p><button type="button" className="button button-secondary button-small" onClick={() => onNavigate?.('demo')}>Open compact QAOA demo</button></div></div>}
        {!loading && !error && result && <OptimizationResult result={result} scenario={scenario} />}
        {!loading && !error && !result && <div className="result-placeholder"><Play size={22} /><strong>No result yet</strong><span>Choose a solver and start a run. Values unavailable before a run are shown as such.</span></div>}
      </section>
    </div>

    <section className="panel comparison-panel">
      <div className="panel-heading"><div><h2>Method comparison</h2><p>Runs Greedy and Exact against this backend’s default scenario. QAOA is included only when you select it.</p></div><Activity size={17} className="muted-icon" /></div>
      <div className="comparison-controls"><label className="checkbox-label"><input type="checkbox" checked={includeQAOA} onChange={(event) => setIncludeQAOA(event.target.checked)} /> Include a measured QAOA run</label><button type="button" className="button button-secondary" onClick={runComparison} disabled={compareLoading}><Activity size={15} />{compareLoading ? 'Comparing…' : 'Run comparison'}</button></div>
      {includeQAOA && <><div className="comparison-qaoa-inputs"><label>Inventory penalty weight<input type="number" min="0.0001" step="any" value={inventoryPenalty} onChange={(event) => setInventoryPenalty(event.target.value)} /></label><label>Demand penalty weight<input type="number" min="0.0001" step="any" value={demandPenalty} onChange={(event) => setDemandPenalty(event.target.value)} /></label></div><p className="comparison-help">QAOA uses these explicit weights and may be unavailable if the local qubit limit is exceeded.</p></>}
      {compareLoading && <LoadingState label="Running the selected comparison methods…" />}
      {!compareLoading && compareError && <ErrorState message={compareError} />}
      {!compareLoading && !compareError && comparison && <BenchmarkTable records={comparison} includeQAOA={includeQAOA} />}
      {!comparison && !compareLoading && !compareError && <div className="comparison-placeholder">No comparison has been run yet. Benchmark values are not estimated or filled in.</div>}
    </section>
  </>;
}

function ScenarioPreview({ scenario, variableCount }) {
  const banks = scenario.blood_banks || []; const hospitals = scenario.hospitals || [];
  const groups = scenario.blood_groups || [];
  const inventoryTotal = banks.reduce((sum, bank) => sum + groups.reduce((bankSum, group) => bankSum + (bank.inventory?.[group] || 0), 0), 0);
  const demandTotal = hospitals.reduce((sum, hospital) => sum + Object.values(hospital.demand || {}).reduce((hospitalSum, units) => hospitalSum + units, 0), 0);
  return <section className="panel scenario-preview">
    <div className="panel-heading"><div><h2>Before optimization</h2><p>Scenario values loaded from the backend; urgency labels are scenario inputs.</p></div><span className="scenario-id-pill">{scenario.id}</span></div>
    <div className="preview-summary"><div><span>BANKS</span><strong>{banks.length}</strong></div><div><span>HOSPITALS</span><strong>{hospitals.length}</strong></div><div><span>TOTAL INVENTORY</span><strong>{inventoryTotal} <small>units</small></strong></div><div><span>TOTAL DEMAND</span><strong>{demandTotal} <small>units</small></strong></div><div><span>QUBO VARIABLES</span><strong>{variableCount ?? '—'}</strong><small>{variableCount == null ? 'Built only for a QAOA run' : 'From the returned QAOA QUBO'}</small></div></div>
    <div className="scenario-preview-columns"><div><h3>Inventory by bank</h3><div className="table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table className="data-table compact-table"><thead><tr><th>Bank</th>{groups.map((group) => <th key={group}>{group}</th>)}</tr></thead><tbody>{banks.map((bank) => <tr key={bank.id}><td>{bank.name}</td>{groups.map((group) => <td key={group}>{bank.inventory?.[group] ?? '—'}</td>)}</tr>)}</tbody></table></div></div>
      <div><h3>Demand and urgency</h3><div className="table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table className="data-table compact-table"><thead><tr><th>Hospital</th><th>Group</th><th>Units</th><th>Urgency</th></tr></thead><tbody>{hospitals.flatMap((hospital) => Object.entries(hospital.demand || {}).map(([group, units]) => <tr key={`${hospital.id}-${group}`}><td>{hospital.name}</td><td>{group}</td><td>{units}</td><td><span className={`urgency urgency-${hospital.urgency?.[group]?.category || 'unknown'}`}>{hospital.urgency?.[group]?.category || 'Not provided'}</span></td></tr>))}</tbody></table></div></div></div>
  </section>;
}

function OptimizationResult({ result, scenario }) {
  const qaoa = result.method === 'qaoa';
  const missingMethodValue = qaoa ? 'Unavailable' : 'Not applicable';
  const banks = Object.fromEntries((scenario?.blood_banks || []).map((bank) => [bank.id, bank.name]));
  const hospitals = Object.fromEntries((scenario?.hospitals || []).map((hospital) => [hospital.id, hospital.name]));
  const satisfaction = result.critical_satisfaction?.rate;
  return <div className="optimization-result">
    <div className={`run-status status-${result.status}`}><span className="status-indicator" />{result.status} · {result.method}</div>
    <div className="result-stat-grid"><div><span>Selected method</span><strong>{result.method}</strong></div><div><span>Objective</span><strong>{result.total_objective ?? '—'}</strong></div><div><span>Feasibility</span><strong>{result.feasibility == null ? 'Unavailable' : result.feasibility ? 'Feasible' : 'Infeasible'}</strong></div><div><span>Critical / high satisfaction</span><strong>{satisfaction == null ? 'Unavailable' : `${Math.round(satisfaction * 100)}%`}</strong></div><div><span>Total unmet demand</span><strong>{result.total_unmet_demand ?? '—'} <small>units</small></strong></div><div><span>Transport cost</span><strong>{result.transport_cost ?? '—'}</strong></div></div>
    <div className="solver-metadata"><div><span>QUBO variables</span><strong>{result.qubo_variable_count ?? missingMethodValue}</strong></div><div><span>QAOA depth p</span><strong>{result.qaoa_depth ?? missingMethodValue}</strong></div><div><span>Shots</span><strong>{result.shots ?? missingMethodValue}</strong></div><div className="bitstring-metadata"><span>Best measured bitstring</span><code>{result.best_measured_bitstring || missingMethodValue}</code></div></div>
    {!qaoa && <p className="comparison-help">QUBO variable count, QAOA depth, shots, and measured bitstring do not apply to this classical solver.</p>}
    {qaoa && result.best_measured_bitstring && <p className="comparison-help">Best measured candidate from the returned finite-shot sample; it is not a proof of global optimality.</p>}
    {result.violations?.length > 0 && <div className="notice notice-error"><TriangleAlert size={16} /><div><strong>Feasibility violations</strong><ul>{result.violations.map((item, index) => <li key={index}>{item.message || JSON.stringify(item)}</li>)}</ul></div></div>}
    <div className="result-section-title">Allocation</div>
    {result.allocation?.length ? <div className="table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table className="data-table allocation-table"><thead><tr><th>Blood bank</th><th>Hospital</th><th>Product group</th><th>Recipient group</th><th>Quantity</th></tr></thead><tbody>{result.allocation.map((item, index) => <tr key={`${item.source}-${item.destination}-${item.blood_group}-${index}`}><td>{banks[item.source] || item.source}</td><td>{hospitals[item.destination] || item.destination}</td><td>{item.blood_group}</td><td>{item.recipient_group}</td><td><strong>{item.quantity}</strong></td></tr>)}</tbody></table></div> : <p className="muted-copy">No units were allocated by this returned candidate.</p>}
    <div className="result-section-title">Unmet demand by group</div>
    {result.unmet_demand?.some((item) => item.units > 0) ? <div className="compact-allocation">{result.unmet_demand.filter((item) => item.units > 0).map((item) => <div className="allocation-row" key={`${item.hospital_id}-${item.blood_group}`}><span><strong>{hospitals[item.hospital_id] || item.hospital_id}</strong></span><span>{item.blood_group}</span><b>{item.units} units</b></div>)}</div> : <p className="muted-copy">No unmet-demand rows were reported.</p>}
    <p className="small-disclaimer">A solver candidate is an aggregate synthetic logistics result, not a clinical recommendation.</p>
  </div>;
}

function BenchmarkTable({ records, includeQAOA }) {
  const qaoaRecord = records.find((record) => record.method === 'qaoa');
  return <div className="table-scroll benchmark-scroll" role="region" aria-label="Scrollable benchmark table" tabIndex={0}><table className="data-table benchmark-table"><thead><tr><th>Method</th><th>Status</th><th>Objective</th><th>Critical unmet</th><th>Total unmet</th><th>Transport cost</th><th>Feasible</th><th>Runtime</th><th>Gap vs exact</th></tr></thead><tbody>
    {records.map((record) => {
      const status = record.method === 'qaoa' && !includeQAOA && record.status === 'not_requested' ? 'Not run' : record.status;
      return <tr key={record.method}><td><strong>{record.method}</strong></td><td>{status}</td><td>{record.objective_value ?? '—'}</td><td>{record.critical_unmet_demand ?? '—'}</td><td>{record.total_unmet_demand ?? '—'}</td><td>{record.transport_cost ?? '—'}</td><td>{record.feasibility == null ? 'Unavailable' : record.feasibility ? 'Yes' : 'No'}</td><td>{record.runtime_seconds == null ? '—' : `${record.runtime_seconds.toFixed(4)} s`}</td><td>{record.approximation_gap == null ? '—' : `${(record.approximation_gap * 100).toFixed(2)}%`}</td></tr>;
    })}
  </tbody></table>{qaoaRecord?.status === 'skipped_too_large' && <p className="comparison-help">QAOA did not produce a result because the local instance limit was exceeded.</p>}</div>;
}
