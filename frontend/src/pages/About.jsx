import { Activity, Binary, CircleDot, Code2, Cpu, FlaskConical, GitBranch, Layers3, ListChecks, Radio, ShieldCheck, Shuffle, Sigma } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const workflow = [
  { icon: Layers3, title: 'Blood Allocation', text: 'The model considers aggregate quantities that could move from a blood bank to a hospital for a modeled group. It represents logistics at scenario level, not individual patient decisions.' },
  { icon: Binary, title: 'Binary Decisions', text: 'Each possible shipment amount is represented with binary bits, where each bit is 0 or 1. Together, those bits encode a candidate allocation.' },
  { icon: Sigma, title: 'QUBO', text: 'QUBO is the mathematical optimization formulation. It combines allocation costs and constraint penalties into a quadratic score over binary variables.' },
  { icon: GitBranch, title: 'Ising Model', text: 'The QUBO can be rewritten using spin variables that take values −1 or +1. This is an equivalent mathematical form used to express the cost as a quantum operator.' },
  { icon: Cpu, title: 'Cost Hamiltonian', text: 'The Ising cost becomes a cost Hamiltonian, a quantum operator whose values represent candidate costs. QAOA uses it to give lower-cost candidates more favorable phase changes.' },
  { icon: Shuffle, title: 'QAOA', text: 'QAOA is the quantum algorithm. It alternates cost operations with a mixer, while a classical optimizer adjusts circuit parameters to search for promising candidates.' },
  { icon: Radio, title: 'Measurement', text: 'The circuit is measured repeatedly, producing sampled outcomes called shots. A finite set of measurements can miss good candidates and can include infeasible ones.' },
  { icon: Binary, title: 'Bitstring', text: 'A measurement produces a sequence of 0s and 1s. That bitstring is one sampled candidate from the QAOA run.' },
  { icon: Code2, title: 'Decoder', text: 'The decoder follows the QUBO builder’s variable map to translate each bit position into shipment and unmet-demand decisions. It does not guess variable positions.' },
  { icon: ListChecks, title: 'Classical Validation', text: 'A classical validator checks inventory, demand accounting, compatibility, route availability, and other hard constraints. Infeasible samples stay visible and are not silently repaired.' },
];

export default function About() {
  return <>
    <PageHeader eyebrow="PROJECT NOTES" title="Methodology" description="A short visual guide to the hybrid optimization workflow behind BloodFlow-Q." />
    <section className="methodology-callout"><div className="methodology-callout-icon"><FlaskConical size={19} /></div><div><strong>Hybrid quantum-classical research prototype</strong><p>QUBO is the mathematical optimization formulation. QAOA is the quantum algorithm. The overall system is hybrid quantum-classical: classical code prepares and checks the problem, a quantum circuit samples candidates, and classical code scores and validates them.</p></div></section>
    <section className="panel methodology-pipeline"><div className="methodology-section-heading"><div><span className="eyebrow">FROM SCENARIO TO CHECKED CANDIDATE</span><h2>Optimization workflow</h2></div><span className="pipeline-label"><Activity size={14} /> Conceptual pipeline</span></div>
      <div className="methodology-step-list">{workflow.map(({ icon: Icon, title, text }, index) => <article className="methodology-step" key={title}>
        <div className="methodology-step-marker"><span>{index + 1}</span>{index < workflow.length - 1 && <i />}</div>
        <div className="methodology-step-card"><div className="methodology-step-icon"><Icon size={18} /></div><div className="methodology-step-copy"><div className="methodology-step-title"><h3>{title}</h3>{index === 2 && <span className="method-tag tag-formulation">FORMULATION</span>}{index === 5 && <span className="method-tag tag-algorithm">ALGORITHM</span>}</div><p>{text}</p></div></div>
      </article>)}</div>
    </section>
    <div className="methodology-explain-grid"><section className="panel methodology-explain-card"><span className="methodology-explain-icon"><Sigma size={17} /></span><div><h2>QUBO describes the problem</h2><p>It gives a score to each binary candidate and includes penalty terms for modeled constraints. Building a QUBO does not run a quantum algorithm.</p></div></section><section className="panel methodology-explain-card"><span className="methodology-explain-icon"><Cpu size={17} /></span><div><h2>QAOA searches for candidates</h2><p>QAOA is a hybrid quantum-classical algorithm that samples candidate bitstrings. Its returned best measured candidate is not automatically a global optimum.</p></div></section></div>
    <section className="panel methodology-limits"><div className="methodology-limits-icon"><ShieldCheck size={19} /></div><div><span className="eyebrow">SCOPE AND SAFETY</span><h2>Operational research only</h2><p className="required-safety-statement">“BloodFlow-Q is a research prototype for operational optimization using synthetic data. It is not a clinical transfusion decision system.”</p><p>The compatibility rules are simplified assumptions for a logistics demonstration, not a complete clinical compatibility system. Results do not establish clinical validity, real-world deployment readiness, real patient outcomes, or quantum advantage.</p></div></section>
    <div className="methodology-footnote"><CircleDot size={14} /><span>QAOA simulator outputs are finite-shot measurements. Benchmark comparisons must use the recorded run settings and returned results.</span></div>
  </>;
}
