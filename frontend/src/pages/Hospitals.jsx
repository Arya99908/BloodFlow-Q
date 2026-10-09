import { Hospital, MapPin, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';
import { StatItem } from '../components/DataField';

export default function Hospitals() {
  const { data, loading, error, reload } = useApi(api.getScenario, []);
  const hospitals = data?.hospitals || [];
  const totalDemand = hospitals.reduce((sum, hospital) => sum + Object.values(hospital.demand || {}).reduce((subtotal, units) => subtotal + Number(units || 0), 0), 0);
  const priorityDemand = hospitals.reduce((sum, hospital) => sum + Object.entries(hospital.demand || {}).reduce((subtotal, [group, units]) => subtotal + (['high', 'critical'].includes(hospital.urgency?.[group]?.category) ? Number(units || 0) : 0), 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="DEMAND NETWORK"
        title="Hospitals"
        description="Inspect synthetic clinical demand, blood group breakdown, urgency priority, and facility locations."
      />

      {loading && <LoadingState label="Loading hospital demand catalog…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && data.synthetic === true && (
        <div className="hospitals-page-flow">
          {/* Top KPI and Urgency Legend Strip */}
          <section className="hospitals-kpi-strip" aria-label="Hospital demand summary metrics">
            <div className="hospitals-stat-cards">
              <StatItem label="Hospitals" value={hospitals.length} unit="destinations" />
              <StatItem label="Total demand" value={totalDemand.toLocaleString()} unit="units" />
              <StatItem
                label="High / critical urgency"
                value={priorityDemand.toLocaleString()}
                unit="units"
                tone={priorityDemand > 0 ? 'warning' : 'default'}
              />
            </div>

            <div className="urgency-legend-card" aria-label="Urgency priority levels">
              <span className="legend-title">URGENCY TIERS</span>
              <div className="legend-items">
                <span className="legend-pill urgency-critical">
                  <i className="urgency-dot urgency-dot-critical" aria-hidden="true" />
                  Critical
                </span>
                <span className="legend-pill urgency-high">
                  <i className="urgency-dot urgency-dot-high" aria-hidden="true" />
                  High
                </span>
                <span className="legend-pill urgency-medium">
                  <i className="urgency-dot urgency-dot-medium" aria-hidden="true" />
                  Medium
                </span>
                <span className="legend-pill urgency-low">
                  <i className="urgency-dot urgency-dot-low" aria-hidden="true" />
                  Low
                </span>
              </div>
            </div>
          </section>

          {/* Hospital Cards Grid */}
          {hospitals.length ? (
            <div className="hospital-grid">
              {hospitals.map((hospital) => {
                const hospitalTotal = Object.values(hospital.demand || {}).reduce((sum, units) => sum + Number(units || 0), 0);
                const largestGroup = Math.max(1, ...Object.values(hospital.demand || {}));

                return (
                  <article className="panel hospital-card" key={hospital.id}>
                    <div className="hospital-card-header">
                      <div className="hospital-info-col">
                        <span className="facility-avatar hospital-avatar">
                          <Hospital size={16} />
                        </span>
                        <div>
                          <h2>{hospital.name}</h2>
                          <div className="facility-location">
                            <MapPin size={11} aria-hidden="true" />
                            <span>Location: {hospital.location_id}</span>
                            <code className="facility-id-code">{hospital.id}</code>
                          </div>
                        </div>
                      </div>

                      <div className="hospital-total-badge">
                        <span className="total-badge-label">TOTAL DEMAND</span>
                        <strong className="total-badge-value">{hospitalTotal}</strong>
                        <span className="total-badge-unit">units</span>
                      </div>
                    </div>

                    <div className="hospital-demand-list">
                      <div className="demand-list-head">
                        <span>BLOOD GROUP</span>
                        <span className="text-center">ALLOCATION METER</span>
                        <span className="text-right">UNITS</span>
                        <span className="text-right">URGENCY</span>
                      </div>

                      {Object.entries(hospital.demand || {}).map(([group, units]) => {
                        const category = hospital.urgency?.[group]?.category || 'unknown';
                        const percentWidth = Math.max(4, Math.round((Number(units || 0) / largestGroup) * 100));

                        return (
                          <div className="demand-row" key={group}>
                            <span className="group-token">{group}</span>
                            <div className="demand-meter" role="img" aria-label={`${units} units requested for group ${group}`}>
                              <i style={{ width: `${percentWidth}%` }} />
                            </div>
                            <strong className="demand-units-val">{units} <small>units</small></strong>
                            <span className={`urgency-pill urgency-pill-${category}`}>
                              <i className={`urgency-dot urgency-dot-${category}`} aria-hidden="true" />
                              {category}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No hospitals in this scenario" detail="The backend returned an empty hospital list." />
          )}

          <div className="prototype-note">
            <AlertTriangle size={15} />
            <span>Urgency labels and demand quantities represent scenario-level logistics planning parameters; they do not represent individual patient prescriptions or bedside clinical guidance.</span>
          </div>
        </div>
      )}

      {!loading && !error && data && data.synthetic !== true && (
        <div className="notice notice-error">
          The backend did not identify this scenario as synthetic. Demand is not displayed.
        </div>
      )}
    </>
  );
}
