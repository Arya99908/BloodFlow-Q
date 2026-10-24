import { useEffect, useState } from 'react';

const available = value => typeof value === 'number' && Number.isFinite(value);
const count = value => Number.isInteger(value) && value >= 0 ? value : 'Not recorded';
const percent = value => available(value) && value >= 0 && value <= 1 ? `${(value * 100).toFixed(2)}%` : 'Not recorded';
const runtime = value => available(value) && value >= 0 ? `${value.toLocaleString(undefined, { maximumSignificantDigits: 5 })} s` : 'Not recorded';

export default function FullReviewStudy() {
  const [study, setStudy] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStudy(null);
    setError('');
    fetch('/full-review-study.json', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error(`Saved October 24 results unavailable (${response.status}).`);
      return response.json();
    }).then(value => {
      if (value?.schema_version !== 1 || !Array.isArray(value.methods) || value.methods.some(row => !row || typeof row.method !== 'string')) {
        throw new Error('The saved review summary has an unsupported format.');
      }
      if (!controller.signal.aborted) setStudy(value);
    }).catch(issue => {
      if (!controller.signal.aborted) setError(issue.message || 'The saved review summary could not be loaded.');
    });
    return () => controller.abort();
  }, [attempt]);

  return <section className="panel research-panel" aria-labelledby="full-review-heading">
    <div className="panel-heading"><div><span className="eyebrow">OCTOBER 24, 2026 · CURRENT REPOSITORY REVIEW</span><h2 id="full-review-heading">Measured QAOA improvements and classical baselines</h2></div><a className="button button-secondary button-small" href="/full-review-report.md">Read measured report</a></div>
    <p>Saved synthetic allocation experiments on classical simulators. These results are separate from the historical studies below and do not establish quantum advantage.</p>
    {error && <div role="status"><p>{error} Historical results remain available below.</p><button type="button" className="button button-secondary button-small" onClick={() => setAttempt(value => value + 1)}>Retry current results</button></div>}
    {!study && !error && <p role="status">Loading the saved October 24 measurements…</p>}
    {study && <>
      <p><strong>Recorded study state: {study.status || 'Not recorded'}.</strong> Completed: {count(study.counts?.completed)} · Failed: {count(study.counts?.failed)} · Skipped: {count(study.counts?.skipped)} · Blocked: {count(study.counts?.blocked)}.</p>
      <p>Mean runtime uses completed runs and charges QUBO construction, warm-start preprocessing and parameter-training overhead where applicable; independent exact proofs and diagnostic analysis are excluded. Methods can cover different scenario sets and budgets: compare matched cases in the report before interpreting aggregate means.</p>
      {!study.methods.length ? <p role="status">No primary method measurements are present in this summary.</p> : <div className="table-scroll" tabIndex={0} role="region" aria-label="October 24 measured method results"><table className="data-table">
        <caption>Current primary method measurements · feasible trials and sampled feasible-shot probability are different metrics</caption>
        <thead><tr><th scope="col">Method</th><th scope="col">Scenarios</th><th scope="col">Completed / failed / skipped / blocked</th><th scope="col">Mean end-to-end runtime</th><th scope="col">Feasible / evaluated trials</th><th scope="col">Mean operationally feasible-shot probability</th></tr></thead>
        <tbody>{study.methods.map(row => <tr key={row.method}>
          <th scope="row">{row.label || row.method.replaceAll('_', ' ')}</th>
          <td>{count(row.scenario_count)}</td>
          <td>{count(row.completed)} / {count(row.failed)} / {count(row.skipped)} / {count(row.blocked)}</td>
          <td>{runtime(row.mean_runtime_seconds)}</td>
          <td>{count(row.feasible_trials)} / {count(row.evaluated_trials)}</td>
          <td>{percent(row.mean_feasible_shot_probability)}</td>
        </tr>)}</tbody>
      </table></div>}
      <p>Operational feasibility validates shipments and shortage accounting; it does not establish equality of the encoded inventory slack. The optional initial-state guard protects the selected circuit’s ideal expected penalized energy. It does not guarantee improved sampled feasibility, objective, or runtime. XY preserves Hamming weight, not the coupled allocation constraints.</p>
      {Array.isArray(study.notes) && study.notes.filter(note => typeof note === 'string').map((note, index) => <p className="helper-text" key={index}>{note}</p>)}
      <a className="button button-secondary button-small" href="/full-review-study.json" download>Download measured summary</a>
    </>}
  </section>;
}
