import Orb from './Orb';
import { createPortal } from 'react-dom';

export default function NavigationTransition({ destination, reducedMotion = false }) {
  if (!destination) return null;
  const Icon = destination.icon;
  return createPortal(<div className={`navigation-transition${reducedMotion ? ' navigation-transition--reduced' : ''}`} role="status" aria-live="polite" aria-label={`Opening ${destination.label}`}>
    <div className="navigation-transition-orb" aria-hidden="true"><Orb colors={['#ef233c', '#ff8795', '#536d9a']} backgroundColor="#0b1220" size={0.72} glow={0.9} speed={0.7} opacity={0.9} followCursor={false} clickPulse={false} intro /></div>
    <div className="navigation-transition-icon"><Icon size={34} strokeWidth={1.8} /></div>
    <span>Opening {destination.label}</span>
  </div>, document.body);
}
