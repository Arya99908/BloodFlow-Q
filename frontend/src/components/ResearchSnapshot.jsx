import { ArrowUpRight, Microscope } from 'lucide-react';
import { useResearchStudy } from '../hooks/useResearchStudy';
import { summarizeResearchRows } from '../utils/researchMetrics';

export default function ResearchSnapshot({ onNavigate }) {
  const { study, error } = useResearchStudy();
  if (error) return <section className="research-snapshot research-snapshot-error" role="status"><Microscope size={18} /><span>Saved research summary unavailable. Open Experiment reports to inspect or retry the study artifact.</span><button className="text-button" onClick={() => onNavigate('reports')}>Open reports <ArrowUpRight size={14} /></button></section>;
  if (!study) return null;
  const summary = summarizeResearchRows(study.results);
  const classical = summary.find((item) => item.method === 'classical_multistart');
  const qaoa = summary.find((item) => item.method === 'qaoa');
  const hybrid = summary.find((item) => item.method === 'hybrid_qaoa_local_search');
  return <section className="research-snapshot" aria-label="Saved research finding">
    <div className="research-snapshot-icon"><Microscope size={18} /></div>
    <div className="research-snapshot-copy"><span className="eyebrow">SAVED EXPERIMENT · QISKIT AER SIMULATOR</span><strong>No quantum advantage demonstrated in this study</strong><p>Classical Exact matches: {classical.exactMatches}/{classical.attempts}. Raw QAOA infeasible: {qaoa.infeasible}/{qaoa.attempts}. Hybrid Exact matches: {hybrid.exactMatches}/{hybrid.feasible} feasible ({hybrid.exactMatches}/{hybrid.attempts} attempts).</p></div>
    <button className="button button-secondary button-small" onClick={() => onNavigate('reports')}>Review evidence <ArrowUpRight size={14} /></button>
  </section>;
}
