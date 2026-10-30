import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, PieChart, Workflow } from 'lucide-react';
import './ComparativeEvidenceExplorer.css';

const METHOD_LABELS = {
  exact: 'Exact', greedy: 'Greedy', lp: 'LP', milp: 'MILP',
  standard: 'Standard QAOA', warm: 'Warm-start QAOA', warm_zero: 'Warm-start · zero angles',
  warm_zero_keep: 'Warm-start · zero + keep', warm_keep: 'Warm-start · keep', xy: 'XY mixer',
  warm_xy: 'Warm-start + XY', greedy_warm: 'Greedy-seeded QAOA',
  classical_multistart: 'Classical multistart', qaoa: 'Raw QAOA',
  hybrid_qaoa_local_search: 'Hybrid refinement',
  lp_warm_start: 'LP warm-start QAOA',
};

const DATASETS = [
  { id: 'full_review', label: 'Full review · Oct 24', detail: '15 primary synthetic cases; saved method summary and ablations.' },
  { id: 'warm_paired', label: 'Paired warm-start · Oct 22', detail: '6 synthetic cases; 10 paired seeds per case.' },
  { id: 'legacy', label: 'Legacy confirmatory · Oct 15', detail: '6 synthetic cases; historical three-method study.' },
];

const FLOW_STAGES = [
  { title: 'Scenario', subtitle: 'Synthetic inputs', detail: 'Load fictional bank inventory, hospital demand, logistics urgency, simplified compatibility, and route costs/status.' },
  { title: 'Classical model', subtitle: 'Variables + rules', detail: 'Describe integer shipment quantities, unmet demand, inventory slack, objective weights, and hard-filtered routes.' },
  { title: 'QUBO → Ising', subtitle: 'Binary cost model', detail: 'Encode decisions and penalties as a QUBO, then map binary bits to Ising spins and Z/ZZ cost terms.' },
  { title: 'QAOA simulator', subtitle: 'Hybrid search', detail: 'A classical optimizer tunes circuit angles. Qiskit Aer samples the final circuit locally; this is not quantum hardware.' },
  { title: 'Decode + validate', subtitle: 'Classical checks', detail: 'Map the measured bitstring back to allocations and check feasibility independently. Infeasible samples stay visible.' },
  { title: 'Compare', subtitle: 'Evidence', detail: 'Compare recorded metrics with Greedy, Exact, LP, and MILP where the experiment provides valid comparable data.' },
];

const formatNumber = (value, digits = 2) => Number.isFinite(value)
  ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : 'Not recorded';
const formatPercent = (value) => Number.isFinite(value) ? `${(100 * value).toFixed(1)}%` : 'Not recorded';
const formatRuntime = (seconds) => {
  if (!Number.isFinite(seconds)) return 'Not recorded';
  if (seconds < 1) return `${(seconds * 1000).toFixed(seconds < 0.01 ? 3 : 1)} ms`;
  return `${seconds.toFixed(2)} s`;
};
const methodColor = (key) => {
  if (['exact', 'greedy', 'lp', 'milp', 'classical_multistart'].includes(key)) return '#148178';
  if (key.includes('hybrid')) return '#c78931';
  if (key === 'greedy_warm') return '#7181bc';
  return '#7359c8';
};

function summarizeLegacy(rows) {
  return rows.map((row) => ({
    key: row.method,
    label: METHOD_LABELS[row.method] || row.method.replaceAll('_', ' '),
    attempts: row.attempts,
    evaluated: row.evaluated,
    value: row.mean_runtime_seconds,
    runtime: row.mean_runtime_seconds,
    feasibility: row.evaluated ? row.feasible / row.evaluated : null,
    exact: row.feasible ? row.exact_reference_matches / row.feasible : null,
    feasible: row.feasible,
    exactMatches: row.exact_reference_matches,
    color: methodColor(row.method),
  }));
}

function metricOptions(dataset) {
  if (dataset === 'full_review') return [
    { id: 'runtime', label: 'Mean end-to-end runtime' },
    { id: 'feasibility', label: 'Feasible returned trials' },
    { id: 'shot', label: 'Mean feasible-shot probability' },
  ];
  if (dataset === 'warm_paired') return [
    { id: 'shot', label: 'Mean feasible-shot probability' },
    { id: 'runtime', label: 'Median end-to-end runtime' },
    { id: 'exact', label: 'Runs finding exact objective' },
  ];
  return [
    { id: 'runtime', label: 'Mean end-to-end runtime' },
    { id: 'feasibility', label: 'Feasible evaluated trials' },
    { id: 'exact', label: 'Exact-reference matches among feasible' },
  ];
}

