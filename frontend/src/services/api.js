const API_BASE = (import.meta.env?.VITE_API_BASE_URL || (import.meta.env?.PROD ? '' : 'http://127.0.0.1:8000')).replace(/\/$/, '');

/** Shared API boundary: components never build URLs or fetch directly. */
async function request(path, options = {}) {
  const controller = new AbortController();
  const relay = () => controller.abort();
  options.signal?.addEventListener('abort', relay, { once: true });
  if (options.signal?.aborted) controller.abort();
  const deadline = globalThis.setTimeout(() => controller.abort(), 70000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options, signal: controller.signal,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
    const payload = await response.json();
    if (!response.ok) {
      const detail = Array.isArray(payload.detail)
        ? payload.detail.map(item => item.message || JSON.stringify(item)).join('; ')
        : payload.detail;
      throw new Error(detail || `The API returned HTTP ${response.status}.`);
    }
    return payload;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Request cancelled or timed out. No result was accepted; retry with a smaller scenario.');
    if (error instanceof TypeError) throw new Error(`Could not reach the BloodFlow-Q API at ${API_BASE}. Start the backend and try again.`);
    throw error;
  } finally {
    globalThis.clearTimeout(deadline);
    options.signal?.removeEventListener('abort', relay);
  }
}

const post = (path, body, options = {}) => request(path, { ...options, method: 'POST', body: JSON.stringify(body) });

export const api = {
  runFlagship: (body, options) => post('/demo/flagship', body, options),
  getHealth: () => request('/health'),
  getScenario: () => request('/scenario'),
  getResults: () => request('/results'),
  optimize: (options = {}) => post('/optimize', options),
  simulateEmergency: (options) => post('/simulate-emergency', options),
  benchmark: (options = {}) => post('/benchmark', options),
  getDemoScenarios: () => request('/demo-scenarios'),
  getExperimentDefaults: () => request('/experiment-defaults'),
  getPrecomputedDemo: () => request('/precomputed-demo'),
  runDemo: (options) => post('/demo-run', options),
  getDonorNetworkCapabilities: () => request('/coordination/capabilities'),
  getDonorNetworkDashboard: () => request('/coordination/dashboard'),
  startEmergencyRequestDemo: () => post('/coordination/demo/start', {}),
  advanceEmergencyRequestDemo: (actions, action, donorId = null) => post('/coordination/demo/action', {
    actions,
    action,
    donor_id: donorId,
  }),
  chat: (message, history = [], context = {}) => post('/chat', { message, history, context }),
  getReportingTelemetry: (period = 'Last 7 days') => request('/reports/telemetry?period=' + encodeURIComponent(period)),
};

export function unwrapSavedResult(entry) {
  return entry?.result ?? entry;
}
