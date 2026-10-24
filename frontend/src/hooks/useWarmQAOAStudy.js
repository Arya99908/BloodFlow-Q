import { useEffect, useState } from 'react';

export function useWarmQAOAStudy() {
  const [study, setStudy] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/warm-qaoa-paired-20261022.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Warm-start study request failed (${response.status})`);
        return response.json();
      })
      .then((value) => { if (active) setStudy(value); })
      .catch((issue) => { if (active) setError(issue.message || 'Could not load the warm-start study.'); });
    return () => { active = false; };
  }, []);
  return { study, error };
}
