import { useEffect, useState } from 'react';

import { researchMethodRows } from '../utils/qaoaVariants';
const percent = value => Number.isFinite(value) ? `${(100 * value).toFixed(2)}%` : 'Not available';

export default function ResearchFollowup() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/quantum-followup-study.json').then(response => {
      if (!response.ok) throw new Error(`Follow-up study unavailable (${response.status}).`);
      return response.json();
    }).then(value => {
      if (value.kind !== 'saved_research_snapshot' || !Array.isArray(value.quantum?.methods) || !Array.isArray(value.replacement?.comparisons)) throw new Error('Follow-up study format is invalid.');
      if (active) setData(value);
    }).catch(issue => { if (active) setError(issue.message); });
    return () => { active = false; };
  }, []);
  if (error) return <section className="panel" role="status"><h2>Latest research follow-up</h2><p>{error} Historical study data below remains separate.</p></section>;
  if (!data) return <section className="panel" role="status">Loading the saved research follow-up…</section>;
  const comparisons = data.replacement.comparisons.filter(row => row.classical_replacement === 'milp');
  const ties = comparisons.reduce((sum, row) => sum + row.ties, 0);
  const total = comparisons.reduce((sum, row) => sum + row.ties + row.quantum_wins + row.quantum_losses, 0);
  return <section id="qaoa-mixer-study" className="panel research-panel">
    <div className="panel-heading"><div><span className="eyebrow">SAVED FOLLOW-UP · {data.date}</span><h2>QAOA variants, mixers and research methods</h2></div><a className="button button-secondary button-small" href="/quantum-followup-study.json" download>Download findings and provenance</a></div>
    <p>{data.quantum.runs} controlled quantum-study runs across training and held-out cases, followed by {data.replacement.runs} hybrid replacement runs. These are saved measurements; opening this page does not execute an experiment.</p>
    <p>All {data.quantum.methods.length} measured methods are shown below. Warm-start changes the initial state; X, matched warm-start, XY and Grover describe mixer choices. CVaR changes the optimization objective, and shipment-only changes the encoding.</p>
    <div className="table-scroll"><table className="data-table"><caption>Saved held-out ideal per-shot probabilities · {data.quantum.instances} instances · {data.quantum.seeds_per_instance} seeds each · separate from the legacy benchmark</caption><thead><tr><th>Method</th><th>Availability</th><th>Runs</th><th>Optimal and feasible</th><th>Any feasible</th></tr></thead><tbody>{researchMethodRows(data.quantum.methods).map(row => <tr key={row.method}><th>{row.label}</th><td>{row.type}</td><td>{row.runs ?? 'Not recorded'}</td><td>{percent(row.mean_p_optimal)}</td><td>{percent(row.mean_p_feasible)}</td></tr>)}</tbody></table></div>
    <p>XY exchanges preserve Hamming weight, but do not generally preserve the allocation constraints. The feasible-subspace Grover mixer is a separate research prototype; its ideal feasibility result does not make XY feasibility-preserving.</p>
    <a className="button button-secondary button-small" href="/demo">Run Standard, Warm-start, XY or Warm-start + XY</a>

    <p>Quantum neighborhood search tied its classical MILP replacement on final objective in {ties}/{total} paired runs. Classical LP already reached the exact optimum on all eight held-out allocation cases. Higher sample probability does not establish a better allocation or faster solver.</p>
    <p>{data.execution} The experimental reduced encoding and feasible mixer enumerate candidate states. The dispatch-fee extension is hypothetical and is separate from the production allocation model.</p>
    <p className="helper-text">The Round 2 study below is historical and uses different configurations; its results should not be pooled with this follow-up.</p>
  </section>;
}
