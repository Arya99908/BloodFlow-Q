import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, HelpCircle } from 'lucide-react';

/**
 * Renders a standardized metric/stat with clear separation between label, value, and unit.
 * Prevents text concatenation bugs like "BANKS3" or "TOTAL INVENTORY71 units".
 */
export function StatItem({ label, value, unit, hint, tone = 'default', size = 'medium', className = '' }) {
  return (
    <div className={`stat-item stat-item-${size} stat-item-${tone} ${className}`}>
      {label && <span className="stat-item-label">{label}</span>}
      <div className="stat-item-value-wrap">
        <strong className="stat-item-value">{value ?? '—'}</strong>
        {unit && <span className="stat-item-unit">{unit}</span>}
      </div>
      {hint && <small className="stat-item-hint">{hint}</small>}
    </div>
  );
}

/**
 * Standardized horizontal key-value row for cards, reports, and sidebars.
 * Prevents text concatenation bugs like "Methodgreedy" or "Unmet demand0 units".
 */
export function MetaRow({ label, value, unit, tone = 'default', className = '' }) {
  return (
    <div className={`meta-row meta-row-${tone} ${className}`}>
      <span className="meta-row-label">{label}</span>
      <div className="meta-row-value-wrap">
        <strong className="meta-row-value">{value ?? '—'}</strong>
        {unit && <span className="meta-row-unit">{unit}</span>}
      </div>
    </div>
  );
}

/**
 * Standardized accessible status badge with icon and label.
 * Does not rely on color alone to convey status.
 */
function toTitleCase(str) {
  if (!str) return '';
  return String(str)
    .replaceAll('_', ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function StatusBadge({ status, tone: propTone, label, className = '' }) {
  const norm = String(propTone || status || '').toLowerCase().trim();

  let tone = 'neutral';
  let Icon = HelpCircle;
  let text = label ? toTitleCase(label) : toTitleCase(status || propTone || 'Unknown');

  if (norm === 'available' || norm === 'feasible' || norm === 'completed' || norm === 'success' || norm === 'ok') {
    tone = 'success';
    Icon = CheckCircle2;
    text = label ? toTitleCase(label) : (norm === 'available' ? 'Available' : norm === 'feasible' ? 'Feasible' : 'Completed');
  } else if (norm === 'infeasible' || norm === 'blocked' || norm === 'error' || norm === 'failure' || norm === 'danger') {
    tone = 'danger';
    Icon = XCircle;
    text = label ? toTitleCase(label) : (norm === 'blocked' ? 'Blocked' : norm === 'infeasible' ? 'Infeasible' : 'Failed');
  } else if (norm === 'warning' || norm === 'critical' || norm === 'high') {
    tone = 'warning';
    Icon = AlertTriangle;
    text = label ? toTitleCase(label) : norm.toUpperCase();
  } else if (norm === 'skipped' || norm === 'skipped_too_large' || norm === 'unsupported' || norm === 'info') {
    tone = 'info';
    Icon = AlertTriangle;
    text = norm === 'skipped_too_large' || String(label).toLowerCase().includes('too large')
      ? 'Skipped (Too Large)'
      : (label ? toTitleCase(label) : 'Skipped');
  } else if (norm === 'running' || norm === 'pending') {
    tone = 'pending';
    Icon = Clock;
    text = label ? toTitleCase(label) : 'Running';
  } else if (norm === 'not_run' || norm === 'not_available' || norm === 'neutral') {
    tone = 'neutral';
    Icon = HelpCircle;
    text = label ? toTitleCase(label) : (norm === 'not_available' ? 'Not Available' : 'Not Run');
  }

  return (
    <span className={`status-pill status-pill-${tone} ${className}`}>
      <Icon size={12} className="status-pill-icon" aria-hidden="true" />
      <span className="status-pill-text">{text}</span>
    </span>
  );
}
