import { ArrowRight, CircleAlert, Route as RouteIcon, Droplet, Hospital, MapPin } from 'lucide-react';

export default function NetworkOverview({ scenario }) {
  const banks = scenario.blood_banks || [];
  const hospitals = scenario.hospitals || [];
  const routes = scenario.routes || [];
  const available = routes.filter((route) => route.status === 'available');
  const blocked = routes.filter((route) => route.status === 'blocked');

  return (
    <section className="panel network-panel">
      <div className="panel-heading">
        <div>
          <h2>Network topology</h2>
          <p>Supply sources, distribution channels, and hospital nodes</p>
        </div>
        <div className="network-summary-pills">
          <span className="summary-pill summary-pill-available">
            <i className="status-dot dot-green" aria-hidden="true" />
            <span>{available.length} available</span>
          </span>
          {blocked.length > 0 && (
            <span className="summary-pill summary-pill-blocked">
              <i className="status-dot dot-muted" aria-hidden="true" />
              <span>{blocked.length} blocked</span>
            </span>
          )}
        </div>
      </div>

      <div
        className="network-map"
        aria-label={`${banks.length} blood banks connected to ${hospitals.length} hospitals by ${available.length} available routes`}
      >
        <div className="network-column">
          <div className="network-column-title">
            <span>BLOOD BANKS</span>
            <span className="column-count-badge">{banks.length}</span>
          </div>
          <div className="network-node-list">
            {banks.map((bank) => (
              <div className="network-node bank-node" key={bank.id}>
                <span className="node-mark node-bank">
                  <Droplet size={13} />
                </span>
                <div className="node-details">
                  <strong>{bank.name}</strong>
                  <small>
                    <MapPin size={10} aria-hidden="true" />
                    <span>Location: {bank.location_id}</span>
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="network-bridge">
          <div className="bridge-line" aria-hidden="true" />
          <div className="bridge-chip">
            <RouteIcon size={14} />
            <span>{available.length} active routes</span>
          </div>
          <div className="bridge-arrow" aria-hidden="true">
            <ArrowRight size={18} />
          </div>
        </div>

        <div className="network-column">
          <div className="network-column-title">
            <span>HOSPITALS</span>
            <span className="column-count-badge">{hospitals.length}</span>
          </div>
          <div className="network-node-list">
            {hospitals.map((hospital) => (
              <div className="network-node hospital-node" key={hospital.id}>
                <span className="node-mark node-hospital">
                  <Hospital size={13} />
                </span>
                <div className="node-details">
                  <strong>{hospital.name}</strong>
                  <small>
                    <MapPin size={10} aria-hidden="true" />
                    <span>Location: {hospital.location_id}</span>
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {blocked.length > 0 && (
        <div className="network-note" role="note">
          <CircleAlert size={14} />
          <span>
            {blocked.length} route{blocked.length === 1 ? '' : 's'} marked blocked in this scenario are excluded from shipment planning.
          </span>
        </div>
      )}
    </section>
  );
}