function metricRows(dataset, metric) {
  if (dataset.id === 'full_review') {
    const core = new Set(['exact', 'greedy', 'lp', 'milp', 'standard', 'warm', 'warm_zero', 'warm_zero_keep', 'warm_keep', 'xy', 'warm_xy', 'greedy_warm']);
    return (dataset.methods || []).filter((row) => core.has(row.method)).map((row) => ({
      key: row.method,
      label: METHOD_LABELS[row.method] || row.label,
      attempts: row.evaluated_trials,
      value: metric === 'runtime' ? row.mean_runtime_seconds
        : metric === 'feasibility' ? (row.evaluated_trials ? row.feasible_trials / row.evaluated_trials : null)
          : row.mean_feasible_shot_probability,
      color: methodColor(row.method),
    })).filter((row) => Number.isFinite(row.value));
  }
  if (dataset.id === 'warm_paired') return (dataset.variants || []).map((row) => ({
    key: row.variant,
    label: METHOD_LABELS[row.variant] || row.variant,
    attempts: row.completed,
    value: metric === 'shot' ? row.mean_feasible_shot_rate
      : metric === 'runtime' ? row.median_runtime_seconds
        : (row.completed ? row.exact_optimum_runs / row.completed : null),
    color: methodColor(row.variant),
  })).filter((row) => Number.isFinite(row.value));
  const rows = summarizeLegacy(dataset.methods || []);
  return rows.map((row) => ({ ...row, value: metric === 'runtime' ? row.runtime : metric === 'feasibility' ? row.feasibility : row.exact }));
}

function valueLabel(value, metric) {
  if (!Number.isFinite(value)) return 'Not recorded';
  if (metric === 'runtime') return formatRuntime(value);
  if (metric === 'exact' && value > 1) return `${formatNumber(value, 0)} runs`;
  return formatPercent(value);
}

function HorizontalBars({ rows, metric, active, onSelect }) {
  const usable = rows.filter((row) => Number.isFinite(row.value));
  const isRuntime = metric === 'runtime';
  const transformed = usable.map((row) => isRuntime ? Math.log10(Math.max(row.value, 1e-9)) : row.value);
  const min = isRuntime ? Math.min(...transformed) : 0;
  const max = isRuntime ? Math.max(...transformed, min + 1) : 1;
  const height = Math.max(185, usable.length * 35 + 42);
  const chartWidth = 760;
  const left = 205;
  const right = 110;
  const trackWidth = chartWidth - left - right;
  return <svg className="evidence-bars-svg" viewBox={`0 0 ${chartWidth} ${height}`} role="img" aria-label="Interactive measured method comparison bar chart">
    <text x={left} y="16" className="evidence-axis-label">{isRuntime ? 'Relative bar width uses a logarithmic runtime scale' : '0%'}</text>
    {!isRuntime && <text x={left + trackWidth} y="16" textAnchor="end" className="evidence-axis-label">100%</text>}
    {usable.map((row, index) => {
      const y = 34 + index * 35;
      const v = isRuntime ? Math.log10(Math.max(row.value, 1e-9)) : row.value;
      const fraction = max === min ? 1 : Math.max(0.015, Math.min(1, (v - min) / (max - min)));
      const selected = active === row.key;
      return <g key={row.key} className={`evidence-bar-row${selected ? ' is-active' : ''}`} onClick={() => onSelect(row.key)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(row.key); } }} tabIndex="0" role="button" aria-label={`${row.label}: ${valueLabel(row.value, metric)}, ${row.attempts} evaluated runs`}>
        <title>{`${row.label}: ${valueLabel(row.value, metric)} · n=${row.attempts ?? 'not recorded'}`}</title>
        <text x={left - 10} y={y + 14} textAnchor="end" className="evidence-bar-name">{row.label}</text>
        <rect x={left} y={y} width={trackWidth} height="20" rx="7" className="evidence-bar-track" />
        <rect x={left} y={y} width={Math.max(3, trackWidth * fraction)} height="20" rx="7" fill={row.color} className="evidence-bar-fill" />
        <text x={left + trackWidth + 10} y={y + 14} className="evidence-bar-value">{valueLabel(row.value, metric)}</text>
      </g>;
    })}
    {!usable.length && <text x={chartWidth / 2} y={height / 2} textAnchor="middle" className="evidence-empty-chart">No recorded measurements for this metric.</text>}
  </svg>;
}

