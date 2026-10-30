import FullReviewStudy from '../components/FullReviewStudy';
import WarmQAOAComparison from '../components/WarmQAOAComparison';
import ResearchFollowup from '../components/ResearchFollowup';
import { useMemo, useState } from 'react';
import { Download, FileChartColumn, Info, Microscope } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/Feedback';
import { Tooltip } from '../components/Tooltip';
import { useResearchStudy } from '../hooks/useResearchStudy';
import { formatPercent, formatRuntime, summarizeResearchRows } from '../utils/researchMetrics';
import GlideSelect from '../components/GlideSelect';
import ComparativeEvidenceExplorer from '../components/ComparativeEvidenceExplorer';

const METHOD_LABEL = {
  classical_multistart: 'Classical multistart',
  qaoa: 'Raw QAOA',
  hybrid_qaoa_local_search: 'Hybrid refinement',
};

function ReportBubble({ id, eyebrow, title, description, active, onClick }) {
  return <button type="button" className={`report-disclosure${active ? ' is-active' : ''}`} id={id} aria-pressed={active} aria-controls="report-data-panel" onClick={onClick}>
    <span className="report-disclosure-copy">
      <span className="eyebrow">{eyebrow}</span>
      <strong>{title}</strong>
      <span>{description}</span>
    </span>
    <span className="report-disclosure-action">{active ? 'Hide data' : 'Click to view data'}</span>
  </button>;
}

function ReportDataPanel({ title, onHide, children }) {
  return <section className="report-data-panel" aria-labelledby="active-report-title">
    <div className="report-data-heading"><h2 id="active-report-title">{title}</h2><button type="button" className="button button-secondary button-small" onClick={onHide}>Hide data</button></div>
    {children}
  </section>;
}

