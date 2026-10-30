import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import PageHeader from './PageHeader';
import { ErrorState, LoadingState } from './Feedback';
import './FlagshipDemo.css';
import AllocationSankey from './AllocationSankey';

const defaults = { bank_a_stock: 1, bank_b_stock: 1, critical_demand: 2, community_demand: 1, critical_route_cost: 40, policy: 'service_first', seed: 7 };
const names = { bank_a: 'Bank A', bank_b: 'Bank B', critical: 'Critical Hospital', community: 'Community Hospital' };
const methods = { milp: 'MILP reference', exact: 'Exhaustive reference', greedy: 'Greedy', standard: 'Standard QAOA', warm: 'Warm QAOA', seed_only: 'Warm seed only', xy: 'XY QAOA', warm_xy: 'Warm XY' };
const f = n => Number.isFinite(n) ? n.toFixed(3) : 'Not recorded';

export default function FlagshipDemo() {
  const [config, setConfig] = useState(defaults);
  const [story, setStory] = useState(null);
  const [policies, setPolicies] = useState(null);
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [disrupted, setDisrupted] = useState(true);
  const active = useRef(null);
  useEffect(() => () => active.current?.abort(), []);
  const reset = () => { active.current?.abort(); active.current = null; setBusy(''); setStory(null); setPolicies(null); setRuns([]); setError(''); };
  const update = (key, value) => { reset(); setConfig(current => ({ ...current, [key]: value })); };
  const execute = async comparison => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setError(''); setBusy(comparison ? 'Comparing methods' : 'Running the disruption story');
    if (comparison) setRuns([]); else setStory(null);
    try {
      if (!comparison) {
        const before = await api.runFlagship({ ...config, method: 'milp', disrupted: false }, { signal: controller.signal });
        const after = await api.runFlagship({ ...config, method: 'milp', disrupted: true }, { signal: controller.signal });
        if (active.current === controller) setStory({ before, after });
      } else {
        for (const method of Object.keys(methods)) {
          if (controller.signal.aborted) break;
          setBusy(`Comparing: ${methods[method]}`);
          let record;
          try { record = await api.runFlagship({ ...config, method, disrupted }, { signal: controller.signal }); }
          catch (problem) { record = { method, error: problem.message, configuration: { input: { ...config, disrupted } } }; }
          if (active.current === controller && !controller.signal.aborted) setRuns(current => [...current, record]);
        }
      }
    } catch (problem) { if (active.current === controller) setError(problem.message); }
    finally { if (active.current === controller) { active.current = null; setBusy(''); } }
  };
  const comparePolicies = async () => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setError(''); setPolicies(null); setBusy('Comparing policies on identical inputs');
    try {
      const weighted = await api.runFlagship({ ...config, method: 'milp', policy: 'weighted', disrupted }, { signal: controller.signal });
      const serviceFirst = await api.runFlagship({ ...config, method: 'milp', policy: 'service_first', disrupted }, { signal: controller.signal });
      if (active.current === controller) setPolicies({ weighted, serviceFirst });
    } catch (problem) { if (active.current === controller) setError(problem.message); }
    finally { if (active.current === controller) { active.current = null; setBusy(''); } }
  };
  const exportPlan = () => {
    const payload = { record_type: 'synthetic_review_plan', exported_at: new Date().toISOString(), config, story, policies, comparisons: runs,
      review_checklist: ['Confirm synthetic inputs and objective policy.', 'Inspect every unmet unit and unavailable route.', 'Compare only matching comparison_id values.', 'Check feasibility before objective gaps.', 'No real dispatch or clinical approval is implied.'] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'bloodflow-synthetic-plan.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const reference = runs.find(r => r.method === 'milp' && r.result?.feasibility);
  return <section className="flagship-demo">
    <PageHeader eyebrow="LIVE SYNTHETIC DEMONSTRATION" title="Two hospitals. Shared stock. One blocked route." description="Choose the allocation policy, inspect the disruption, then test whether quantum processing contributes beyond a classical reference." />
    <div className="notice notice-warning">Research only. Critical is a synthetic priority label. Feasible means modeled constraints hold—not that every request is served or a dispatch is approved.</div>
    <section className="panel flagship-config">
      <h2>1. Set the scenario and policy</h2>
      <fieldset disabled={Boolean(busy)}>
        <legend>Synthetic units and model costs</legend>
        <div className="flagship-fields">{[['bank_a_stock','Bank A stock'],['bank_b_stock','Bank B stock'],['critical_demand','Critical Hospital demand'],['community_demand','Community Hospital demand']].map(([key,label]) => <label key={key}>{label}<input type="number" min="0" max="2" step="1" value={config[key]} onChange={e => update(key, Number(e.target.value))} /><small>Whole units, 0–2</small></label>)}
          <label>Critical route cost<input type="number" min="0" max="100" value={config.critical_route_cost} onChange={e => update('critical_route_cost', Number(e.target.value))} /><small>Synthetic cost points per unit</small></label>
          <label>Seed<input type="number" min="0" max="4294967295" step="1" value={config.seed} onChange={e => update('seed', Number(e.target.value))} /></label>
        </div>
        <label className="flagship-policy">Allocation policy<select value={config.policy} onChange={e => update('policy', e.target.value)}><option value="service_first">Service-first: critical shortage → total shortage → transport</option><option value="weighted">Weighted tradeoff: shortages can be cheaper than shipping</option></select></label>
      </fieldset>
      <p>All four routes are available initially. The disruption blocks Bank B → Critical Hospital. Travel times are modeled costs, not arrival deadlines. Both hospitals use O-group stock.</p>
      <div className="flagship-actions"><button className="button button-primary" disabled={Boolean(busy)} onClick={() => execute(false)}>Run disruption story</button><button className="button button-secondary" disabled={!story && !policies && !runs.length} onClick={exportPlan}>Export reviewable plan</button>{busy && <button className="button button-secondary" onClick={() => { active.current?.abort(); active.current = null; setBusy(''); }}>Cancel display request</button>}</div>
    </section>
    {busy && <LoadingState label={busy} />}{error && <ErrorState message={error} />}
    {story && <section aria-live="polite"><h2>2. Explain the revised plan</h2><div className="flagship-plans"><Plan title="Before: all routes open" run={story.before} /><Plan title="After: Bank B → Critical blocked" run={story.after} /></div><p className="helper-text">Service-first weights are derived separately for each scenario. Compare served/unmet units across the disruption, not raw objective totals.</p></section>}
    <section className="panel flagship-policy-observatory"><h2>Clinical policy comparison</h2><p>The same inventory, demand and route availability go into both MILP runs. Only the objective policy changes. Compare fulfillment and transport; objective totals use different weights and are not comparable.</p><label><input type="checkbox" checked={disrupted} disabled={Boolean(busy)} onChange={e => { setDisrupted(e.target.checked); setPolicies(null); setRuns([]); }} /> Block Bank B → Critical Hospital in both policies</label><div className="flagship-actions"><button className="button button-primary" disabled={Boolean(busy)} onClick={comparePolicies}>Compare weighted and service-first policies</button></div>{policies && <div className="flagship-plans" aria-live="polite"><Plan title="Weighted-cost minimization" run={policies.weighted} /><Plan title="Service-first clinical triage" run={policies.serviceFirst} /></div>}</section>
    <section className="panel"><h2>3. Challenge the quantum contribution</h2><p>Identical scenario, policy and seed within this comparison. Warm seed only samples the same LP-derived preparation at zero angles without variational optimization. LP preparation and local simulation costs remain included in each service run.</p>
      <label><input type="checkbox" checked={disrupted} disabled={Boolean(busy)} onChange={e => { setDisrupted(e.target.checked); setPolicies(null); setRuns([]); }} /> Compare after the route disruption</label>
      <div className="flagship-actions"><button className="button button-primary" disabled={Boolean(busy)} onClick={() => execute(true)}>Run classical, quantum and seed controls</button></div>
      <p className="helper-text">QAOA: p=1, 128 shots, 15 optimizer iterations, one restart. Ideal statevector training and local Aer sampling; no hardware. A single seed cannot establish advantage. Errors and infeasible candidates remain visible.</p>
      {runs.length > 0 && <div className="table-scroll" role="region" aria-label="Matched method comparison" tabIndex={0}><table><thead><tr><th>Method</th><th>Feasible</th><th>Critical unmet</th><th>Total unmet</th><th>Objective</th><th>Gap to MILP</th><th>Feasible shots</th><th>Service time</th></tr></thead><tbody>{runs.map(run => {
        const r = run.result; const info = r?.optimizer_information; const comparable = r?.feasibility && reference?.comparison_id === run.comparison_id;
        return <tr key={run.method}><th scope="row">{methods[run.method]}</th>{run.error ? <td colSpan="7">Failed: {run.error}</td> : <><td>{r.feasibility ? 'Yes' : 'No'}</td><td>{r.objective_breakdown.critical_unmet_units}</td><td>{r.total_unmet_demand}</td><td>{f(r.total_objective)}</td><td>{comparable ? f(r.total_objective-reference.result.total_objective) : 'Not comparable'}</td><td>{Number.isFinite(info?.feasible_shot_rate) ? `${(info.feasible_shot_rate*100).toFixed(1)}%` : 'Not measured'}</td><td>{f(run.wall_seconds)} s</td></>}</tr>;
      })}</tbody></table></div>}
      {runs.length > 0 && <details><summary>Inspect raw configurations, failures and solver provenance</summary><pre className="flagship-raw">{JSON.stringify(runs,null,2)}</pre></details>}
    </section>
  </section>;
}

function Plan({title, run}) {
  const r=run.result;
  return <article className="panel"><h3>{title}</h3><p>{run.policy_description}</p><dl className="flagship-stats"><div><dt>Critical unmet</dt><dd>{r.objective_breakdown.critical_unmet_units}</dd></div><div><dt>Total unmet</dt><dd>{r.total_unmet_demand}</dd></div><div><dt>Feasible</dt><dd>{r.feasibility ? 'Yes' : 'No'}</dd></div></dl>
    <dl className="flagship-stats"><div><dt>Transport cost</dt><dd>{f(r.transport_cost)}</dd><small>Synthetic cost points</small></div><div><dt>Service runtime</dt><dd>{f(run.wall_seconds)} s</dd></div></dl>
    <AllocationSankey scenario={run.configuration.scenario} result={r} />
    <h4>Proposed synthetic shipments</h4>{r.allocation.length ? <ul>{r.allocation.map((a,i)=><li key={i}>{names[a.source]} → {names[a.destination]}: <strong>{a.quantity} O units</strong></li>)}</ul> : <p>No shipment selected under this policy.</p>}
    <h4>Why demand remains unmet</h4>{run.shortage_explanations.length ? <ul>{run.shortage_explanations.map(x=><li key={x.hospital_id}><strong>{names[x.hospital_id]}: {x.units} units.</strong> {x.explanation}</li>)}</ul> : <p>No modeled shortage.</p>}
    <details><summary>Policy weights and units</summary><pre className="flagship-raw">{JSON.stringify(run.configuration.objective_weights,null,2)}</pre><p>Transport cost uses synthetic model points; time is minutes per shipped unit. Feasibility does not certify clinical suitability.</p></details>
  </article>;
}
