import { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, CheckCircle2, Hospital, Network, Settings2, ShieldCheck } from 'lucide-react';

const STEPS = [
  { id: 'supply', title: 'Supply', subtitle: 'Inventory inputs', icon: Boxes, description: 'Available stock is read from each synthetic blood bank by group. Inventory limits constrain the quantities the solver can allocate.' },
  { id: 'demand', title: 'Demand', subtitle: 'Hospital requirements', icon: Hospital, description: 'The active scenario supplies hospital demand and urgency weights. The model evaluates unmet demand alongside the configured objective.' },
  { id: 'network', title: 'Network', subtitle: 'Transport connectivity', icon: Network, description: 'Modeled routes, costs, times, and route status determine which shipments can be considered in this scenario.' },
  { id: 'optimize', title: 'Optimize', subtitle: 'Allocation strategy', icon: Settings2, description: 'The selected classical solver or local QAOA simulator evaluates candidate allocations under the existing model constraints.' },
  { id: 'validate', title: 'Validate', subtitle: 'Feasibility and results', icon: ShieldCheck, description: 'The returned candidate is checked against the original scenario rules. Infeasible results remain visible; the interface does not silently repair them.' },
];

export default function OptimizationJourney({ scenario, method, result }) {
  const [active, setActive] = useState(0);
  const refs = useRef([]);
  const totals = useMemo(() => {
    const banks = scenario?.blood_banks || [];
    const hospitals = scenario?.hospitals || [];
    const groups = scenario?.blood_groups || [];
    return {
      banks: banks.length,
      stock: banks.reduce((sum, bank) => sum + groups.reduce((inner, group) => inner + Number(bank.inventory?.[group] || 0), 0), 0),
      hospitals: hospitals.length,
      demand: hospitals.reduce((sum, hospital) => sum + Object.values(hospital.demand || {}).reduce((inner, units) => inner + Number(units || 0), 0), 0),
      routes: scenario?.routes?.length || 0,
      availableRoutes: (scenario?.routes || []).filter(route => route.available !== false && !['closed', 'disrupted', 'unavailable'].includes(String(route.status || '').toLowerCase())).length,
    };
  }, [scenario]);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(Number(visible.target.dataset.stepIndex));
    }, { threshold: [0.15, 0.4, 0.65], rootMargin: '-20% 0px -28% 0px' });
    refs.current.forEach(node => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const Icon = STEPS[active].icon;
  const valueForStep = [
    `${totals.banks} banks · ${totals.stock.toLocaleString()} units`,
    `${totals.hospitals} hospitals · ${totals.demand.toLocaleString()} units`,
    `${totals.availableRoutes} available · ${totals.routes} modeled routes`,
    result ? `${String(result.method || method).toUpperCase()} run returned` : `${String(method || 'greedy').toUpperCase()} selected`,
    result ? (result.feasibility === true ? 'Feasibility checks passed' : result.feasibility === false ? 'Infeasible result returned' : 'Feasibility not reported') : 'Run a solver to inspect validation',
  ][active];

  return <section className="optimization-journey" aria-labelledby="optimization-journey-title">
    <div className="optimization-journey-heading"><span className="eyebrow">THE BLOODFLOW-Q PIPELINE</span><h2 id="optimization-journey-title">From operational inputs to a checked allocation</h2><p>Scroll through the steps. The summary panel reflects the active scenario and the latest returned run.</p></div>
    <div className="optimization-journey-layout">
      <div className="optimization-journey-copy">
        {STEPS.map(({ id, title, subtitle, description, icon: StepIcon }, index) => <article key={id} ref={node => { refs.current[index] = node; }} data-step-index={index} data-active={active === index ? 'true' : undefined} className="optimization-journey-step">
          <span className="optimization-journey-number">0{index + 1}</span><StepIcon size={18} aria-hidden="true" /><div><span>{subtitle}</span><h3>{title}</h3><p>{description}</p></div>
        </article>)}
      </div>
      <aside className="optimization-journey-visual" aria-live="polite" aria-label={`${STEPS[active].title} summary`}>
        <div className="optimization-journey-visual-top"><span className="optimization-journey-icon"><Icon size={20} /></span><span>ACTIVE STAGE · 0{active + 1}</span></div>
        <div className="optimization-journey-visual-title"><small>{STEPS[active].subtitle}</small><strong>{STEPS[active].title}</strong></div>
        <div className="optimization-journey-value">{valueForStep}</div>
        <div className="optimization-journey-track" aria-hidden="true"><i style={{ width: `${((active + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="optimization-journey-footer">{active === 4 && result ? <><CheckCircle2 size={15} /> Returned result · {Number(result.total_unmet_demand || 0)} unmet units</> : <> <span className="optimization-journey-pulse" /> Synthetic scenario data · research use</>}</div>
      </aside>
    </div>
  </section>;
}