function Donut({ slices, active, onSelect, title }) {
  const total = slices.reduce((sum, slice) => sum + (Number.isFinite(slice.value) ? slice.value : 0), 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div className="evidence-donut-wrap">
    <svg viewBox="0 0 160 160" className="evidence-donut" role="img" aria-label={`${title}; total ${formatNumber(total, 0)}`}>
      <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--border-default)" strokeWidth="18" />
      {total > 0 && slices.filter((slice) => slice.value > 0).map((slice) => {
        const length = (slice.value / total) * circumference;
        const node = <circle key={slice.key} cx="80" cy="80" r={radius} fill="none" stroke={slice.color} strokeWidth={active === slice.key ? 22 : 18} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)" className="evidence-donut-slice"><title>{`${slice.label}: ${formatNumber(slice.value, 0)} (${formatPercent(slice.value / total)})`}</title></circle>;
        offset += length;
        return node;
      })}
      <text x="80" y="76" textAnchor="middle" className="evidence-donut-total">{formatNumber(total, 0)}</text>
      <text x="80" y="95" textAnchor="middle" className="evidence-donut-caption">{title}</text>
    </svg>
    <div className="evidence-donut-legend">{slices.map((slice) => <button key={slice.key} type="button" className={active === slice.key ? 'is-active' : ''} onClick={() => onSelect(slice.key)}><i style={{ background: slice.color }} /><span>{slice.label}</span><strong>{formatNumber(slice.value, 0)}</strong></button>)}</div>
  </div>;
}

function pairedScenarioRows(rows) {
  return (rows || []).map((row) => ({
    label: row.scenario_id === 'demo_emergency_demand_spike_emergency' ? 'Emergency spike' : row.scenario_id.replaceAll('_', ' '),
    standard: row.standard_mean_feasible_shot_rate,
    warm: row.warm_start_mean_feasible_shot_rate,
    delta: row.mean_paired_difference_warm_minus_standard,
    ci: row.paired_difference_bootstrap_95_percentile_ci,
    n: row.paired_completed_seeds,
  }));
}

function PairedScenarioChart({ rows }) {
  const width = 780;
  const labelWidth = 150;
  const barWidth = 440;
  const chartHeight = rows.length * 51 + 35;
  return <svg viewBox={`0 0 ${width} ${chartHeight}`} className="evidence-paired-svg" role="img" aria-label="Paired standard versus LP warm-start feasible-shot rates for each synthetic scenario">
    {rows.map((row, index) => {
      const y = 15 + index * 51;
      return <g key={row.label}>
        <text x={labelWidth - 10} y={y + 15} textAnchor="end" className="evidence-bar-name">{row.label}</text>
        <rect x={labelWidth} y={y} width={barWidth} height="12" rx="5" className="evidence-bar-track" />
        <rect x={labelWidth} y={y} width={Math.max(2, barWidth * row.standard)} height="12" rx="5" fill="#7359c8"><title>{`Standard: ${formatPercent(row.standard)}`}</title></rect>
        <rect x={labelWidth} y={y + 17} width={barWidth} height="12" rx="5" className="evidence-bar-track" />
        <rect x={labelWidth} y={y + 17} width={Math.max(2, barWidth * row.warm)} height="12" rx="5" fill="#148178"><title>{`LP warm-start: ${formatPercent(row.warm)}`}</title></rect>
        <text x={labelWidth + barWidth + 10} y={y + 10} className="evidence-bar-value">{formatPercent(row.standard)}</text>
        <text x={labelWidth + barWidth + 10} y={y + 27} className="evidence-bar-value">{formatPercent(row.warm)}</text>
        <text x={labelWidth} y={y + 43} className="evidence-ci-label">paired change {row.delta >= 0 ? '+' : ''}{(row.delta * 100).toFixed(1)} pp · 95% bootstrap [{(row.ci[0] * 100).toFixed(1)}, {(row.ci[1] * 100).toFixed(1)}] pp · {row.n} seeds</text>
      </g>;
    })}
  </svg>;
}

