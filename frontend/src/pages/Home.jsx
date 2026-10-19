import { Activity, ArrowRight, Boxes, Hospital, Network, Settings2 } from 'lucide-react';

const destinations = [
  { id: 'dashboard', label: 'Dashboard', detail: 'Review the active synthetic scenario and recent runs.', icon: Activity },
  { id: 'network', label: 'Transport network', detail: 'Inspect supply locations, hospitals, and routes.', icon: Network },
  { id: 'optimization', label: 'Optimization', detail: 'Run a solver and validate its returned allocation.', icon: Settings2 },
];

export default function Home({ onNavigate }) {
  return <div className="home-page">
    <section className="home-hero">
      <div className="home-hero-content">
        <a className="home-brand-lockup" href="/" aria-label="BloodFlow-Q home">
          <img src="/bloodflow-q-logo.webp" alt="" />
          <span>BloodFlow<span>-Q</span><small>LOGISTICS RESEARCH</small></span>
        </a>
        <p className="home-kicker">SYNTHETIC RESEARCH WORKSPACE</p>
        <h1>Explore the network. Test allocation strategies.</h1>
        <p className="home-lede">BloodFlow-Q compares classical and simulated QAOA methods for a synthetic blood-resource logistics problem. Review the model, run a solver, and inspect feasibility before drawing conclusions.</p>
        <div className="home-actions">
          <button type="button" className="button button-primary home-primary-action" onClick={() => onNavigate('dashboard')}>
            <Activity size={16} /> Open dashboard <ArrowRight size={16} />
          </button>
          <button type="button" className="home-secondary-action" onClick={() => onNavigate('about')}>
            <Boxes size={15} /> Read methodology
          </button>
        </div>
        <p className="home-scope-note"><Hospital size={15} /> Research prototype with synthetic data. Not for clinical decisions.</p>
      </div>
      <div className="home-hero-visual" aria-hidden="true">
        <div className="home-logo-tile"><img src="/bloodflow-q-logo.webp" alt="" /></div>
        <span className="home-visual-label">SYNTHETIC LOGISTICS MODEL</span>
      </div>
    </section>
    <section className="home-destinations" aria-label="Start here">
      {destinations.map(({ id, label, detail, icon: Icon }) => <button type="button" className="home-destination-card" key={id} onClick={() => onNavigate(id)}>
        <span className="home-destination-icon"><Icon size={18} aria-hidden="true" /></span>
        <span className="home-destination-copy"><strong>{label}</strong><span>{detail}</span></span>
        <ArrowRight size={16} aria-hidden="true" />
      </button>)}
    </section>
  </div>;
}
