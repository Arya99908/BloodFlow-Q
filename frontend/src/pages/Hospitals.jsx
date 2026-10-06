import { Hospital, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';

const urgencyClass = (category) => `urgency urgency-${category}`;

export default function Hospitals() {
  const { data, loading, error, reload } = useApi(api.getScenario, []);
  const hospitals = data?.hospitals || [];
  const totalDemand = hospitals.reduce((sum, hospital) => sum + Object.values(hospital.demand || {}).reduce((subtotal, units) => subtotal + units, 0), 0);
  const priorityDemand = hospitals.reduce((sum, hospital) => sum + Object.entries(hospital.demand || {}).reduce((subtotal, [group, units]) => subtotal + (['high', 'critical'].includes(hospital.urgency?.[group]?.category) ? units : 0), 0), 0);
  return <>
    <PageHeader eyebrow="DEMAND NETWORK" title="Hospitals" description="A quick view of each hospital’s synthetic demand, priority labels, and location." />
    {loading && <LoadingState label="Loading hospital demand…" />}
    {!loading && error && <ErrorState message={error} onRetry={reload} />}
    {!loading && !error && data && data.synthetic === true && <>
      <div className="hospital-summary-strip"><div><span>HOSPITALS</span><strong>{hospitals.length}</strong></div><div><span>TOTAL DEMAND</span><strong>{totalDemand} <small>units</small></strong></div><div><span>HIGH / CRITICAL PRIORITY</span><strong>{priorityDemand} <small>units</small></strong></div><div className="urgency-legend" aria-label="Urgency legend"><span><i className="urgency-dot urgency-dot-critical" />Critical</span><span><i className="urgency-dot urgency-dot-high" />High</span><span><i className="urgency-dot urgency-dot-medium" />Medium</span><span><i className="urgency-dot urgency-dot-low" />Low</span></div></div>
      {hospitals.length ? <div className="hospital-grid">
        {hospitals.map((hospital) => {
          const hospitalTotal = Object.values(hospital.demand || {}).reduce((sum, units) => sum + units, 0);
          const largestGroup = Math.max(1, ...Object.values(hospital.demand || {}));
          return <article className="panel hospital-card" key={hospital.id}>
            <div className="hospital-card-header"><span className="table-avatar hospital-avatar"><Hospital size={18} /></span><div className="hospital-name-block"><h2>{hospital.name}</h2><code className="id-tag">{hospital.id}</code></div><div className="hospital-total"><span>TOTAL</span><strong>{hospitalTotal}</strong><small>units</small></div></div>
            <div className="location-line"><MapPin size={13} />Location <strong>{hospital.location_id}</strong></div>
        <div className="hospital-demand-list"><div className="list-label"><span>BLOOD GROUP</span><span aria-hidden="true" /><span>UNITS</span><span>URGENCY</span></div>
              {Object.entries(hospital.demand || {}).map(([group, units]) => {
                const category = hospital.urgency?.[group]?.category || 'unknown';
                return <div className="demand-row" key={group}>
                  <span className="group-token">{group}</span><div className="demand-meter" role="img" aria-label={`${units} units requested`}><i style={{ width: `${Math.max(2, Math.round((units / largestGroup) * 100))}%` }} /></div>
                  <strong>{units} <small>units</small></strong><span className={urgencyClass(category)}><i className={`urgency-dot urgency-dot-${category}`} />{category}</span>
                </div>;
              })}
            </div>
          </article>;
        })}
      </div> : <EmptyState title="No hospitals in this scenario" detail="The backend returned an empty hospital list." />}
      <div className="prototype-note">Urgency labels and demand are synthetic planning inputs; they are not patient-level clinical instructions.</div>
    </>}
    {!loading && !error && data && data.synthetic !== true && <div className="notice notice-error">The backend did not identify this scenario as synthetic. Demand is not displayed.</div>}
  </>;
}
