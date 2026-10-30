import { Activity, ArrowRight, Atom, Building2, Network, Play, ShieldCheck, Droplet, Hospital, Route, BadgeCheck } from 'lucide-react';
import Orb from '../components/Orb';
import DotGrid from '../components/DotGrid';
import MagicRings from '../components/MagicRings';
import BorderGlow from '../components/BorderGlow';
import TiltedCard from '../components/TiltedCard';
import TextType from '../components/TextType';
import SpecularButton from '../components/SpecularButton';

const destinations = [
  { id: 'dashboard', icon: Activity, eyebrow: 'OPERATIONS', title: 'Network overview', detail: 'Review synthetic supply, hospital demand, and recent solver activity.' },
  { id: 'optimization', icon: Atom, eyebrow: 'SOLVER WORKSPACE', title: 'Run optimization', detail: 'Configure an allocator and inspect its measured output.' },
  { id: 'hospitals', icon: Building2, eyebrow: 'HOSPITAL DATA', title: 'Hospital directory', detail: 'Explore the hospitals and demand records in this scenario.' },
  { id: 'network', icon: Network, eyebrow: 'TRANSPORT', title: 'Transport network', detail: 'Inspect routes, capacity, and network connectivity.' },
];

const flowSteps = [
  { icon: Droplet, title: 'Supply', detail: 'Read synthetic inventory by bank and blood group.', route: 'blood-banks' },
  { icon: Hospital, title: 'Demand', detail: 'Review hospital demand and priority labels.', route: 'hospitals' },
  { icon: Route, title: 'Network', detail: 'Inspect the transport links and route constraints.', route: 'network' },
  { icon: Atom, title: 'Optimize', detail: 'Choose a solver and allocate available stock.', route: 'optimization' },
  { icon: BadgeCheck, title: 'Validate', detail: 'Check feasibility and inspect unmet demand.', route: 'results' },
];

export default function Home({ onNavigate, researcherName = '', theme = 'light' }) {
  const welcomeName = researcherName.trim() || 'Researcher';
  return <div className="home-page">
    <section className="home-hero">
      <div className="home-hero-effects" aria-hidden="true">
        <DotGrid className="home-dot-field" dotSize={1.4} gap={24} baseColor="#8d99ae" activeColor="#e71e61" opacity={0.48} glow={0.5} swell={0.4} intro={false} mouseInteraction={false} clickShock={false} />
        <Orb className="home-orb" colors={['#e71e61', '#3aa5a0', '#0b3c65']} backgroundColor="#000000" size={0.8} glow={0.7} opacity={0.5} speed={0.35} followCursor={false} clickPulse={false} intro={false} />
      </div>
      <div className="home-hero-content">
        <a className="home-brand-lockup" href="/" aria-label="BloodFlow-Q home"><img src="/bloodflow-q-logo.webp" alt="" /><span>BloodFlow<span>-Q</span><small>QUANTUM LOGISTICS RESEARCH</small></span></a>
        <p className="home-kicker">SYNTHETIC RESEARCH WORKSPACE <span><i /> SYSTEM READY</span></p>
        <TextType as="h1" text={`Welcome back, ${welcomeName}.`} typingSpeed={24} loop={false} showCursor={false} typeEffect="fade" />
        <p className="home-lede">Model blood logistics as a network decision problem. Explore hospital demand, test route disruptions, and compare classical and quantum-assisted allocation methods.</p>
        <div className="home-actions">
          <SpecularButton className="home-primary-action" size="md" radius={12} tint="#ef233c" textColor="#fff" lineColor="#ff9aa8" baseColor="#920942" onClick={() => onNavigate('demo')}><Activity size={16} /> Explore the disruption story <ArrowRight size={16} /></SpecularButton>
          <button type="button" className="home-secondary-action" onClick={() => onNavigate('optimization')}><Play size={15} /> Start an optimization</button>
        </div>
        <div className="home-trust-row"><span><ShieldCheck size={15} /> Synthetic data only</span><span><Atom size={15} /> Classical + quantum methods</span></div>
      </div>
      <div className="home-hero-visual" aria-hidden="true"><MagicRings className="home-magic-rings" color="#e71e61" colorTwo="#3aa5a0" ringCount={7} motion="pulse" speed={0.45} lineThickness={1.5} glow={1.1} baseRadius={0.29} radiusStep={0.105} rotation={-18} tilt={23} opacity={0.85} followMouse={false} clickBurst={false} intro theme={theme} /><div className="home-visual-orbit orbit-one" /><div className="home-visual-orbit orbit-two" /><TiltedCard className="home-visual-tilt" imageSrc="/bloodflow-q-logo.webp" altText="BloodFlow-Q quantum logistics mark" containerWidth="190px" containerHeight="190px" imageWidth="160px" imageHeight="160px" rotateAmplitude={9} glare={0.28} shadow={0.26} parallax={0.3} showTooltip={false} intro={false} /><div className="home-visual-label"><i /> NETWORK MODEL <b>v2.001</b></div></div>
    </section>
    <section className="home-explore" aria-labelledby="home-explore-title">
      <div className="home-section-heading"><div><span className="eyebrow">RESEARCH WORKSPACE</span><h2 id="home-explore-title">Where would you like to begin?</h2></div><span>Choose a workspace to explore</span></div>
      <div className="home-destination-grid">{destinations.map(({ id, icon: Icon, eyebrow, title, detail }, index) => <BorderGlow key={id} className="home-destination-glow" backgroundColor={theme === 'dark' ? '#202438' : '#ffffff'} borderRadius={15} glowRadius={10} glowColor="350 82 62" colors={['#e71e61', '#3aa5a0', '#0b3c65']}><button className="home-destination-card" onClick={() => onNavigate(id)}><span className="home-destination-number">0{index + 1}</span><span className="home-destination-icon"><Icon size={20} /></span><span className="home-destination-copy"><small>{eyebrow}</small><strong>{title}</strong><span>{detail}</span></span><ArrowRight className="home-destination-arrow" size={17} /></button></BorderGlow>)}</div>
    </section>
    <section className="home-flow-preview" aria-labelledby="home-flow-title"><div className="home-section-heading"><div><span className="eyebrow">THE BLOODFLOW-Q FLOW</span><h2 id="home-flow-title">From network inputs to a validated plan</h2></div><button className="text-button" onClick={() => onNavigate('flow')}>See how it works <ArrowRight size={14}/></button></div><div className="home-flow-steps">{flowSteps.map(({icon:Icon,title,detail,route},index)=><button type="button" className="home-flow-step" key={title} onClick={()=>onNavigate(route)}><span className="home-flow-step-number">0{index+1}</span><Icon size={19}/><strong>{title}</strong><span>{detail}</span>{index < flowSteps.length-1 && <i className="home-flow-connector" aria-hidden="true"/>}</button>)}</div></section>
    <div className="home-disclaimer"><Activity size={15} /><span>BloodFlow-Q is a research prototype using synthetic data. It is not intended for clinical decisions.</span></div>
  </div>;
}
