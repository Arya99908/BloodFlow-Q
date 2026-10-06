const API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')).replace(/\/$/, '');

/** Shared API boundary: components never build URLs or fetch directly. */
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(`Could not reach the BloodFlow-Q API at ${API_BASE}. Start the backend and try again.`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(payload.detail)
      ? payload.detail.map((item) => item.message || JSON.stringify(item)).join('; ')
      : payload.detail;
    throw new Error(detail || `The API returned HTTP ${response.status}.`);
  }
  return payload;
}

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
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
};

export function unwrapSavedResult(entry) {
  return entry?.result ?? entry;
}
