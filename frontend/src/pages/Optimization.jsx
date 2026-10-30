import { solverPresentation } from '../utils/solverPresentation';
import QAOAVariantSelect from '../components/QAOAVariantSelect';
import { qaoaVariantConfig, qaoaConfigLabel } from '../utils/qaoaVariants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, CheckCircle2, Play, RotateCcw, TriangleAlert } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';
import { StatItem, MetaRow, StatusBadge } from '../components/DataField';
import OptimizationJourney from '../components/OptimizationJourney';
import GlideSelect from '../components/GlideSelect';
import BorderGlow from '../components/BorderGlow';
import {
  calculateObjectiveUpperBound,
  countScenarioQubits,
  estimateCandidateStates,
} from '../utils/scenarioBounds';

export default function Optimization({ initialRun, initialLoading, initialError, onNavigate }) {
  const { data: scenario, loading: scenarioLoading, error: scenarioError, reload: reloadScenario } = useApi(api.getScenario, []);
  const [method, setMethod] = useState('greedy');
  const [qaoaVariant, setQaoaVariant] = useState('standard');
  const [inventoryPenalty, setInventoryPenalty] = useState('');
  const [demandPenalty, setDemandPenalty] = useState('');
  const [localResult, setLocalResult] = useState(initialRun ?? null);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(initialError || '');
  const [comparison, setComparison] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [includeQAOA, setIncludeQAOA] = useState(false);
  const mutationGeneration = useRef(0);
  useEffect(() => () => { mutationGeneration.current += 1; }, []);
  const result = localResult;
  const loading = localLoading || initialLoading;
  const error = localError;

  // A global Quick Optimization must replace any older page-local run.
  useEffect(() => {
    mutationGeneration.current += 1; setLocalLoading(false); setCompareLoading(false);
    setLocalResult(initialRun ?? null); setLocalError(initialError || ''); setComparison(null);
  }, [initialRun, initialLoading, initialError]);

  const candidateStates = useMemo(() => estimateCandidateStates(scenario), [scenario]);
  const isExactDisabled = candidateStates > 50000;
  const objectiveBound = useMemo(() => calculateObjectiveUpperBound(scenario), [scenario]);
  const scenarioQubits = useMemo(() => countScenarioQubits(scenario), [scenario]);

  useEffect(() => {
    if (isExactDisabled && method === 'exact') setMethod('greedy');
  }, [isExactDisabled, method]);

  useEffect(() => {
    const targets = document.querySelectorAll('.page-optimization .optimization-reveal');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((node) => { node.classList.remove('reveal-pending'); node.classList.add('is-visible'); });
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.remove('reveal-pending'); entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -36px 0px' });
    targets.forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) node.classList.add('is-visible');
      else { node.classList.remove('is-visible'); node.classList.add('reveal-pending'); observer.observe(node); }
    });
    return () => observer.disconnect();
  }, [scenarioLoading, scenarioError, scenario, comparison, result]);

  const qaoaInstanceTooLarge = method === 'qaoa' && (
    /local QAOA limited to .* qubits/i.test(error) ||
    /qaoa_instance_too_large/i.test(error) ||
    /222 binary variables/i.test(error)
  );

  const submit = async (event) => {
    event.preventDefault();
    const generation = ++mutationGeneration.current;
    setCompareLoading(false);
    setLocalError(''); setLocalLoading(true); setLocalResult(null); setComparison(null);
    try {
      if (method === 'exact' && isExactDisabled) {
        throw new Error('The Exact solver is restricted to tiny instances (max 50,000 candidate states). This scenario exceeds that limit.');
      }
      const request = { method };
      if (method === 'qaoa') {
        request.qaoa_config = qaoaVariantConfig(qaoaVariant);
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
      const next = await api.optimize(request);
      if (generation === mutationGeneration.current) setLocalResult(next);
    } catch (issue) {
      if (generation === mutationGeneration.current) setLocalError(issue.message || 'Optimization could not be completed.');
    } finally {
      if (generation === mutationGeneration.current) setLocalLoading(false);
    }
  };

  const runComparison = async () => {
    const generation = ++mutationGeneration.current;
    setLocalLoading(false);
    setCompareError(''); setCompareLoading(true); setComparison(null);
    try {
      const request = { include_qaoa: includeQAOA, include_milp: true };
      if (includeQAOA) {
        request.qaoa_config = qaoaVariantConfig(qaoaVariant);
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
      if (generation === mutationGeneration.current) setComparison((response.results || []).map(row => ({ ...row, method_label: row.method === 'qaoa' ? (row.status === 'not_requested' ? 'QAOA' : qaoaConfigLabel(response.experiment_configuration?.qaoa)) : row.method?.toUpperCase() })));
    } catch (issue) {
      if (generation === mutationGeneration.current) setCompareError(issue.message || 'The benchmark comparison could not be completed.');
    } finally {
      if (generation === mutationGeneration.current) setCompareLoading(false);
    }
  };

  return <>
    <div className="optimization-reveal"><PageHeader eyebrow="SOLVER WORKSPACE" title="Optimization" description="Inspect the active scenario, run an allocator, and compare methods when results are available." /></div>
    {scenarioLoading && <LoadingState label="Loading current scenario…" />}
    {!scenarioLoading && scenarioError && <div className="notice notice-info optimization-api-notice" role="status"><Activity size={16} /><span><strong>Backend not connected.</strong> Your solver settings are ready, but runs need the BloodFlow-Q API. Start it and use Retry when available.</span><button type="button" className="button button-secondary button-small" onClick={reloadScenario}>Retry</button></div>}
    {!scenarioLoading && !scenarioError && scenario?.synthetic === true && <ScenarioPreview scenario={scenario} variableCount={result?.qubo_variable_count} />}
    {!scenarioLoading && !scenarioError && scenario?.synthetic !== true && scenario && <div className="notice notice-error">The backend scenario is not marked synthetic. Optimization is disabled.</div>}

    <div className="optimization-layout optimization-reveal">
      <BorderGlow className="optimization-panel-glow" backgroundColor="var(--bg-surface)" borderRadius={16} glowRadius={12} glowColor="350 82 62" colors={['#ef233c','#8d99ae','#2b2d42']}><section className="panel form-panel">
        <div className="panel-heading"><div><h2>Configure a run</h2><p>Active scenario <strong>{scenario?.id || 'Waiting for API'}</strong></p></div></div>
        <form onSubmit={submit} className="form-stack">
          <label className="field-label" id="solver-method-label">Solver method</label>
          <GlideSelect ariaLabel="Solver method" options={[{value:'greedy',label:'Greedy baseline'},{value:'milp',label:'MILP · HiGHS classical optimal'},{value:'exact',label:isExactDisabled ? 'Exact · unavailable for this scenario' : 'Exact · tiny instances only'},{value:'qaoa',label:'QAOA · local simulator'}]} value={method} onChange={setMethod} showTags={false} accentColor="#ef233c" surfaceColor="var(--bg-surface)" highlightColor="var(--bg-hover)" textColor="var(--text-primary)" className="solver-glide-select" />
          {isExactDisabled && method === 'exact' && (
            <div className="notice notice-info" role="note">
              <TriangleAlert size={16} />
              <span>The Exact solver is restricted to tiny instances (max 50,000 candidate states). This full scenario exceeds that limit. Please select Greedy baseline or MILP.</span>
            </div>
          )}
          {method === 'qaoa' && (
            <div className="qaoa-config-box">
              <QAOAVariantSelect id="optimization-qaoa-variant" value={qaoaVariant} onChange={setQaoaVariant} disabled={loading} />
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
          <button className="button button-primary button-wide run-optimization-button" type="submit" disabled={loading || (scenario && scenario.synthetic !== true)}><Play size={16} fill="currentColor" />{loading ? 'OPTIMIZING…' : 'RUN OPTIMIZATION'}</button>
        </form>
        <div className="optimization-note"><CheckCircle2 size={16} /><span>Returned candidates are classically validated. An infeasible QAOA sample stays visible and is never silently repaired.</span></div>
      </section></BorderGlow>
      <BorderGlow className="optimization-panel-glow" backgroundColor="var(--bg-surface)" borderRadius={16} glowRadius={12} glowColor="350 82 62" colors={['#ef233c','#8d99ae','#2b2d42']}><section className="panel result-panel">
        <div className="panel-heading"><div><h2>Run output</h2><p>Only values returned by the backend are shown.</p></div><RotateCcw size={16} className="muted-icon" /></div>
        {loading && <LoadingState label="The solver is working…" />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && qaoaInstanceTooLarge && <div className="notice notice-info" role="note"><div><strong>The full scenario exceeds the local simulator limit.</strong><p>Use the compact, deterministic scenario in Demo mode to run the same real QUBO → QAOA → decoder → validator pipeline. The full-scenario request above was not replaced with a demo result.</p><button type="button" className="button button-secondary button-small" onClick={() => onNavigate?.('demo')}>Open compact QAOA demo</button></div></div>}
        {!loading && !error && result && <OptimizationResult result={result} scenario={scenario} />}
        {!loading && !error && !result && <div className="result-placeholder"><Play size={22} /><strong>No result yet</strong><span>{scenarioError ? 'Connect the backend to run this solver. Settings stay editable while it is offline.' : 'Choose a solver and start a run. Values unavailable before a run are shown as such.'}</span></div>}
      </section></BorderGlow>
    </div>

    <BorderGlow className="optimization-comparison-glow optimization-reveal" backgroundColor="var(--bg-surface)" borderRadius={16} glowRadius={12} glowColor="350 82 62" colors={['#ef233c','#8d99ae','#2b2d42']}><section className="panel comparison-panel">
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
            <QAOAVariantSelect id="comparison-qaoa-variant" value={qaoaVariant} onChange={setQaoaVariant} disabled={compareLoading} />
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

      {compareLoading && <LoadingState label={includeQAOA ? 'Running selected solvers (Greedy, MILP, Exact, QAOA)…' : 'Running selected solvers (Greedy, MILP, Exact)…'} />}
      {!compareLoading && compareError && <ErrorState message={compareError} />}
      {!compareLoading && !compareError && comparison && (
        <BenchmarkTable scenario={scenario} records={comparison} onNavigate={onNavigate} />
      )}
      {!comparison && !compareLoading && !compareError && (
        <div className="comparison-placeholder">
          <Activity size={20} />
          <span>Click "RUN COMPARISON" above to benchmark the selected methods against this scenario.</span>
        </div>
      )}
    </section></BorderGlow>

    <OptimizationJourney scenario={scenario} method={method} result={result} />
  </>;
}

function ScenarioPreview({ scenario, variableCount }) {
  const banks = scenario.blood_banks || [];
  const hospitals = scenario.hospitals || [];
  const groups = scenario.blood_groups || [];
  const inventoryTotal = banks.reduce((sum, bank) => sum + groups.reduce((bankSum, group) => bankSum + (bank.inventory?.[group] || 0), 0), 0);
  const demandTotal = hospitals.reduce((sum, hospital) => sum + Object.values(hospital.demand || {}).reduce((hospitalSum, units) => hospitalSum + units, 0), 0);

  return (
    <section className="panel scenario-preview optimization-reveal">
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
  const solverLabel = qaoa ? qaoaConfigLabel(result.experiment_configuration?.qaoa) : result.method?.toUpperCase();
  const missingMethodValue = qaoa ? 'Unavailable' : 'Not applicable';
  const banks = Object.fromEntries((scenario?.blood_banks || []).map((bank) => [bank.id, bank.name]));
  const hospitals = Object.fromEntries((scenario?.hospitals || []).map((hospital) => [hospital.id, hospital.name]));
  const satisfaction = result.critical_satisfaction?.rate;

  return (
    <div className="optimization-result">
      <div className="result-status-header">
        <StatusBadge
          status={result.feasibility === false ? 'infeasible' : result.status}
          label={`${solverLabel} · ${result.feasibility === false ? 'INFEASIBLE' : 'FEASIBLE'}`}
        />
        <span className="result-timestamp">Method: <strong>{solverLabel}</strong></span>
      </div>

      <div className="result-kpi-grid">
        <StatItem label="Solver method" value={solverLabel} />
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
          unit="synthetic points"
          value={result.transport_cost != null ? Number(result.transport_cost).toFixed(2) : '—'}
        />
      </div>

      <div className="notice notice-warning" role="note">This is a weighted-cost policy. A lower objective can leave more demand unmet, including critical demand. Feasible means modeled constraints hold—not clinical approval. Use Demo mode to compare it with an explicit service-first policy.</div>
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

function BenchmarkTable({ scenario, records, onNavigate }) {
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
              const presentation = solverPresentation(record);
              const status = presentation.status;
              return (
                <tr key={record.method}>
                  <td><strong>{record.method_label || record.method?.toUpperCase()}</strong></td>
                  <td><StatusBadge status={status} label={presentation.label} />{presentation.explanation && <p className="solver-status-detail">{presentation.explanation}</p>}</td>
                  <td className="text-right num-cell">{record.objective_value != null ? Number(record.objective_value).toFixed(2) : '—'}</td>
                  <td className="text-right num-cell">{record.critical_unmet_demand ?? '—'}</td>
                  <td className="text-right num-cell">{record.total_unmet_demand ?? '—'}</td>
                  <td className="text-right num-cell">{record.transport_cost != null ? Number(record.transport_cost).toFixed(2) : '—'}</td>
                  <td>{record.feasibility == null ? '—' : record.feasibility ? 'Yes' : 'No'}</td>
                  <td className="text-right num-cell">{presentation.runtime}</td>
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
            <strong>What ran in this comparison?</strong>
            <p>
              This scenario contains <strong>{(scenario?.blood_banks?.length || 0) + (scenario?.hospitals?.length || 0)} facilities</strong> and its QUBO encoding needs <strong>{countScenarioQubits(scenario)} bits</strong>. Encoding size does not establish classical hardness; LP/MILP solve the original allocation model.
            </p>
            <ul>
              {exactRecord?.status === 'skipped_too_large' && (
                <li>
                  <strong>Exact solver (Classical):</strong> {exactRecord.detail || 'The candidate-state count exceeds the configured safety limit (default: 50,000).'} The number of candidates is the product of each shipment variable’s (upper bound + 1); it grows multiplicatively. Search was refused before enumeration. This is not a QUBO bitstring count. Use MILP for this scenario.
                </li>
              )}
              {qaoaRecord?.status === 'skipped_too_large' && (
                <li>
                  <strong>QAOA (Quantum Aer Simulator):</strong> Exceeded the 16-qubit local statevector guard. This is a simulator limit, not evidence that classical allocation is hard.
                </li>
              )}
              {qaoaRecord && qaoaRecord.status !== 'skipped_too_large' && !solverPresentation(qaoaRecord).measured && <li><strong>QAOA:</strong> {solverPresentation(qaoaRecord).explanation}</li>}
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
