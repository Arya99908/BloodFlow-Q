/**
 * Return the metric object used by the Demo Mode comparison table.
 *
 * Live `/demo-run` responses store metrics in `record.result`. Some older
 * saved experiment records wrap that API response in another `result` field.
 * Handling both shapes keeps real values visible without inventing defaults.
 */
export function getComparableResult(record) {
  const firstResult = record?.result;
  if (!firstResult || typeof firstResult !== 'object') return record ?? null;

  const nestedResult = firstResult.result;
  if (nestedResult && typeof nestedResult === 'object') return nestedResult;

  return firstResult;
}
