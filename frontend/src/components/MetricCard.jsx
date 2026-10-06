export default function MetricCard({ icon: Icon, label, value, detail, tone = 'blue' }) {
  return <article className={`metric-card metric-${tone}`}>
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={18} aria-hidden="true" /></span></div>
    <div className="metric-value">{value}</div>
    <div className="metric-detail">{detail}</div>
  </article>;
}
