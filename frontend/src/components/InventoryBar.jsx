export default function InventoryBar({ value, maximum }) {
  const percent = maximum > 0 ? Math.min(100, Math.round((value / maximum) * 100)) : 0;
  const tone = percent >= 66 ? 'bar-high' : percent >= 33 ? 'bar-medium' : 'bar-low';
  return <div className="inventory-cell"><span>{value}</span><span className="inventory-track" aria-label={`${percent}% of the highest bank stock for this group`}><i className={`${tone}`} style={{ width: `${percent}%` }} /></span></div>;
}
