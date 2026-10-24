import { useCallback, useEffect, useRef, useState } from 'react';

import { createLatestRequest } from '../utils/latestRequest';

/** Reusable loading/error state for backend-backed page data. */
export function useApi(load, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requests = useRef(null);
  if (!requests.current) requests.current = createLatestRequest();
  const reload = useCallback(() => requests.current.run(load, {
    start: () => { setLoading(true); setError(''); },
    success: setData,
    failure: issue => setError(issue instanceof Error ? issue.message : 'The request could not be completed.'),
    finish: () => setLoading(false),
  // The caller owns the dependencies so pages can control refresh behavior.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), dependencies);

  useEffect(() => {
    reload();
    return () => requests.current.invalidate();
  }, [reload]);
  return { data, loading, error, reload, setData };
}
