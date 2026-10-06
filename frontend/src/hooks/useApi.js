import { useCallback, useEffect, useState } from 'react';

/** Reusable loading/error state for backend-backed page data. */
export function useApi(load, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await load());
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'The request could not be completed.');
    } finally {
      setLoading(false);
    }
  // The caller owns the dependencies so pages can control refresh behavior.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}
