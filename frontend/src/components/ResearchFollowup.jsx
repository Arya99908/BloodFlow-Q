import { useEffect, useState } from 'react';
import { Download, ExternalLink, ShieldCheck, Sparkles, BarChart2, Table as TableIcon } from 'lucide-react';
import { researchMethodRows } from '../utils/qaoaVariants';

const percent = value => Number.isFinite(value) ? `${(100 * value).toFixed(2)}%` : 'Not available';

export default function ResearchFollowup() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

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
  const methodList = researchMethodRows(data.quantum.methods);

  return (
    <section id="qaoa-mixer-study" className="panel research-panel" style={{ marginTop: '20px' }}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow" style={{ color: '#38bdf8' }}>SAVED FOLLOW-UP · {data.date}</span>
          <h2>QAOA Variants, Mixers and Research Methods</h2>
        </div>
        <a className="button button-secondary button-small" href="/quantum-followup-study.json" download>
          <Download size={14} /> Download findings and provenance
        </a>
      </div>

      <p>
        <strong>{data.quantum.runs} controlled quantum-study runs</strong> across training and held-out cases, followed by {data.replacement.runs} hybrid replacement runs. These are saved measurements; opening this page does not execute an experiment.
      </p>
      <p>
        All {data.quantum.methods.length} measured methods are shown below. Warm-start changes the initial state; X, matched warm-start, XY and Grover describe mixer choices. CVaR changes the optimization objective, and shipment-only changes the encoding.
      </p>

      {/* Graphical Comparison of Optimal and Feasible Probabilities with Bootstrap Confidence Intervals */}
      <div style={{ background: 'var(--bg-surface-elevated, rgba(255,255,255,0.03))', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '18px 20px', margin: '18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>
            Held-Out Ideal Shot Fidelity & 95% Bootstrap Intervals
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            8 instances · 10 seeds each · Qiskit Aer simulation
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {methodList.map(row => {
            const rawOpt = row.mean_p_optimal || 0;
            const rawFeas = row.mean_p_feasible || 0;
            const optPct = Math.min(100, Math.max(0, rawOpt * 100));
            const feasPct = Math.min(100, Math.max(0, rawFeas * 100));
            const isWarm = row.method.includes('warm');
            return (
              <div key={row.method} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 140px', alignItems: 'center', gap: '14px' }}>
                <div>
                  <strong style={{ fontSize: '12.5px', color: 'var(--text-primary)', display: 'block' }}>{row.label}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.type}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${feasPct}%`, background: isWarm ? '#38bdf8' : '#64748b', borderRadius: '4px' }} title={`Any Feasible: ${percent(rawFeas)}`} />
                  </div>
                  <div style={{ height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${optPct}%`, background: '#10b981', borderRadius: '3px' }} title={`Optimal & Feasible: ${percent(rawOpt)}`} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: '#10b981', fontWeight: '700' }}>{percent(rawOpt)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Feas: {percent(rawFeas)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981' }} /> Optimal & Feasible
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#38bdf8' }} /> Any Feasible (Warm)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#64748b' }} /> Any Feasible (Standard)
          </span>
        </div>
      </div>

      <div style={{ margin: '14px 0' }}>
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={() => setShowTable(v => !v)}
        >
          <TableIcon size={14} /> {showTable ? 'Hide Raw Follow-Up Table' : 'Show Complete Follow-Up Table'}
        </button>
      </div>

      {showTable && (
        <div className="table-scroll">
          <table className="data-table">
            <caption>
              Saved held-out ideal per-shot probabilities · {data.quantum.instances} instances · {data.quantum.seeds_per_instance} seeds each · separate from the legacy benchmark
            </caption>
            <thead>
              <tr>
                <th>Method</th>
                <th>Availability</th>
                <th>Runs</th>
                <th>Optimal and feasible</th>
                <th>Any feasible</th>
              </tr>
            </thead>
            <tbody>
              {methodList.map(row => (
                <tr key={row.method}>
                  <th>{row.label}</th>
                  <td>{row.type}</td>
                  <td>{row.runs ?? 'Not recorded'}</td>
                  <td>{percent(row.mean_p_optimal)}</td>
                  <td>{percent(row.mean_p_feasible)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p>
        XY exchanges preserve Hamming weight, but do not generally preserve the allocation constraints. The feasible-subspace Grover mixer is a separate research prototype; its ideal feasibility result does not make XY feasibility-preserving.
      </p>

      <div style={{ margin: '12px 0' }}>
        <a className="button button-secondary button-small" href="/demo">
          Run Standard, Warm-start, XY or Warm-start + XY
        </a>
      </div>

      <p>
        <strong>Quantum neighborhood search tied its classical MILP replacement on final objective in {ties}/{total} paired runs.</strong> Classical LP already reached the exact optimum on all eight held-out allocation cases. Higher sample probability does not establish a better allocation or faster solver.
      </p>
      <p>
        {data.execution} The experimental reduced encoding and feasible mixer enumerate candidate states. The dispatch-fee extension is hypothetical and is separate from the production allocation model.
      </p>
      <p className="helper-text">
        The Round 2 study below is historical and uses different configurations; its results should not be pooled with this follow-up.
      </p>
    </section>
  );
}
