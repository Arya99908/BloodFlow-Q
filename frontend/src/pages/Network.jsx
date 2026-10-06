import { useState } from 'react';
import { ArrowDown, ArrowRight, MapPin, Route, TriangleAlert } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';

export default function Network() {
  const { data, loading, error, reload } = useApi(api.getScenario, []);
  const [selectedKey, setSelectedKey] = useState('');
  const selected = data?.routes?.find((route) => `${route.source}|${route.destination}` === selectedKey) || null;
  const selectedSource = selected && data.blood_banks.find((bank) => bank.id === selected.source);
  const selectedDestination = selected && data.hospitals.find((hospital) => hospital.id === selected.destination);
  return <>
    <PageHeader eyebrow="TRANSPORT NETWORK" title="Network" description="Select a route to inspect its scenario travel time, distance, cost, and status." />
    {loading && <LoadingState label="Loading route network…" />}
    {!loading && error && <ErrorState message={error} onRetry={reload} />}
    {!loading && !error && data && data.synthetic === true && <>
      <div className="network-vertical-flow">
        <section className="network-layer"><div className="network-layer-heading"><span className="layer-index">01</span><div><h2>Blood banks</h2><p>Shipment sources in the scenario</p></div><span className="count-pill">{data.blood_banks.length} sources</span></div><div className="network-bank-grid">{data.blood_banks.map((bank) => <div className="network-bank-card" key={bank.id}><span className="network-layer-avatar bank-avatar">B</span><span><strong>{bank.name}</strong><small><MapPin size={11} />{bank.location_id}</small></span></div>)}</div></section>
        <div className="flow-down"><span /><div><ArrowDown size={15} /> ROUTED THROUGH SCENARIO CONNECTIONS</div><span /></div>
        <section className="network-layer route-layer"><div className="network-layer-heading"><span className="layer-index">02</span><div><h2>Transport routes</h2><p>Choose a connection to see its route data</p></div><span className="count-pill"><Route size={13} />{data.routes.length} routes</span></div>
          {!data.routes.length ? <EmptyState title="No routes defined" detail="The scenario contains no bank-to-hospital route records." /> : <div className="selectable-route-grid">{data.routes.map((route) => {
            const key = `${route.source}|${route.destination}`;
            const source = data.blood_banks.find((item) => item.id === route.source);
            const destination = data.hospitals.find((item) => item.id === route.destination);
            const active = selectedKey ? selectedKey === key : false;
            return <button type="button" key={key} className={`selectable-route ${active ? 'selectable-route-active' : ''}`} aria-pressed={active} onClick={() => setSelectedKey(key)}>
              <span className="route-endpoints"><strong>{source?.name || route.source}</strong><ArrowRight size={14} /><strong>{destination?.name || route.destination}</strong></span><span className={`route-status route-${route.status}`}>{route.status === 'blocked' && <TriangleAlert size={12} />}{route.status}</span><small>{route.travel_time_minutes} min <i /> {route.distance_km} km</small>
            </button>;
          })}</div>}
        </section>
        {selected && <section className="panel selected-route-panel" aria-live="polite"><div className="selected-route-title"><div><span className="eyebrow">SELECTED CONNECTION</span><h2>{selectedSource?.name || selected.source} <ArrowRight size={17} /> {selectedDestination?.name || selected.destination}</h2><p>{selected.source} → {selected.destination}</p></div><span className={`route-status route-${selected.status}`}>{selected.status === 'blocked' && <TriangleAlert size={13} />}{selected.status}</span></div><div className="route-detail-metrics"><div><span>TRAVEL TIME</span><strong>{selected.travel_time_minutes} <small>minutes</small></strong></div><div><span>DISTANCE</span><strong>{selected.distance_km} <small>km</small></strong></div><div><span>TRANSPORT COST</span><strong>{selected.transport_cost} <small>scenario cost points</small></strong></div><div><span>ROUTE STATUS</span><strong className={`detail-status-text detail-${selected.status}`}>{selected.status}</strong></div></div></section>}
        <div className="flow-down flow-down-bottom"><span /><div><ArrowDown size={15} /> CONNECTIONS LEAD TO</div><span /></div>
        <section className="network-layer"><div className="network-layer-heading"><span className="layer-index">03</span><div><h2>Hospitals</h2><p>Demand destinations in the scenario</p></div><span className="count-pill">{data.hospitals.length} destinations</span></div><div className="network-bank-grid hospital-network-grid">{data.hospitals.map((hospital) => <div className="network-bank-card" key={hospital.id}><span className="network-layer-avatar hospital-avatar">H</span><span><strong>{hospital.name}</strong><small><MapPin size={11} />{hospital.location_id}</small></span></div>)}</div></section>
      </div>
      <p className="small-disclaimer"><ArrowDown size={13} /> Times, distances, and costs are scenario inputs—not live traffic, dispatch, or delivery forecasts. A blocked route is shown as supplied by the backend.</p>
    </>}
    {!loading && !error && data && data.synthetic !== true && <div className="notice notice-error">The backend did not identify this scenario as synthetic. Network information is not displayed.</div>}
  </>;
}
