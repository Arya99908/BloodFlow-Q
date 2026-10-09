import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Play, RotateCcw, TriangleAlert } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';
import { StatItem, MetaRow, StatusBadge } from '../components/DataField';
import {
  calculateObjectiveUpperBound,
  countScenarioQubits,
  estimateCandidateStates,
} from '../utils/scenarioBounds';

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

  const candidateStates = useMemo(() => estimateCandidateStates(scenario), [scenario]);
  const isExactDisabled = candidateStates > 50000;
  const objectiveBound = useMemo(() => calculateObjectiveUpperBound(scenario), [scenario]);
  const scenarioQubits = useMemo(() => countScenarioQubits(scenario), [scenario]);

  useEffect(() => {
    if (isExactDisabled && method === 'exact') setMethod('greedy');
  }, [isExactDisabled, method]);

  const qaoaInstanceTooLarge = method === 'qaoa' && (
    /local QAOA limited to .* qubits/i.test(error) ||
    /qaoa_instance_too_large/i.test(error) ||
    /222 binary variables/i.test(error)
  );

  const submit = async (event) => {
    event.preventDefault();
    setLocalError(''); setLocalLoading(true); setLocalResult(null); setComparison(null);
    try {
      if (method === 'exact' && isExactDisabled) {
        throw new Error('The Exact solver is restricted to tiny instances (max 50,000 candidate states). This scenario exceeds that limit.');
      }
      const request = { method };
      if (method === 'qaoa') {
        if (!inventoryPenalty || !demandPenalty) throw new Error('Enter both explicit QUBO penalty weights before running QAOA.');
        const inv = Number(inventoryPenalty);
        const dem = Number(demandPenalty);
        if (inv <= objectiveBound || dem <= objectiveBound) {
          throw new Error(`QUBO penalty weights must strictly exceed this scenario's theoretical objective bound (> ${objectiveBound}). Please enter larger values (e.g. ${Math.ceil(objectiveBound * 1.5)} or 10000).`);
        }
        request.qaoa_penalties = {
          inventory_penalty_weight: inv,
          demand_penalty_weight: dem,
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
      const request = { include_qaoa: includeQAOA, include_milp: true };
      if (includeQAOA) {
        if (!inventoryPenalty || !demandPenalty) throw new Error('Enter both QUBO penalty weights before including QAOA in the comparison.');
        const inv = Number(inventoryPenalty);
        const dem = Number(demandPenalty);
        if (inv <= objectiveBound || dem <= objectiveBound) {
          throw new Error(`QUBO penalty weights must strictly exceed this scenario's theoretical objective bound (> ${objectiveBound}). Please enter larger values (e.g. ${Math.ceil(objectiveBound * 1.5)} or 10000).`);
        }
        request.qaoa_penalties = {
          inventory_penalty_weight: inv,
          demand_penalty_weight: dem,
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
            <option value="greedy">Greedy baseline</option>
            <option value="milp">MILP (HiGHS classical optimal)</option>
            <option value="exact" disabled={isExactDisabled}>
              {isExactDisabled ? 'Exact (tiny instances only — unavailable for this scenario)' : 'Exact (tiny instances only)'}
            </option>
            <option value="qaoa">QAOA (local simulator; small instances)</option>
          </select>
          {isExactDisabled && method === 'exact' && (
            <div className="notice notice-info" role="note">
              <TriangleAlert size={16} />
              <span>The Exact solver is restricted to tiny instances (max 50,000 candidate states). This full scenario exceeds that limit. Please select Greedy baseline or MILP.</span>
            </div>
          )}
          {method === 'qaoa' && (
            <div className="qaoa-config-box">
              <div className="notice notice-info">
                <TriangleAlert size={16} />
                <span>QUBO penalty weights must be explicit and strictly exceed this scenario’s objective bound (&gt; {objectiveBound}). Insufficient values will be rejected.</span>
              </div>
              {scenarioQubits > 16 && (
                <div className="notice notice-error" role="note">
                  <TriangleAlert size={16} />
                  <div>
                    <strong>Scenario exceeds simulator limit ({scenarioQubits} qubits &gt; 16 max).</strong>
                    <p style={{ margin: '4px 0 6px' }}>The full 7-node scenario creates {scenarioQubits} binary variables, exceeding local Qiskit Aer capacity. Executing this request will return a resource limit refusal.</p>
                    <button type="button" className="button button-secondary button-small" onClick={() => onNavigate?.('demo')}>
                      Switch to Compact QAOA Demo (10 qubits)
                    </button>
                  </div>
                </div>
              )}
              <label className="field-label" htmlFor="inventory-penalty">
                Inventory penalty weight (min &gt; {objectiveBound})
              </label>
              <input
                id="inventory-penalty"
                className="field-control"
                type="number"
                min={Number((objectiveBound + 0.1).toFixed(1))}
                step="any"
                placeholder={`e.g. ${Math.ceil(objectiveBound * 1.5)}`}
                required
                value={inventoryPenalty}
                onChange={(event) => setInventoryPenalty(event.target.value)}
              />
              <label className="field-label" htmlFor="demand-penalty">
                Demand penalty weight (min &gt; {objectiveBound})
              </label>
              <input
                id="demand-penalty"
                className="field-control"
                type="number"
                min={Number((objectiveBound + 0.1).toFixed(1))}
                step="any"
                placeholder={`e.g. ${Math.ceil(objectiveBound * 1.5)}`}
                required
                value={demandPenalty}
                onChange={(event) => setDemandPenalty(event.target.value)}
              />
            </div>
          )}
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
      <div className="panel-heading">
        <div>
          <h2>Method comparison</h2>
          <p>Runs Greedy, MILP, and Exact against this backend’s default scenario. QAOA is included only when you select it.</p>
        </div>
        <Activity size={17} className="muted-icon" />
      </div>

      <div className="comparison-controls-card">
        <div className="comparison-controls-header">
          <div className="checkbox-wrap">
            <label className="checkbox-label">
              <input type="checkbox" checked={includeQAOA} onChange={(event) => setIncludeQAOA(event.target.checked)} />
              <span>Include a measured QAOA simulator run</span>
            </label>
            <p className="comparison-help">
              Greedy, MILP, and Exact run by default. QAOA runs when selected and supported by the backend.
            </p>
          </div>
          <button
            type="button"
            className="button button-primary run-comparison-btn"
            onClick={runComparison}
            disabled={compareLoading}
          >
            <Activity size={15} />
            {compareLoading ? 'RUNNING COMPARISON…' : 'RUN COMPARISON'}
          </button>
        </div>

        {includeQAOA && (
          <div className="qaoa-comparison-params">
            <div className="qaoa-params-grid">
              <div className="form-field">
                <label className="field-label" htmlFor="comp-inv-penalty">
                  Inventory penalty weight (min &gt; {objectiveBound})
                </label>
                <input
                  id="comp-inv-penalty"
                  className="field-control"
                  type="number"
                  min={Number((objectiveBound + 0.1).toFixed(1))}
                  step="any"
                  placeholder={`e.g. ${Math.ceil(objectiveBound * 1.5)}`}
                  value={inventoryPenalty}
                  onChange={(event) => setInventoryPenalty(event.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="comp-dem-penalty">
                  Demand penalty weight (min &gt; {objectiveBound})
                </label>
                <input
                  id="comp-dem-penalty"
                  className="field-control"
                  type="number"
                  min={Number((objectiveBound + 0.1).toFixed(1))}
                  step="any"
                  placeholder={`e.g. ${Math.ceil(objectiveBound * 1.5)}`}
                  value={demandPenalty}
                  onChange={(event) => setDemandPenalty(event.target.value)}
                />
              </div>
            </div>
            <p className="comparison-help" style={{ marginTop: '8px' }}>
              Penalty weights must strictly exceed this scenario’s objective bound (&gt; {objectiveBound}). Oversized QAOA runs (&gt; 16 qubits) will be safely skipped to avoid simulator crashes.
            </p>
          </div>
        )}
      </div>

      {compareLoading && <LoadingState label="Running benchmark solvers (Greedy, MILP, Exact, QAOA)…" />}
      {!compareLoading && compareError && <ErrorState message={compareError} />}
      {!compareLoading && !compareError && comparison && (
        <BenchmarkTable records={comparison} includeQAOA={includeQAOA} onNavigate={onNavigate} />
      )}
      {!comparison && !compareLoading && !compareError && (
        <div className="comparison-placeholder">
          <Activity size={20} />
          <span>Click "RUN COMPARISON" above to benchmark all solvers against this scenario.</span>
        </div>
      )}
    </section>
  </>;
}

function ScenarioPreview({ scenario, variableCount }) {
  const banks = scenario.blood_banks || [];
  const hospitals = scenario.hospitals || [];
  const groups = scenario.blood_groups || [];
  const inventoryTotal = banks.reduce((sum, bank) => sum + groups.reduce((bankSum, group) => bankSum + (bank.inventory?.[group] || 0), 0), 0);
  const demandTotal = hospitals.reduce((sum, hospital) => sum + Object.values(hospital.demand || {}).reduce((hospitalSum, units) => hospitalSum + units, 0), 0);

  return (
    <section className="panel scenario-preview">
      <div className="panel-heading">
        <div>
          <h2>Active scenario baseline</h2>
          <p>Fictional operational network loaded from the backend API</p>
        </div>
        <span className="count-pill">Scenario: <strong>{scenario.id}</strong></span>
      </div>

      <div className="preview-summary-grid">
        <StatItem label="Blood banks" value={banks.length} unit="sources" />
        <StatItem label="Hospitals" value={hospitals.length} unit="destinations" />
        <StatItem label="Total inventory" value={inventoryTotal.toLocaleString()} unit="units" />
        <StatItem label="Total demand" value={demandTotal.toLocaleString()} unit="units" />
        <StatItem
          label="QUBO variables"
          value={variableCount ?? '222 (full)'}
          hint={variableCount == null ? '222 on full scenario (10 on demo)' : 'Derived from active model'}
        />
      </div>

      <div className="scenario-preview-columns">
        <div className="preview-table-block">
          <div className="preview-table-heading">
            <h3>Inventory by blood bank</h3>
            <span>{banks.length} sources</span>
          </div>
          <div className="table-scroll" role="region" aria-label="Inventory by bank table" tabIndex={0}>
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>Bank</th>
                  {groups.map((group) => (
                    <th key={group} className="text-right">{group}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {banks.map((bank) => (
                  <tr key={bank.id}>
                    <td><strong>{bank.name}</strong></td>
                    {groups.map((group) => (
                      <td key={group} className="text-right num-cell">{bank.inventory?.[group] ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="preview-table-block">
          <div className="preview-table-heading">
            <h3>Demand and urgency</h3>
            <span>{hospitals.length} destinations</span>
          </div>
          <div className="table-scroll" role="region" aria-label="Hospital demand table" tabIndex={0}>
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Group</th>
                  <th className="text-right">Units</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {hospitals.flatMap((hospital) =>
                  Object.entries(hospital.demand || {}).map(([group, units]) => {
                    const category = hospital.urgency?.[group]?.category || 'unknown';
                    return (
                      <tr key={`${hospital.id}-${group}`}>
                        <td>{hospital.name}</td>
                        <td><span className="group-token">{group}</span></td>
                        <td className="text-right num-cell"><strong>{units}</strong></td>
                        <td>
                          <span className={`urgency-pill urgency-pill-${category}`}>
                            <i className={`urgency-dot urgency-dot-${category}`} aria-hidden="true" />
                            {category}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function OptimizationResult({ result, scenario }) {
  const qaoa = result.method === 'qaoa';
  const missingMethodValue = qaoa ? 'Unavailable' : 'Not applicable';
  const banks = Object.fromEntries((scenario?.blood_banks || []).map((bank) => [bank.id, bank.name]));
  const hospitals = Object.fromEntries((scenario?.hospitals || []).map((hospital) => [hospital.id, hospital.name]));
  const satisfaction = result.critical_satisfaction?.rate;

  return (
    <div className="optimization-result">
      <div className="result-status-header">
        <StatusBadge
          status={result.feasibility === false ? 'infeasible' : result.status}
          label={`${result.method?.toUpperCase()} · ${result.feasibility === false ? 'INFEASIBLE' : 'FEASIBLE'}`}
        />
        <span className="result-timestamp">Method: <strong>{result.method}</strong></span>
      </div>

      <div className="result-kpi-grid">
        <StatItem label="Solver method" value={result.method?.toUpperCase()} />
        <StatItem
          label="Objective value"
          value={result.total_objective != null ? Number(result.total_objective).toFixed(2) : '—'}
        />
        <StatItem
          label="Feasibility"
          value={result.feasibility == null ? 'Unavailable' : result.feasibility ? 'Feasible' : 'Infeasible'}
          tone={result.feasibility ? 'success' : result.feasibility === false ? 'danger' : 'default'}
        />
        <StatItem
          label="Critical satisfaction"
          value={satisfaction == null ? '—' : `${Math.round(satisfaction * 100)}%`}
          tone={satisfaction != null && satisfaction >= 1 ? 'success' : 'default'}
        />
        <StatItem
          label="Total unmet demand"
          value={result.total_unmet_demand ?? '0'}
          unit="units"
          tone={Number(result.total_unmet_demand || 0) > 0 ? 'warning' : 'default'}
        />
        <StatItem
          label="Transport cost"
          value={result.transport_cost != null ? Number(result.transport_cost).toFixed(2) : '—'}
        />
      </div>

      <div className="panel solver-metadata-panel">
        <div className="metadata-panel-heading">Solver diagnostic parameters</div>
        <div className="metadata-row-grid">
          <MetaRow label="QUBO variables" value={result.qubo_variable_count ?? missingMethodValue} />
          <MetaRow label="QAOA depth (p)" value={result.qaoa_depth ?? missingMethodValue} />
          <MetaRow label="Simulation shots" value={result.shots ?? missingMethodValue} />
          <div className="bitstring-box">
            <span className="bitstring-label">Best measured bitstring:</span>
            <code className="bitstring-code">{result.best_measured_bitstring || missingMethodValue}</code>
          </div>
        </div>
      </div>

      {!qaoa && (
        <p className="comparison-help">
          QUBO variable count, QAOA depth, shots, and measured bitstrings apply strictly to quantum/QUBO solvers.
        </p>
      )}
      {qaoa && result.best_measured_bitstring && (
        <p className="comparison-help">
          The best measured candidate bitstring is sampled from the simulated quantum circuit; it is not a proof of global optimality.
        </p>
      )}

      {result.violations?.length > 0 && (
        <div className="notice notice-error" role="alert">
          <TriangleAlert size={16} />
          <div>
            <strong>Feasibility violations detected</strong>
            <ul>
              {result.violations.map((item, index) => (
                <li key={index}>{item.message || JSON.stringify(item)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="result-section-title">Shipment allocation decisions</div>
      {result.allocation?.length ? (
        <div className="table-scroll" role="region" aria-label="Allocation shipments table" tabIndex={0}>
          <table className="data-table allocation-table">
            <thead>
              <tr>
                <th>Blood bank</th>
                <th>Hospital</th>
                <th>Product group</th>
                <th>Recipient group</th>
                <th className="text-right">Shipment units</th>
              </tr>
            </thead>
            <tbody>
              {result.allocation.map((item, index) => (
                <tr key={`${item.source}-${item.destination}-${item.blood_group}-${index}`}>
                  <td>{banks[item.source] || item.source}</td>
                  <td>{hospitals[item.destination] || item.destination}</td>
                  <td><span className="group-token">{item.blood_group}</span></td>
                  <td><span className="group-token">{item.recipient_group}</span></td>
                  <td className="text-right num-cell"><strong>{item.quantity} units</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted-copy">No units were allocated by this returned candidate.</p>
      )}

      <div className="result-section-title">Unmet demand by hospital and group</div>
      {result.unmet_demand?.some((item) => item.units > 0) ? (
        <div className="compact-allocation-list">
          {result.unmet_demand.filter((item) => item.units > 0).map((item) => (
            <div className="allocation-row" key={`${item.hospital_id}-${item.blood_group}`}>
              <span><strong>{hospitals[item.hospital_id] || item.hospital_id}</strong></span>
              <span className="group-token">{item.blood_group}</span>
              <strong className="unmet-unit-badge">{item.units} units unmet</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted-copy">Zero unmet demand: all hospital requirements were fully satisfied.</p>
      )}

      <p className="small-disclaimer">
        Solver output represents aggregate operational optimization over synthetic logistics data. Not intended for clinical transfusion decisions.
      </p>
    </div>
  );
}

function BenchmarkTable({ records, includeQAOA, onNavigate }) {
  const qaoaRecord = records.find((record) => record.method === 'qaoa');
  const exactRecord = records.find((record) => record.method === 'exact');
  const isAnySkipped = qaoaRecord?.status === 'skipped_too_large' || exactRecord?.status === 'skipped_too_large';

  return (
    <div className="benchmark-container">
      <div className="table-scroll" role="region" aria-label="Benchmark comparison table" tabIndex={0}>
        <table className="data-table benchmark-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Status</th>
              <th className="text-right">Objective</th>
              <th className="text-right">Critical unmet</th>
              <th className="text-right">Total unmet</th>
              <th className="text-right">Transport cost</th>
              <th>Feasible</th>
              <th className="text-right">Runtime</th>
              <th className="text-right">Gap vs exact</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const status = record.method === 'qaoa' && !includeQAOA && record.status === 'not_requested' ? 'Not run' : record.status;
              return (
                <tr key={record.method}>
                  <td><strong>{record.method?.toUpperCase()}</strong></td>
                  <td><StatusBadge status={status} label={status?.replaceAll('_', ' ')} /></td>
                  <td className="text-right num-cell">{record.objective_value != null ? Number(record.objective_value).toFixed(2) : '—'}</td>
                  <td className="text-right num-cell">{record.critical_unmet_demand ?? '—'}</td>
                  <td className="text-right num-cell">{record.total_unmet_demand ?? '—'}</td>
                  <td className="text-right num-cell">{record.transport_cost != null ? Number(record.transport_cost).toFixed(2) : '—'}</td>
                  <td>{record.feasibility == null ? '—' : record.feasibility ? 'Yes' : 'No'}</td>
                  <td className="text-right num-cell">{record.runtime_seconds == null ? '—' : `${Number(record.runtime_seconds).toFixed(4)} s`}</td>
                  <td className="text-right num-cell">{record.approximation_gap == null ? '—' : `${(record.approximation_gap * 100).toFixed(2)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isAnySkipped && (
        <div className="notice notice-info benchmark-skip-notice" role="note">
          <TriangleAlert size={18} />
          <div>
            <strong>Why were Exact or QAOA skipped on this scenario?</strong>
            <p>
              This full 7-node operational scenario models <strong>222 binary variables (qubits)</strong> and over <strong>10<sup>66</sup> candidate states</strong>.
            </p>
            <ul>
              {exactRecord?.status === 'skipped_too_large' && (
                <li>
                  <strong>Exact solver (Classical):</strong> Exceeded the 50,000 candidate-state safety limit. Exhaustive brute-force evaluation of 222 binary variables is computationally intractable.
                </li>
              )}
              {qaoaRecord?.status === 'skipped_too_large' && (
                <li>
                  <strong>QAOA (Quantum Aer Simulator):</strong> Exceeded the 16-qubit simulator memory limit (222 qubits &gt; 16 max). Statevector memory scales exponentially (2<sup>n</sup>), making 222 qubits physically impossible to simulate classically.
                </li>
              )}
            </ul>
            <div className="benchmark-notice-action">
              <span>Both solvers run live on compact scenarios:</span>
              <button
                type="button"
                className="button button-primary button-small"
                onClick={() => onNavigate?.('demo')}
              >
                Switch to Compact QAOA Demo (10 qubits) →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
