import { ArrowRight, CircleAlert, Route } from 'lucide-react';

export default function NetworkOverview({ scenario }) {
  const banks = scenario.blood_banks || [];
  const hospitals = scenario.hospitals || [];
  const routes = scenario.routes || [];
  const available = routes.filter((route) => route.status === 'available');
  const blocked = routes.filter((route) => route.status === 'blocked');

  return <section className="panel network-panel">
    <div className="panel-heading"><div><h2>Network overview</h2><p>Connections and route status from the current scenario</p></div>
      <div className="network-summary"><span><i className="dot dot-green" />{available.length} available</span>{blocked.length > 0 && <span><i className="dot dot-muted" />{blocked.length} blocked</span>}</div>
    </div>
    <div className="network-map" aria-label={`${banks.length} blood banks connected to ${hospitals.length} hospitals by ${available.length} available routes`}>
      <div className="network-column"><div className="network-column-title">BLOOD BANKS <span>{banks.length}</span></div>
        {banks.map((bank) => <div className="network-node bank-node" key={bank.id}><span className="node-mark node-bank">B</span><span><strong>{bank.name}</strong><small>{bank.location_id}</small></span></div>)}
      </div>
      <div className="network-bridge"><div className="bridge-line" /><div className="bridge-chip"><Route size={15} />{available.length} active routes</div><div className="bridge-arrow"><ArrowRight size={19} /></div></div>
      <div className="network-column"><div className="network-column-title">HOSPITALS <span>{hospitals.length}</span></div>
        {hospitals.map((hospital) => <div className="network-node hospital-node" key={hospital.id}><span className="node-mark node-hospital">H</span><span><strong>{hospital.name}</strong><small>{hospital.location_id}</small></span></div>)}
      </div>
    </div>
    {blocked.length > 0 && <div className="network-note"><CircleAlert size={15} /> {blocked.length} route{blocked.length === 1 ? '' : 's'} marked blocked are excluded by the current scenario.</div>}
  </section>;
}
