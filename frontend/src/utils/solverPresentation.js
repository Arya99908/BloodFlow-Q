/** Normalize legacy responses without treating guard/dispatch time as solver runtime. */
export function solverPresentation(record = {}) {
  const status = record.status || 'not_run';
  const measured = ['completed', 'infeasible'].includes(status);
  const labels = { completed: 'Completed', infeasible: 'Completed (infeasible)', running: 'Running', pending: 'Running', skipped_too_large: 'Skipped · safety limit', not_requested: 'Not selected', not_selected: 'Not selected', unsupported: 'Unsupported by backend', error: 'Failed', failed: 'Failed', not_run: 'Not run', not_available: 'Not run / variant unavailable' };
  const explanations = {
    skipped_too_large: 'Execution was refused by the computational safety limit. No solver runtime was measured.',
    not_requested: 'This method was not selected for this comparison; it was not benchmarked.',
    not_selected: 'This method was not selected for this comparison; it was not benchmarked.',
    unsupported: 'The backend does not support this solver or configuration for the scenario.',
    error: 'The attempt failed; no completed benchmark is available.',
    failed: 'The attempt failed; no completed benchmark is available.',
    running: 'Execution is in progress; final measurements are not available.',
    pending: 'Execution is pending; final measurements are not available.',
    not_run: 'No execution was recorded. A missing QAOA variant cannot establish that it was benchmarked.',
    not_available: 'No valid variant or execution record is available for this scenario.',
  };
  return { status, measured, label: labels[status] || status.replaceAll('_', ' '), explanation: explanations[status] || '', runtime: measured && Number.isFinite(record.runtime_seconds) && record.runtime_seconds >= 0 ? `${record.runtime_seconds.toFixed(4)} s` : '—' };
}
