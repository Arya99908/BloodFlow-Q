import { QAOA_VARIANTS, getQAOAVariant } from '../utils/qaoaVariants';

export default function QAOAVariantSelect({ value, onChange, disabled = false, id = 'qaoa-variant' }) {
  const variant = getQAOAVariant(value);
  return <div className="qaoa-variant-control">
    <label className="field-label" htmlFor={id}>QAOA initialization and mixer</label>
    <select id={id} className="field-control" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} aria-describedby={`${id}-help`}>
      {QAOA_VARIANTS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
    <p id={`${id}-help`} className="comparison-help">{variant.description}</p>
  </div>;
}
