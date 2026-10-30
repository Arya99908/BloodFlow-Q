import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

/**
 * Hook to fetch and synchronize reporting telemetry from the backend API.
 * All metrics, chart points, and matrices derive strictly from this endpoint.
 */
export function useReportingTelemetry(period = 'Last 7 days') {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    api.getReportingTelemetry(period)
      .then((payload) => {
        if (!alive) return;
        if (!payload || !payload.kpis || !payload.availability) {
          throw new Error('Received incomplete telemetry response from backend API.');
        }
        setTelemetry(payload);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || 'Could not load reporting telemetry from backend.');
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [period, reloadToken]);

  return { telemetry, loading, error, reload };
}