export default function ExperimentReports() {
  const { study, error } = useResearchStudy();
  const [activeReports, setActiveReports] = useState([]);
  const [scenarioId, setScenarioId] = useState('multi_facility_tradeoff');
  const [seed, setSeed] = useState('301');
  const scenarios = Object.keys(study?.configuration?.scenario_sizes || {});
  const selectedScenario = scenarios.includes(scenarioId) ? scenarioId : scenarios[0];
  const rows = useMemo(() => study?.results || [], [study]);
  const summary = useMemo(() => summarizeResearchRows(rows), [rows]);
  const scenarioRows = useMemo(() => rows.filter((row) => row.scenario_id === selectedScenario), [rows, selectedScenario]);
  const trialRows = scenarioRows.filter((row) => row.seed != null).sort((a, b) => Number(a.seed) - Number(b.seed) || a.method.localeCompare(b.method));
  const seeds = [...new Set(trialRows.map((row) => String(row.seed)))];
  const chosenSeed = seeds.includes(seed) ? seed : seeds[0];
  const activeRows = trialRows.filter((row) => String(row.seed) === chosenSeed);
  const maxRuntime = Math.max(...summary.map((item) => item.meanRuntimeSeconds || 0), 0);
  const config = study?.configuration || {};
  const qaoa = config.qaoa || {};
  const toggleReport = (id) => {
    const isOpen = activeReports.includes(id);
    setActiveReports((current) => isOpen ? current.filter((report) => report !== id) : [...current, id]);
    if (isOpen) return;
    window.requestAnimationFrame(() => document.getElementById('report-data-panel')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    }));
  };
  const openReport = (id) => {
    setActiveReports((current) => current.includes(id) ? current : [...current, id]);
    window.requestAnimationFrame(() => document.getElementById('report-data-panel')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    }));
  };
  const hideReport = (id) => {
    setActiveReports((current) => current.filter((report) => report !== id));
    if (activeReports.length > 1) return;
    window.requestAnimationFrame(() => document.getElementById('report-bubble-selector')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    }));
  };

  return <>
    <PageHeader eyebrow="REPRODUCIBLE RESEARCH" title="Experiment reports" description="Browse each saved simulator study on its own. Results from different protocols are kept separate." />
    <section className="report-reading-guide panel" aria-labelledby="report-guide-title">
      <span className="eyebrow">HOW TO READ THIS PAGE</span>
      <h2 id="report-guide-title">One report collection, separate studies</h2>
      <p>Study bubbles drift gently around the page. Select any number of them to pause each one and show its full data below. Click a selected bubble or its data panel’s Hide data button to close it.</p>
      <div className="report-study-index" aria-label="Report sections">
        <a href="#report-data-panel" onClick={() => openReport('overview')}>01 <span>Overview</span></a>
        <a href="#report-data-panel" onClick={() => openReport('full-review')}>02 <span>Full review</span></a>
        <a href="#report-data-panel" onClick={() => openReport('followup')}>03 <span>Methods follow-up</span></a>
        <a href="#report-data-panel" onClick={() => openReport('warm-start')}>04 <span>Paired warm-start</span></a>
        <a href="#report-data-panel" onClick={() => openReport('legacy')}>05 <span>Legacy benchmark</span></a>
      </div>
    </section>
    <div className="report-study-grid" id="report-bubble-selector">
      <ReportBubble id="report-overview" eyebrow="CROSS-STUDY SUMMARY" title="Evidence explorer and study workflow" description="Compare selected metrics while keeping each experiment dataset distinct." active={activeReports.includes('overview')} onClick={() => toggleReport('overview')} />
      <ReportBubble id="report-full-review" eyebrow="CURRENT REPOSITORY REVIEW · OCT 24" title="Measured results and classical baselines" description="Primary measured review, scenario counts, run disposition, and method summary." active={activeReports.includes('full-review')} onClick={() => toggleReport('full-review')} />
      <ReportBubble id="report-followup" eyebrow="METHODS FOLLOW-UP · OCT 24" title="QAOA variants and research methods" description="Mixer, encoding, and control comparisons from the saved follow-up study." active={activeReports.includes('followup')} onClick={() => toggleReport('followup')} />
      <ReportBubble id="report-warm-start" eyebrow="PAIRED STUDY · OCT 22" title="Warm-start QAOA comparison" description="Matched standard and LP warm-start runs across six synthetic scenarios." active={activeReports.includes('warm-start')} onClick={() => toggleReport('warm-start')} />
      {study && <ReportBubble id="report-legacy" eyebrow="HISTORICAL STUDY · OCT 15" title="Legacy confirmatory benchmark" description="The earlier three-method study, including its aggregate outcomes and paired-seed inspector." active={activeReports.includes('legacy')} onClick={() => toggleReport('legacy')} />}
    </div>
    {error && <ErrorState message={error} />}
    {!study && !error && <LoadingState label="Loading saved experiment artifact…" />}
    <div className="report-data-stage" id="report-data-panel" aria-live="polite">
    {activeReports.includes('overview') && <ReportDataPanel title="Cross-study overview" onHide={() => hideReport('overview')}><ComparativeEvidenceExplorer /></ReportDataPanel>}
    {activeReports.includes('full-review') && <ReportDataPanel title="Measured results and classical baselines" onHide={() => hideReport('full-review')}><FullReviewStudy /></ReportDataPanel>}
    {activeReports.includes('followup') && <ReportDataPanel title="QAOA variants and research methods" onHide={() => hideReport('followup')}><ResearchFollowup /></ReportDataPanel>}
    {activeReports.includes('warm-start') && <ReportDataPanel title="Warm-start QAOA comparison" onHide={() => hideReport('warm-start')}><WarmQAOAComparison /></ReportDataPanel>}
    {study && activeReports.includes('legacy') && <ReportDataPanel title="Legacy confirmatory benchmark" onHide={() => hideReport('legacy')}>
      {(() => {
        const classical = summary.find((item) => item.method === 'classical_multistart');
        const rawQaoa = summary.find((item) => item.method === 'qaoa');
        const hybrid = summary.find((item) => item.method === 'hybrid_qaoa_local_search');
        const pairedSeedCount = Math.max(...scenarios.map((id) => new Set(rows.filter((row) => row.scenario_id === id && row.seed != null).map((row) => row.seed)).size), 0);
        return <>
      <section className="research-intro panel">
        <div className="research-intro-mark"><Microscope size={21} /></div>
        <div><span className="eyebrow">LEGACY CONFIRMATORY BENCHMARK · SEPARATE STUDY</span><h2>Legacy three-method benchmark</h2><p>This historical study tested classical multistart, raw QAOA and hybrid refinement only. <a href="#qaoa-mixer-study">See warm-start, XY and all newer methods above.</a></p>
          <p>Across {scenarios.length} synthetic scenarios and {pairedSeedCount} paired seeds, classical multistart matched the Exact reference in {classical.exactMatches}/{classical.feasible} feasible trials. Raw QAOA produced infeasible candidates, and hybrid refinement did not meet the preregistered success screen. These local simulator observations do not demonstrate quantum advantage.</p>
        </div>
        <a className="button button-secondary button-small" href="/quantum-value-study.json" download><Download size={14} /> Raw data</a>
      </section>

      <div className="research-context-row">
        <span><strong>Run</strong> {config.invocation?.arguments?.at(-1) || 'Saved confirmatory study'}</span>
        <span><strong>Scope</strong> {scenarios.length} synthetic scenarios · {pairedSeedCount} paired seeds</span>
        <span><strong>QAOA</strong> p={qaoa.p ?? '—'} · {qaoa.shots ?? '—'} shots · {qaoa.optimizer || '—'}/{qaoa.max_iterations ?? '—'} iterations</span>
        <span><strong>Execution</strong> Qiskit Aer local simulator</span>
      </div>

      <section className="research-section" aria-labelledby="feasibility-heading">
        <div className="section-title-row"><div><span className="eyebrow">AGGREGATE OUTCOMES</span><h2 id="feasibility-heading">Feasibility and exact-reference matches</h2></div><Tooltip label="Feasible rate = feasible completed trials divided by completed trials. Skipped and failed attempts are reported separately; exact matches are among feasible trials only."><Info size={15} /></Tooltip></div>
        <div className="research-method-grid">
          {summary.map((item) => <article className={`research-method-card method-${item.method}`} key={item.method}>
            <div className="research-method-heading"><span className="method-swatch" /><h3>{METHOD_LABEL[item.method]}</h3></div>
            <div className="research-big-count">{item.feasible}<small> / {item.attempts} feasible / attempted</small></div>
            <div className="research-progress" role="img" aria-label={`${METHOD_LABEL[item.method]} feasibility ${item.feasible} of ${item.attempts}`}><i style={{ width: `${item.attempts ? (item.feasible / item.attempts) * 100 : 0}%` }} /></div>
            <dl className="research-card-details"><div><dt>Evaluated</dt><dd>{item.completed} / {item.attempts}</dd></div><div><dt>Infeasible</dt><dd>{item.infeasible}</dd></div><div><dt>Skipped</dt><dd>{item.skipped}</dd></div><div><dt>Exact matches</dt><dd>{item.exactMatches} / {item.feasible} feasible</dd></div></dl>
          </article>)}
        </div>
      </section>

      <div className="research-two-column">
        <section className="panel research-panel" aria-labelledby="runtime-heading">
          <div className="panel-heading"><div><h2 id="runtime-heading">Mean local end-to-end runtime</h2><p>Mean of recorded runtime_seconds across attempted trials · milliseconds · log scale</p></div><FileChartColumn size={18} className="muted-icon" /></div>
          <div className="runtime-chart" role="img" aria-label="Logarithmic mean runtime comparison in milliseconds">
            {summary.map((item) => {
              const milliseconds = item.meanRuntimeSeconds == null ? null : item.meanRuntimeSeconds * 1000;
              const width = milliseconds == null || milliseconds <= 0 || maxRuntime <= 0 ? 0 : Math.max(4, (Math.log10(milliseconds + 0.01) / Math.log10(maxRuntime * 1000 + 0.01)) * 100);
              return <div className={`runtime-row method-${item.method}`} key={item.method}><span>{METHOD_LABEL[item.method]}</span><div className="runtime-track"><i style={{ width: `${width}%` }} /></div><strong>{item.meanRuntimeSeconds == null ? 'Unavailable' : formatRuntime(item.meanRuntimeSeconds)}</strong></div>;
            })}
          </div>
          <p className="research-chart-note">Local machine timings include classical optimization and simulator execution for QAOA. They are not hardware timings or a speedup estimate.</p>
        </section>
        <section className="panel research-panel research-conclusion">
          <span className="eyebrow">INTERPRETATION</span><h2>No advantage demonstrated</h2>
          <p>The tested classical multistart search already reached the verified Exact reference for these small instances. QAOA added local simulator overhead, and raw candidates were infeasible in {rawQaoa.infeasible} of {rawQaoa.attempts} trials.</p>
          <p>Hybrid refinement matched Exact in {hybrid.exactMatches} of its {hybrid.feasible} feasible trials ({hybrid.exactMatches}/{hybrid.attempts} attempts overall); its preregistered improvement criterion was not met. Other problem classes, larger instances, hardware, and alternative encodings remain untested.</p>
          <a href="https://github.com/syedafnan7-lab/BloodFlow-Q1/blob/codex/round2-research-hardening/docs/QUANTUM_VALUE_FINDINGS.md" target="_blank" rel="noreferrer">Read the full findings and limitations <span aria-hidden="true">↗</span></a>
        </section>
      </div>

      <section className="panel research-runs-panel" aria-labelledby="run-inspector-heading">
        <div className="panel-heading"><div><span className="eyebrow">RUN INSPECTOR</span><h2 id="run-inspector-heading">Paired seed outcomes</h2><p>Individual results from the selected scenario and seed. Infeasible and skipped outcomes remain visible.</p></div></div>
        <div className="research-selectors">
          <label className="demo-field research-glide-field">Synthetic scenario<GlideSelect ariaLabel="Synthetic scenario" options={scenarios.map((id) => ({value:id,label:id.replaceAll('_',' ')}))} value={selectedScenario || ''} onChange={setScenarioId} showTags={false} accentColor="#ef233c" surfaceColor="var(--bg-surface)" highlightColor="var(--bg-hover)" textColor="var(--text-primary)" className="research-glide-select" /></label>
          <label className="demo-field research-glide-field">Paired seed<GlideSelect ariaLabel="Paired seed" options={seeds.map((value) => ({value,label:value}))} value={chosenSeed || ''} onChange={setSeed} showTags={false} accentColor="#ef233c" surfaceColor="var(--bg-surface)" highlightColor="var(--bg-hover)" textColor="var(--text-primary)" className="research-glide-select" /></label>
        </div>
        <div className="table-scroll" role="region" aria-label="Selected seed solver outcomes" tabIndex={0}><table className="data-table research-run-table">
          <thead><tr><th>Method</th><th>Status</th><th className="num-cell">Objective</th><th>Feasibility</th><th className="num-cell">Unmet</th><th className="num-cell">Runtime</th><th>Exact gap</th></tr></thead>
          <tbody>{activeRows.map((row) => <tr key={`${row.method}-${row.seed}`}><th scope="row">{METHOD_LABEL[row.method] || row.method.replaceAll('_', ' ')}</th><td><span className={`research-status research-status-${row.status}`}>{row.status.replaceAll('_', ' ')}</span></td><td className="num-cell">{Number.isFinite(row.objective) ? row.objective.toFixed(2) : '—'}</td><td>{row.feasibility === true ? 'Feasible' : row.feasibility === false ? 'Infeasible' : 'Not reported'}</td><td className="num-cell">{Number.isFinite(row.total_unmet_demand) ? row.total_unmet_demand : '—'}</td><td className="num-cell">{formatRuntime(row.runtime_seconds)}</td><td>{Number.isFinite(row.approximation_gap) ? row.approximation_gap.toFixed(3) : 'Unavailable'}</td></tr>)}</tbody>
        </table></div>
        <p className="research-chart-note">Run feasibility is not the same as demand satisfaction. Exact-reference match is based on approximation_gap = 0 where the experiment reported a defined reference comparison.</p>
      </section>
      <footer className="skiper-attribution">Tooltip interaction adapted from <a href="https://skiper-ui.com/v1/skiper101" target="_blank" rel="noreferrer">Skiper UI · Custom Tooltip (skiper101)</a>. Free component, attributed as required; implemented with React and Radix Tooltip.</footer>
        </>;
      })()}
    </ReportDataPanel>}
    </div>
  </>;
}
