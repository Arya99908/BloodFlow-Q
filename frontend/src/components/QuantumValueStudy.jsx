import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from './Feedback';
import { StatusBadge } from './DataField';
import { useResearchStudy } from '../hooks/useResearchStudy';

const CLASSICAL_ORDER = ['milp', 'exact', 'classical_multistart', 'greedy'];

export default function QuantumValueStudy() {
  const { study, error } = useResearchStudy();
  const [scenarioId, setScenarioId] = useState('multi_facility_tradeoff');
  const [seed, setSeed] = useState('201');

  const scenarios = Object.keys(study?.configuration?.scenario_sizes || {});
  const rows = useMemo(() => (study?.results || []).filter((row) => row.scenario_id === scenarioId), [study, scenarioId]);
  const size = study?.configuration?.scenario_sizes?.[scenarioId];
  const byMethod = (method) => rows.find((row) => row.method === method && row.seed == null);
  const byTrial = (method) => rows.find((row) => row.method === method && String(row.seed) === seed);
  const classical = useMemo(() => {
    const options = [...CLASSICAL_ORDER.map(byMethod), byTrial('classical_multistart')]
      .filter((row) => row?.feasibility === true && Number.isFinite(row.objective));
    options.sort((a, b) => a.objective - b.objective || CLASSICAL_ORDER.indexOf(a.method) - CLASSICAL_ORDER.indexOf(b.method));
    return options[0] || null;
  }, [rows]);
  const classicalSearch = byTrial('classical_multistart');
  const rawQaoa = byTrial('qaoa');
  const hybrid = byTrial('hybrid_qaoa_local_search');
  const selected = useMemo(() => {
    const options = [classical, hybrid, rawQaoa].filter((row) => row?.feasibility === true && Number.isFinite(row.objective));
    options.sort((a, b) => a.objective - b.objective || Number(a.method !== 'milp') - Number(b.method !== 'milp'));
    return options[0] || null;
  }, [classical, hybrid, rawQaoa]);

  return <section className="panel quantum-value-study" aria-labelledby="quantum-value-title">
    <div className="panel-heading"><div>
      <h2 id="quantum-value-title">Does the QAOA candidate help?</h2>
      <p>Saved synthetic benchmark · Qiskit Aer local simulator · independently validated results</p>
    </div></div>
    <p className="comparison-help">Inspect the best classical allocation, the raw measured QAOA candidate, and that same candidate after the bounded classical refinement. Infeasible QAOA samples are left unrepaired. The selected result is the lowest-objective feasible candidate for this scenario and seed.</p>
    {error && <ErrorState message={error} />}
    {!study && !error && <LoadingState label="Loading saved research results…" />}
    {study && <>
      <div className="quantum-study-controls">
        <label className="demo-field">Synthetic scenario
          <select className="field-control" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
            {scenarios.map((id) => <option key={id} value={id}>{id.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label className="demo-field">Trial seed
          <select className="field-control" value={seed} onChange={(event) => setSeed(event.target.value)}>
            {Array.from({ length: 10 }, (_, index) => String(201 + index)).map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      {size && <p className="comparison-help">Model: {size.blood_banks} banks · {size.hospitals} hospitals · {size.blood_groups} group · {size.routes} routes · {size.allocation_decision_variables} shipment variables · {rows.find((row) => row.method === 'qaoa')?.qubo_variable_count ?? '—'} QUBO bits. QAOA: p={study.configuration.qaoa.p}, {study.configuration.qaoa.shots} shots, {study.configuration.qaoa.optimizer}/{study.configuration.qaoa.max_iterations} iterations.</p>}
      <div className="table-scroll" role="region" aria-label="Saved quantum and classical candidate comparison" tabIndex={0}>
        <table className="data-table">
          <thead><tr><th>Candidate</th><th>Produced by</th><th className="text-right">Objective</th><th>Feasibility</th><th className="text-right">Unmet</th><th className="text-right">Transport cost</th><th className="text-right">End-to-end time</th></tr></thead>
          <tbody>
            <CandidateRow label="Best classical" row={classical} unavailable="No feasible classical reference" />
            <CandidateRow label="Classical multistart" row={classicalSearch} unavailable="No multistart result" />
            <CandidateRow label="Raw QAOA" row={rawQaoa} unavailable={rawQaoa?.status === 'error' ? 'QAOA run failed' : 'No QAOA result'} />
            <CandidateRow label="Hybrid refined" row={hybrid} unavailable={hybrid?.status === 'skipped_infeasible_qaoa_seed' ? 'Not run: raw QAOA sample is infeasible; no repair was applied' : 'No hybrid result'} />
            <CandidateRow label="Selected final" row={selected} unavailable="No feasible candidate to select" />
          </tbody>
        </table>
      </div>
      {selected && <p className="quantum-study-selection"><strong>Selected producer: {selected.method.toUpperCase()}.</strong> Selection used only the original objective among validated feasible candidates. This is a synthetic research comparison, not a blood delivery or clinical recommendation.</p>}
      <div className="quantum-study-allocations">
        {[['Best classical', classical], ['Classical multistart', classicalSearch], ['Raw QAOA', rawQaoa], ['Hybrid refined', hybrid]].map(([label, row]) => row?.allocation?.length > 0 && <details key={label}>
          <summary>{label} allocation — {row.method.toUpperCase()}</summary>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Source</th><th>Hospital</th><th>Group</th><th className="text-right">Units</th></tr></thead><tbody>{row.allocation.map((item, index) => <tr key={`${label}-${index}`}><td>{item.source}</td><td>{item.destination}</td><td>{item.blood_group}{item.recipient_group !== item.blood_group ? ` → ${item.recipient_group}` : ''}</td><td className="text-right num-cell">{item.quantity}</td></tr>)}</tbody></table></div>
        </details>)}
      </div>
      {scenarios.length === 0 && <EmptyState title="No scenarios in this saved run" detail="The experiment artifact contains no scenario metadata." />}
      <p className="quantum-study-footnote">Run ID: {study.configuration?.invocation?.arguments?.slice(-1)[0] || 'saved confirmatory experiment'}. QAOA and timing measurements are from a classical simulator on one local machine. <a href="/quantum-value-study-config.json" download>Download this run’s configuration.</a> <a href="https://github.com/syedafnan7-lab/BloodFlow-Q1/blob/codex/round2-research-hardening/docs/QUANTUM_VALUE_FINDINGS.md" target="_blank" rel="noreferrer">Read the paired-seed findings and limitations.</a></p>
    </>}
  </section>;
}

function CandidateRow({ label, row, unavailable }) {
  if (!row) return <tr><th scope="row">{label}</th><td colSpan="6" className="muted-copy">{unavailable}</td></tr>;
  const feasible = row.feasibility === true;
  const objective = feasible ? Number(row.objective).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 'Excluded (infeasible)';
  return <tr>
    <th scope="row">{label}</th>
    <td><strong>{row.method.toUpperCase()}</strong></td>
    <td className="text-right num-cell">{objective}</td>
    <td>{row.feasibility == null ? row.status : <StatusBadge status={feasible ? 'feasible' : 'infeasible'} />}</td>
    <td className="text-right num-cell">{feasible ? row.total_unmet_demand : '—'}</td>
    <td className="text-right num-cell">{feasible ? row.transport_cost : '—'}</td>
    <td className="text-right num-cell">{row.runtime_seconds == null ? '—' : `${(row.runtime_seconds * 1000).toFixed(2)} ms`}</td>
  </tr>;
}
