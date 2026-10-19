import { Activity, ArrowRight, BadgeCheck, Boxes, Building2, GitBranch, Hospital, Route, Settings2, Siren } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import BorderGlow from '../components/BorderGlow';

const stages = [
  { number: '01', label: 'Scenario inputs', icon: Boxes, title: 'Start with the active scenario', body: 'The API supplies a clearly labeled synthetic scenario: blood-bank stock, hospital demand, blood groups, route costs, and network constraints.', links: [['Blood banks', 'blood-banks'], ['Hospitals', 'hospitals']] },
  { number: '02', label: 'Model the network', icon: GitBranch, title: 'Connect supply to demand', body: 'The network view exposes the locations and eligible transport paths. Route disruptions can be applied in the emergency workspace to model changed conditions.', links: [['Transport network', 'network'], ['Emergency simulation', 'emergency']] },
  { number: '03', label: 'Choose a solver', icon: Settings2, title: 'Build and run an allocation', body: 'Select a supported classical solver or a compact local QAOA simulation. The optimizer returns its candidate, objective, and diagnostic values from the backend.', links: [['Optimization', 'optimization'], ['Demo mode', 'demo']] },
  { number: '04', label: 'Validate the candidate', icon: BadgeCheck, title: 'Check feasibility before review', body: 'Returned allocations are validated for operational constraints. Infeasibility and unmet demand remain visible; a quantum sample is never silently repaired or presented as a clinical recommendation.', links: [['Solver results', 'results'], ['Experiment reports', 'reports']] },
  { number: '05', label: 'Re-plan and learn', icon: Activity, title: 'Compare, report, and respond', body: 'Compare solver outputs, inspect saved experiments, and run disruption scenarios. Every number represents a research model over synthetic data, not a live blood supply or care instruction.', links: [['Experiment reports', 'reports'], ['Quantum lab', 'quantum-lab']] },
];

export default function Flow({ onNavigate }) {
  return <div className="flow-page">
    <PageHeader eyebrow="HOW THE WORKSPACE FITS TOGETHER" title="The BloodFlow-Q flow" description="Follow a transparent path from synthetic network data to a validated allocation result, then re-plan when conditions change." />
    <BorderGlow className="flow-overview-glow" backgroundColor="var(--bg-surface)" borderRadius={18} glowRadius={18} glowColor="350 82 62" colors={['#ef233c','#8d99ae','#2b2d42']}>
      <section className="flow-overview panel"><div className="flow-overview-copy"><span className="eyebrow">ONE RESEARCH LOOP</span><h2>Supply → network → allocation → validation → response</h2><p>BloodFlow-Q is a logistics research prototype. It models aggregate inventory and demand, tests solver choices, and checks the returned candidate against the model’s constraints.</p></div><div className="flow-overview-visual" aria-label="Five stage BloodFlow-Q workflow"><span><Boxes/>Supply</span><i/><span><Route/>Network</span><i/><span><Settings2/>Optimize</span><i/><span><BadgeCheck/>Validate</span><i/><span><Siren/>Re-plan</span></div></section>
    </BorderGlow>
    <div className="flow-stage-list">{stages.map(({number,label,icon:Icon,title,body,links})=><BorderGlow key={number} className="flow-stage-glow" backgroundColor="var(--bg-surface)" borderRadius={16} glowRadius={12} glowColor="350 82 62" colors={['#ef233c','#8d99ae','#2b2d42']}><article className="flow-stage-card"><div className="flow-stage-marker"><span>{number}</span><Icon size={20}/></div><div className="flow-stage-body"><span className="eyebrow">{label}</span><h2>{title}</h2><p>{body}</p><div className="flow-stage-links">{links.map(([text,target])=><button key={target} onClick={()=>onNavigate(target)}>{text}<ArrowRight size={13}/></button>)}</div></div></article></BorderGlow>)}</div>
    <div className="flow-safety-note"><Hospital size={17}/><span><strong>Research scope:</strong> demo and saved reports use synthetic data. Outputs describe aggregate logistics only and are not clinical decisions or transfusion compatibility guidance.</span></div>
  </div>;
}