export default function ComparativeEvidenceExplorer() {
  const [artifact, setArtifact] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [datasetId, setDatasetId] = useState('full_review');
  const [metric, setMetric] = useState('runtime');
  const [activeMethod, setActiveMethod] = useState('');
  const [activeSlice, setActiveSlice] = useState('');
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    let alive = true;
    setArtifact(null);
    setError('');
    fetch('/comparative-evidence.json')
      .then((response) => { if (!response.ok) throw new Error(`Experiment evidence request failed (${response.status}).`); return response.json(); })
      .then((value) => {
        if (value?.schema_version !== 1 || !value?.datasets?.full_review || !value?.datasets?.warm_paired || !value?.datasets?.legacy) throw new Error('Saved experiment evidence has an unsupported format.');
        if (alive) setArtifact(value);
      })
      .catch((issue) => { if (alive) setError(issue.message || 'Saved experiment evidence could not be loaded.'); });
    return () => { alive = false; };
  }, [attempt]);

  const dataset = artifact?.datasets?.[datasetId];
  const options = metricOptions(datasetId);
  useEffect(() => { if (!options.some((item) => item.id === metric)) setMetric(options[0].id); }, [datasetId]);
  const rows = useMemo(() => dataset ? metricRows({ ...dataset, id: datasetId }, metric) : [], [dataset, datasetId, metric]);
  const active = rows.find((row) => row.key === activeMethod) || rows[0];

  const slices = useMemo(() => {
    if (!dataset) return [];
    if (datasetId === 'full_review') {
      const c = dataset.counts || {};
      return [
        { key: 'completed', label: 'Completed', value: c.completed || 0, color: '#148178' },
        { key: 'skipped', label: 'Skipped', value: c.skipped || 0, color: '#d39236' },
        { key: 'failed', label: 'Failed', value: c.failed || 0, color: '#bd5449' },
        { key: 'blocked', label: 'Blocked', value: c.blocked || 0, color: '#697786' },
      ];
    }
    if (datasetId === 'warm_paired') {
      const total = (dataset.variants || []).reduce((sum, row) => sum + (row.total_shots || 0), 0);
      const feasible = (dataset.variants || []).reduce((sum, row) => sum + (row.feasible_shots || 0), 0);
      return [
        { key: 'feasible', label: 'Feasible measured shots', value: feasible, color: '#148178' },
        { key: 'other', label: 'Other measured shots', value: Math.max(0, total - feasible), color: '#7359c8' },
      ];
    }
    const c = dataset.status_counts || {};
    return [
      { key: 'completed', label: 'Completed feasible', value: c.completed || 0, color: '#148178' },
      { key: 'infeasible', label: 'Infeasible sample', value: c.infeasible || 0, color: '#bd5449' },
      { key: 'skipped', label: 'Skipped', value: Object.entries(c).filter(([key]) => key.startsWith('skipped')).reduce((sum, [, value]) => sum + value, 0), color: '#d39236' },
    ];
  }, [dataset, datasetId]);

  const scopes = {
    full_review: 'October 24 full review · means use completed recorded runs. Core methods below share 15 scenarios and 75 runs; ablations with fewer cases are excluded from this focused comparison.',
    warm_paired: 'October 22 paired study · 6 synthetic scenarios × 10 matched seeds, p=1, 64 shots, COBYLA, 8 iterations. LP preprocessing is part of warm-start.',
    legacy: 'October 15 confirmatory study · historical results. Infeasible candidate runs count as evaluated; skipped seeds remain separate. Do not pool this study with the October 24 or paired warm-start reports.',
  };

  return <section className="evidence-explorer panel" aria-labelledby="evidence-explorer-title">
    <header className="evidence-explorer-heading">
      <div><span className="eyebrow">SAVED EXPERIMENT DATA · INTERACTIVE VIEW</span><h2 id="evidence-explorer-title">Comparative evidence explorer</h2><p>Explore recorded results across separate experiment protocols. Hover or focus chart marks for exact values; choose a dataset and metric below.</p></div>
      <span className="evidence-verdict"><AlertTriangle size={15} /> No quantum supremacy demonstrated</span>
    </header>

    {error && <div className="evidence-error" role="status"><p>{error}</p><button type="button" className="button button-secondary button-small" onClick={() => setAttempt((value) => value + 1)}>Retry saved evidence</button></div>}
    {!artifact && !error && <p className="evidence-loading" role="status">Loading saved experiment measurements…</p>}
    {artifact && <>
      <div className="evidence-controls">
        <label>Experiment report<select className="field-control" value={datasetId} onChange={(event) => { setDatasetId(event.target.value); setActiveMethod(''); }}>
          {DATASETS.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
        </select></label>
        <label>Measure<select className="field-control" value={metric} onChange={(event) => setMetric(event.target.value)}>
          {options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
        </select></label>
        <a className="button button-secondary button-small" href="/comparative-evidence.json" download>Download chart data</a>
      </div>
      <p className="evidence-scope">{scopes[datasetId]}</p>
      <div className="evidence-grid">
        <article className="evidence-card evidence-chart-card">
          <div className="evidence-card-heading"><div><span className="eyebrow">MEASURED / RECORDED</span><h3>{options.find((item) => item.id === metric)?.label}</h3></div><BarChart3 size={18} /></div>
          <div className="evidence-chart-scroll"><HorizontalBars rows={rows} metric={metric} active={active?.key || activeMethod} onSelect={setActiveMethod} /></div>
          {active && <p className="evidence-active-readout"><strong>{active.label}</strong><span>{valueLabel(active.value, metric)}</span><small>n = {active.attempts ?? 'not recorded'} runs</small></p>}
          <p className="evidence-footnote">{metric === 'runtime' ? 'Runtime is local classical/simulator time, not quantum-hardware time. Full-review runtime is plotted on a log scale so both classical and simulator values remain visible.' : 'A feasible sampled candidate is not the same as an exact optimum. Denominators and method case counts are shown in the source report.'}</p>
        </article>
        <article className="evidence-card evidence-donut-card">
          <div className="evidence-card-heading"><div><span className="eyebrow">OUTCOME MIX</span><h3>{datasetId === 'warm_paired' ? 'Measured-shot feasibility' : 'Run disposition'}</h3></div><PieChart size={18} /></div>
          <Donut slices={slices} active={activeSlice} onSelect={setActiveSlice} title={datasetId === 'warm_paired' ? 'shots' : 'runs'} />
          <p className="evidence-footnote">This chart uses the selected report’s recorded denominator; it does not estimate missing or skipped outcomes.</p>
        </article>
      </div>

      {datasetId === 'warm_paired' && <article className="evidence-card evidence-paired-card">
        <div className="evidence-card-heading"><div><span className="eyebrow">MATCHED SCENARIO VIEW</span><h3>Standard QAOA vs LP warm-start</h3></div><span className="evidence-paired-legend"><i className="standard-dot" /> Standard <i className="warm-dot" /> LP warm-start</span></div>
        <div className="evidence-chart-scroll"><PairedScenarioChart rows={pairedScenarioRows(dataset.scenarios)} /></div>
        <p className="evidence-footnote">Bars show mean feasible-shot rate across paired seeds. The small bootstrap interval crossing zero means the point estimate is uncertain for that case. Warm-start includes a classical LP relaxation and did not beat the exact reference.</p>
      </article>}

      <article className="evidence-card evidence-flow-card">
        <div className="evidence-card-heading"><div><span className="eyebrow">HOW A QUANTUM CANDIDATE IS CHECKED</span><h3>From scenario to evidence</h3></div><Workflow size={18} /></div>
        <div className="evidence-flow" role="group" aria-label="Interactive optimization and QAOA workflow">
          {FLOW_STAGES.map((stage, index) => <div className="evidence-flow-unit" key={stage.title}>
            <button type="button" className={`evidence-flow-node${activeStage === index ? ' is-active' : ''}`} onClick={() => setActiveStage(index)} aria-pressed={activeStage === index}><span>{String(index + 1).padStart(2, '0')}</span><strong>{stage.title}</strong><small>{stage.subtitle}</small></button>
            {index < FLOW_STAGES.length - 1 && <ArrowRight className="evidence-flow-arrow" size={17} aria-hidden="true" />}
          </div>)}
        </div>
        <p className="evidence-stage-detail" aria-live="polite"><strong>{FLOW_STAGES[activeStage].title}:</strong> {FLOW_STAGES[activeStage].detail}</p>
      </article>
      <p className="evidence-supremacy-note"><strong>What these charts support:</strong> the experiments report real simulated samples and show trade-offs. They do not show that the quantum method is superior to classical optimization. On the small recorded allocation cases, classical LP/MILP/exact methods were much faster; LP-seeded QAOA improved feasible-shot sampling in its paired study, but the LP preprocessing is itself classical.</p>
    </>}
  </section>;
}
