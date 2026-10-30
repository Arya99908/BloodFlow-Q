import { useEffect, useState } from "react";
let cached;
export default function useObservatory() {
  const [data, setData] = useState(cached),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (cached) {
      setData(cached);
      return;
    }
    const controller = new AbortController();
    fetch("/observatory-evidence.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Evidence request failed (${r.status})`);
        return r.json();
      })
      .then((v) => {
        if (!Array.isArray(v.observations) || !Array.isArray(v.scenarios))
          throw new Error("Evidence schema is invalid");
        cached = v;
        setData(v);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [attempt]);
  return {
    data,
    error,
    retry: () => {
      setError("");
      setAttempt((x) => x + 1);
    },
  };
}
