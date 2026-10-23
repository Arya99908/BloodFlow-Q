import { useEffect, useState } from 'react';

const LABELS = { standard: 'Standard QAOA', warm: 'Warm-start QAOA', reduced: 'Shipment-only encoding', feasible_grover: 'Feasible-subspace mixer' };

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
  return <section className="panel research-panel">
    <div className="panel-heading"><div><span className="eyebrow">SAVED FOLLOW-UP · {data.date}</span><h2>Does the quantum component add value?</h2></div><a className="button button-secondary button-small" href="/quantum-followup-study.json" download>Download findings and provenance</a></div>
    <p>{data.quantum.runs} controlled quantum-study runs across training and held-out cases, followed by {data.replacement.runs} hybrid replacement runs. These are saved measurements; opening this page does not execute an experiment.</p>
    <div className="table-scroll"><table className="data-table"><caption>Held-out ideal per-shot probabilities · {data.quantum.instances} instances · {data.quantum.seeds_per_instance} seeds each</caption><thead><tr><th>Method</th><th>Optimal and feasible</th><th>Any feasible</th></tr></thead><tbody>{data.quantum.methods.filter(row => LABELS[row.method]).map(row => <tr key={row.method}><th>{LABELS[row.method]}</th><td>{(100 * row.mean_p_optimal).toFixed(2)}%</td><td>{(100 * row.mean_p_feasible).toFixed(2)}%</td></tr>)}</tbody></table></div>
    <p>Quantum neighborhood search tied its classical MILP replacement on final objective in {ties}/{total} paired runs. Classical LP already reached the exact optimum on all eight held-out allocation cases. Higher sample probability does not establish a better allocation or faster solver.</p>
    <p>{data.execution} The experimental reduced encoding and feasible mixer enumerate candidate states. The dispatch-fee extension is hypothetical and is separate from the production allocation model.</p>
    <p className="helper-text">The Round 2 study below is historical and uses different configurations; its results should not be pooled with this follow-up.</p>
  </section>;
}
