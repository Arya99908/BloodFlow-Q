import QuantumExecutionInspector from '../components/QuantumExecutionInspector';
import { useMemo, useState } from 'react';
import { Atom, ArrowRight, Check, CircleHelp, Download, FileChartColumn, FlaskConical, RotateCcw } from 'lucide-react';
import { useResearchStudy } from '../hooks/useResearchStudy';
import { ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';

const LABELS = {
  normal_reference: 'Normal reference', inventory_shortage: 'Inventory shortage',
  transport_cost_tradeoff: 'Transport cost tradeoff', emergency_demand_spike: 'Emergency demand spike',
  transport_disruption: 'Transport disruption', multi_facility_tradeoff: 'Multi-facility tradeoff',
};
const fmt = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits }) : 'Not available';

export default function QuantumLab({ onNavigate }) {
  const { study, error } = useResearchStudy();
  const [scenarioId, setScenarioId] = useState('multi_facility_tradeoff');
  const [seed, setSeed] = useState('301');
  const configuration = study?.configuration;
  const scenarios = configuration?.scenarios || {};
  const qaoaRuns = useMemo(() => (study?.results || []).filter((row) => row.method === 'qaoa' && row.scenario_id === scenarioId), [study, scenarioId]);
  const record = qaoaRuns.find((row) => String(row.seed) === seed) || qaoaRuns[0];
  const distribution = useMemo(() => {
    if (!record || !record.counts || !Number.isFinite(Number(record.shots))) return [];
    const observations = Object.entries(record.counts).filter(([bits, count]) => /^[01]+$/.test(bits) && Number.isFinite(Number(count)) && Number(count) > 0);
    const total = observations.reduce((sum, [, count]) => sum + Number(count), 0);
    if (!total || total !== Number(record.shots) || observations.some(([bits]) => bits.length !== Number(record.qubo_variable_count))) return [];
    return observations.sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0])).slice(0, 12).map(([bits, count]) => ({ bits, count: Number(count), pct: Number(count) / total * 100, total, best: bits === record.best_measured_bitstring }));
  }, [record]);
  const scenarioRuns = useMemo(() => (study?.results || []).filter((row) => row.scenario_id === scenarioId), [study, scenarioId]);
  const qaoaFeasible = qaoaRuns.filter((row) => row.feasibility === true).length;
  const qaoaInfeasible = qaoaRuns.filter((row) => row.feasibility === false).length;
  const classical = scenarioRuns.filter((row) => row.method === 'classical_multistart' && row.status === 'completed' && row.feasibility === true);
  const hybrid = scenarioRuns.filter((row) => row.method === 'hybrid_qaoa_local_search' && row.status === 'completed' && row.feasibility === true);

  if (error) return <><PageHeader eyebrow="QUANTUM METHODS" title="Quantum Optimization Lab" description="Inspect the measured QUBO, Ising and QAOA experiment artifact." /><ErrorState message={error} /></>;
  if (!study) return <><PageHeader eyebrow="QUANTUM METHODS" title="Quantum Optimization Lab" description="Inspect the measured QUBO, Ising and QAOA experiment artifact." /><LoadingState label="Loading saved experiment measurements…" /></>;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ configuration, results: [...qaoaRuns] }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `bloodflow-q-${scenarioId}-qaoa-evidence.json`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <>
    <PageHeader eyebrow="MEASURED QUANTUM PIPELINE" title="Quantum Optimization Lab" description="Follow an actual saved QAOA sample from binary model to decoded, independently validated allocation." action={<button className="button button-secondary" onClick={exportJson}><Download size={15} /> Export selected scenario</button>} />
    
    
    
    <QuantumExecutionInspector />
    <section className="qlab-intro"><div className="qlab-orb"><Atom size={24} /></div><div><span className="eyebrow">RESEARCH ARTIFACT · LOCAL QISKIT AER SIMULATOR</span><h2>Optimization as an inspectable pipeline</h2><p>The binary model encodes shipment, unmet-demand and inventory-slack quantities. The Ising operator preserves its energy; QAOA samples candidate bitstrings; the shared classical decoder and validator check the resulting allocation.</p></div><div className="qlab-context"><strong>{configuration.suite || 'Research suite'}</strong><span>{configuration.qaoa_repetitions || 0} seeds per scenario</span><span>Synthetic scenarios</span></div></section>
    <section className="qlab-pipeline" aria-label="Actual solver pipeline">
      {['Allocation model', 'QUBO', 'Ising Z / ZZ', 'QAOA simulator', 'Decode sample', 'Independent validation', 'Classical reference'].map((step, index) => <div className="qlab-step" key={step}><span className="qlab-step-index">0{index + 1}</span><strong>{step}</strong>{index < 6 && <ArrowRight className="qlab-step-arrow" size={14} aria-hidden="true" />}</div>)}
    </section>
    <section className="panel qlab-run-panel">
      <div className="panel-heading"><div><h2>Inspect a saved QAOA run</h2><p>Values below are read directly from the raw Round 2 artifact; unavailable values are left blank.</p></div><FlaskConical size={18} className="muted-icon" /></div>
      <div className="qlab-controls"><label className="demo-field">Synthetic scenario<select className="field-control" value={scenarioId} onChange={(event) => { setScenarioId(event.target.value); const next = (study.results || []).find((row) => row.method === 'qaoa' && row.scenario_id === event.target.value); if (next) setSeed(String(next.seed)); }}><option value="multi_facility_tradeoff">Multi-facility tradeoff</option>{Object.keys(scenarios).filter((id) => id !== 'multi_facility_tradeoff').map((id) => <option key={id} value={id}>{LABELS[id] || id.replaceAll('_', ' ')}</option>)}</select></label><label className="demo-field">Experiment seed<select className="field-control" value={record ? String(record.seed) : seed} onChange={(event) => setSeed(event.target.value)}>{qaoaRuns.map((row) => <option key={row.seed} value={row.seed}>{row.seed} · {row.status}</option>)}</select></label><div className="qlab-run-id"><span>Case</span><strong>{record?.scenario_id || 'No run'}</strong></div></div>
      {!record ? <p className="chart-unavailable">No saved QAOA record exists for this scenario.</p> : <>
        <div className="qlab-metrics"><Metric label="Encoded binary variables / qubits" value={record.qubo_variable_count ?? 'Not available'} note="Variable map order is preserved through Ising conversion" /><Metric label="Circuit depth p" value={record.qaoa_depth ?? 'Not available'} note="Recorded QAOA layer count" /><Metric label="Measured shots" value={record.shots ?? 'Not available'} note={distribution[0] ? `${distribution[0].total} observations in stored counts` : 'Count histogram unavailable'} /><Metric label="Seed runtime" value={record.runtime_seconds == null ? 'Not available' : `${fmt(record.runtime_seconds, 4)} s`} note="Local simulator runtime" /></div>
        <div className="qlab-detail-grid">
          <section className="qlab-inner-panel"><div className="qlab-panel-title"><div><span className="eyebrow">MEASURED COUNTS</span><h3>Most frequent bitstrings</h3></div><CircleHelp size={15} /></div>{distribution.length ? <><p className="qlab-small-note">Showing 12 most frequent observed outcomes. Bar width uses the count total <strong>{distribution[0].total}</strong>; the marked outcome is the recorded best measured bitstring.</p><div className="qlab-histogram">{distribution.map(({ bits, count, pct, best }) => <div className={`qlab-hist-row ${best ? 'qlab-hist-best' : ''}`} key={bits}><code>{bits}</code><div className="qlab-hist-track" role="img" aria-label={`${bits}: ${count} shots, ${pct.toFixed(1)} percent`}><i style={{ width: `${Math.max(2, pct)}%` }} /></div><strong>{count}</strong></div>)}</div><div className="qlab-best-bit">Best measured bitstring <code>{record.best_measured_bitstring || 'Not available'}</code></div></> : <p className="chart-unavailable">The artifact’s count data did not pass consistency checks, so no histogram is shown.</p>}</section>
          <section className="qlab-inner-panel"><div className="qlab-panel-title"><div><span className="eyebrow">DECODED CANDIDATE</span><h3>Validation and comparison</h3></div><Check size={15} /></div><div className="qlab-validation-status"><span className={record.validation?.feasible === true ? 'qlab-feasible' : record.validation?.feasible === false ? 'qlab-infeasible' : ''}>{record.validation?.feasible == null ? 'Validation unavailable' : record.validation.feasible ? 'Feasible · validator passed' : 'Infeasible · excluded from feasible comparison'}</span><strong>{record.validation?.feasible !== true ? 'No feasible objective comparison' : record.objective == null ? 'Objective not reported' : `Validated objective ${fmt(record.objective)}`}</strong></div>{record.validation?.checks && <div className="qlab-checks">{Object.entries(record.validation.checks).map(([label, passed]) => <div key={label}><span>{label.replaceAll('_', ' ')}</span><strong className={passed ? 'check-pass' : 'check-fail'}>{passed ? 'PASS' : 'FAIL'}</strong></div>)}</div>}{record.validation?.violations?.length > 0 && <p className="qlab-violations">{record.validation.violations.join(' · ')}</p>}<div className="qlab-baseline-compare"><h4>Same synthetic case · feasible runs</h4><div><span>Classical multistart</span><strong>{classical.length} / {configuration.classical_search?.repetitions ?? '—'}</strong></div><div><span>Raw QAOA</span><strong>{qaoaFeasible} feasible · {qaoaInfeasible} infeasible</strong></div><div><span>QAOA + local refinement</span><strong>{hybrid.length} completed feasible</strong></div></div></section>
        </div>
        <details className="saved-result-details qlab-raw"><summary>Inspect this complete raw QAOA record</summary><pre>{JSON.stringify(record, null, 2)}</pre></details>
      </>}
    </section>
    <section className="qlab-research-note"><div><span className="eyebrow">SCIENTIFIC INTERPRETATION</span><h2>What this study supports</h2><p>This small synthetic study evaluates whether a QAOA-derived feasible candidate helps a bounded classical local search. It does not demonstrate quantum advantage. Infeasible raw samples remain visible; the hybrid skips them instead of repairing them.</p><p><strong>Next research direction:</strong> paired post-disruption reallocation on larger multi-bank / multi-hospital networks, comparing QAOA initialization against greedy and seeded feasible classical starts under the same one-unit neighborhood and evaluation budget, across preregistered seeds. Record feasibility, validated objective, time-to-target, runtime, and variability.</p></div><div className="qlab-note-actions"><button className="button button-secondary" onClick={() => onNavigate('results')}><RotateCcw size={14} /> Solver Lab</button><button className="button button-secondary" onClick={() => onNavigate('reports')}><FileChartColumn size={14} /> Experiment reports</button></div></section>
    <div className="prototype-note"><CircleHelp size={16} /><span>QAOA runs use a local classical simulator, not quantum hardware. Scenarios and measurements are synthetic; the interface is not for clinical decisions or physical blood delivery.</span></div>
  </>;
}

function Metric({ label, value, note }) { return <article className="qlab-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
