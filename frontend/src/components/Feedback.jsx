import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Loading data from the API…' }) {
  return <div className="state-card" role="status" aria-live="polite"><LoaderCircle className="spin" size={20} aria-hidden="true" /> <span>{label}</span></div>;
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
