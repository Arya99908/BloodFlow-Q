/** A missing measurement is never a measured zero. Numeric strings are supported. */
export function isFiniteMeasurement(value) {
  return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))
    && Number.isFinite(Number(value));
}
