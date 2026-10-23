import { useEffect, useState } from 'react';

export function useResearchStudy() {
  const [study, setStudy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/quantum-value-study.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Study data request failed (${response.status})`);
        return response.json();
      })
      .then((value) => { if (active) setStudy(value); })
      .catch((issue) => { if (active) setError(issue.message || 'Could not load the saved research run.'); });
    return () => { active = false; };
  }, []);

  return { study, error };
}
