import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';
import LatticeLoader from './LatticeLoader';

export function LoadingState({ label = 'Loading data from the API…' }) {
  const optimizing = /optim|solver|qaoa|benchmark|pipeline/i.test(label);
  return <div className={`state-card ${optimizing ? 'state-optimizing' : ''}`} role="status" aria-live="polite">{optimizing ? <LatticeLoader label={label} pattern="orbit" grid={3} color="#ef233c" glow glowColor="#d90429" showTimer={false} /> : <><LoaderCircle className="spin" size={20} aria-hidden="true" /><span>{label}</span></>}</div>;
}

export default LoadingState;

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-card state-error" role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <div><strong>We couldn’t load this information</strong><p>{message}</p>
        {onRetry && <button type="button" className="button button-secondary button-small" onClick={onRetry}><RefreshCw size={14} aria-hidden="true" /> Try again</button>}
      </div>
    </div>
  );
}

export function EmptyState({ title, detail }) {
  return (
    <div className="empty-state" role="status">
      {title && <strong>{title}</strong>}
      {detail && <p>{detail}</p>}
    </div>
  );
}
