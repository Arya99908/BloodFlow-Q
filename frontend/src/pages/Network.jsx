import { useMemo, useState } from 'react';
import { ArrowRight, Boxes, Droplet, Hospital, MapPin, Route as RouteIcon, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';
import { StatItem, StatusBadge } from '../components/DataField';

export default function Network() {
  const { data, loading, error, reload } = useApi(api.getScenario, []);
  const [selectedKey, setSelectedKey] = useState('');
  const [routeFilter, setRouteFilter] = useState('all'); // 'all' | 'available' | 'blocked'

  const routes = data?.routes || [];
  const banks = data?.blood_banks || [];
  const hospitals = data?.hospitals || [];

  const availableRoutes = useMemo(() => routes.filter((r) => r.status === 'available'), [routes]);
  const blockedRoutes = useMemo(() => routes.filter((r) => r.status === 'blocked'), [routes]);

  const filteredRoutes = useMemo(() => {
    if (routeFilter === 'available') return availableRoutes;
    if (routeFilter === 'blocked') return blockedRoutes;
    return routes;
  }, [routes, availableRoutes, blockedRoutes, routeFilter]);

  const selected = useMemo(() => {
    if (!selectedKey && routes.length > 0) return routes[0];
    return routes.find((r) => `${r.source}|${r.destination}` === selectedKey) || null;
  }, [routes, selectedKey]);

  const selectedSource = useMemo(() => {
    return selected ? banks.find((b) => b.id === selected.source) : null;
  }, [selected, banks]);

  const selectedDestination = useMemo(() => {
    return selected ? hospitals.find((h) => h.id === selected.destination) : null;
  }, [selected, hospitals]);

  return (
    <>
      <PageHeader
        eyebrow="SUPPLY & DISTRIBUTION NETWORK"
        title="Transport Network"
        description="Inspect supply sources, hospital demand destinations, and inter-facility transport route constraints."
      />

      {loading && <LoadingState label="Loading logistics network model…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && data.synthetic === true && (
        <div className="network-page-flow">
          {/* Top Network Summary KPI Strip */}
          <section className="network-kpi-grid" aria-label="Network high-level metrics">
            <StatItem label="Supply sources" value={banks.length} unit="blood banks" />
            <StatItem label="Destinations" value={hospitals.length} unit="hospitals" />
            <StatItem label="Active routes" value={availableRoutes.length} unit="available" tone="success" />
            <StatItem
              label="Blocked routes"
              value={blockedRoutes.length}
              unit={blockedRoutes.length === 1 ? 'disruption' : 'disruptions'}
              tone={blockedRoutes.length > 0 ? 'warning' : 'default'}
            />
          </section>

          {/* Side-by-side facility columns: Sources and Destinations */}
          <div className="network-facilities-grid">
            {/* Supply Sources */}
            <section className="panel facility-column-panel">
              <div className="panel-heading">
                <div>
                  <h2>Blood banks</h2>
                  <p>Regional supply facilities holding inventory</p>
                </div>
                <span className="count-pill">
                  <Boxes size={13} /> {banks.length} sources
                </span>
              </div>
              <div className="facility-card-list">
                {banks.map((bank) => {
                  const totalUnits = Object.values(bank.inventory || {}).reduce((sum, u) => sum + Number(u || 0), 0);
                  const groupsCount = Object.keys(bank.inventory || {}).length;
                  return (
                    <article className="facility-card facility-bank-card" key={bank.id}>
                      <div className="facility-card-header">
                        <span className="facility-avatar bank-avatar">
                          <Droplet size={15} />
                        </span>
                        <div className="facility-title-wrap">
                          <strong className="facility-name">{bank.name}</strong>
                          <span className="facility-location">
                            <MapPin size={11} aria-hidden="true" />
                            <span>Location: {bank.location_id}</span>
                            <code className="facility-id-code">{bank.id}</code>
                          </span>
                        </div>
                      </div>
                      <div className="facility-meta-pills">
                        <span className="meta-subline">
                          Total stock: <strong>{totalUnits.toLocaleString()} units</strong>
                        </span>
                        <span className="meta-subline">
                          Groups: <strong>{groupsCount}</strong>
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* Demand Destinations */}
            <section className="panel facility-column-panel">
              <div className="panel-heading">
                <div>
                  <h2>Hospitals</h2>
                  <p>Clinical destinations requesting blood units</p>
                </div>
                <span className="count-pill">
                  <Hospital size={13} /> {hospitals.length} destinations
                </span>
              </div>
              <div className="facility-card-list">
                {hospitals.map((hospital) => {
                  const totalDemand = Object.values(hospital.demand || {}).reduce((sum, u) => sum + Number(u || 0), 0);
                  const hasCritical = Object.values(hospital.urgency || {}).some(
                    (u) => u?.category === 'critical' || u?.category === 'high'
                  );
                  return (
                    <article className="facility-card facility-hospital-card" key={hospital.id}>
                      <div className="facility-card-header">
                        <span className="facility-avatar hospital-avatar">
                          <Hospital size={15} />
                        </span>
                        <div className="facility-title-wrap">
                          <strong className="facility-name">{hospital.name}</strong>
                          <span className="facility-location">
                            <MapPin size={11} aria-hidden="true" />
                            <span>Location: {hospital.location_id}</span>
                            <code className="facility-id-code">{hospital.id}</code>
                          </span>
                        </div>
                      </div>
                      <div className="facility-meta-pills">
                        <span className="meta-subline">
                          Total demand: <strong>{totalDemand.toLocaleString()} units</strong>
                        </span>
                        {hasCritical && (
                          <span className="critical-demand-pill">
                            <AlertTriangle size={11} /> High / Critical
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Transport Routes Grid & Inspector */}
          <section className="panel routes-section-panel">
            <div className="panel-heading">
              <div>
                <h2>Transport connections</h2>
                <p>Click any route to inspect its transit constraints and connected nodes</p>
              </div>
              <div className="route-filter-controls" role="group" aria-label="Route status filter">
                <button
                  type="button"
                  className={`filter-btn ${routeFilter === 'all' ? 'filter-btn-active' : ''}`}
                  onClick={() => setRouteFilter('all')}
                >
                  All ({routes.length})
                </button>
                <button
                  type="button"
                  className={`filter-btn ${routeFilter === 'available' ? 'filter-btn-active' : ''}`}
                  onClick={() => setRouteFilter('available')}
                >
                  Available ({availableRoutes.length})
                </button>
                <button
                  type="button"
                  className={`filter-btn ${routeFilter === 'blocked' ? 'filter-btn-active' : ''}`}
                  onClick={() => setRouteFilter('blocked')}
                >
                  Blocked ({blockedRoutes.length})
                </button>
              </div>
            </div>

            {filteredRoutes.length === 0 ? (
              <EmptyState
                title="No routes match this filter"
                detail="Switch filter to view all scenario routes."
              />
            ) : (
              <div className="network-routes-grid" role="listbox" aria-label="Selectable transport routes">
                {filteredRoutes.map((route) => {
                  const key = `${route.source}|${route.destination}`;
                  const source = banks.find((item) => item.id === route.source);
                  const destination = hospitals.find((item) => item.id === route.destination);
                  const isSelected = selected && `${selected.source}|${selected.destination}` === key;
                  const isBlocked = route.status === 'blocked';

                  return (
                    <button
                      type="button"
                      key={key}
                      className={`route-card-item ${isSelected ? 'route-card-selected' : ''} ${
                        isBlocked ? 'route-card-blocked' : ''
                      }`}
                      onClick={() => setSelectedKey(key)}
                      aria-selected={isSelected}
                    >
                      <div className="route-card-header">
                        <div className="route-endpoints-flow">
                          <span className="endpoint-name origin-name">{source?.name || route.source}</span>
                          <ArrowRight size={13} className="endpoint-arrow" aria-hidden="true" />
                          <span className="endpoint-name destination-name">{destination?.name || route.destination}</span>
                        </div>
                        <StatusBadge
                          status={route.status}
                          label={isBlocked ? 'Blocked' : 'Available'}
                        />
                      </div>

                      <div className="route-metrics-strip">
                        <div className="route-metric-entry">
                          <span className="entry-label">TIME</span>
                          <strong className="entry-value">{route.travel_time_minutes} min</strong>
                        </div>
                        <span className="entry-divider" />
                        <div className="route-metric-entry">
                          <span className="entry-label">DISTANCE</span>
                          <strong className="entry-value">{route.distance_km} km</strong>
                        </div>
                        <span className="entry-divider" />
                        <div className="route-metric-entry">
                          <span className="entry-label">COST</span>
                          <strong className="entry-value">{route.transport_cost} pts</strong>
                        </div>
                      </div>

                      {isBlocked && (
                        <div className="route-blocked-alert" role="note">
                          <AlertTriangle size={12} />
                          <span>Marked blocked in this scenario</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Selected Route Inspector Panel */}
          {selected && (
            <section className="panel selected-route-inspector" aria-live="polite">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">ROUTE INSPECTOR</span>
                  <h2>
                    {selectedSource?.name || selected.source} <ArrowRight size={16} /> {selectedDestination?.name || selected.destination}
                  </h2>
                  <p className="route-path-subtitle">
                    Identifier path: <code>{selected.source}</code> → <code>{selected.destination}</code>
                  </p>
                </div>
                <StatusBadge
                  status={selected.status}
                  label={selected.status === 'blocked' ? 'Route Disrupted / Blocked' : 'Route Fully Operational'}
                />
              </div>

              <div className="route-inspector-metrics">
                <StatItem label="Transit duration" value={selected.travel_time_minutes} unit="minutes" />
                <StatItem label="Road distance" value={selected.distance_km} unit="km" />
                <StatItem label="Transport cost" value={selected.transport_cost} unit="objective points" />
                <StatItem
                  label="Scenario availability"
                  value={selected.status === 'blocked' ? 'Blocked' : 'Available'}
                  tone={selected.status === 'blocked' ? 'danger' : 'success'}
                  hint={selected.status === 'blocked' ? 'Zero shipment capacity permitted' : 'Eligible for shipment'}
                />
              </div>

              <div className="inspector-nodes-split">
                <div className="node-detail-card">
                  <div className="node-detail-head">
                    <Droplet size={14} className="icon-red" />
                    <strong>Origin Blood Bank</strong>
                  </div>
                  <div className="node-detail-body">
                    <p className="node-name">{selectedSource?.name || selected.source}</p>
                    <p className="node-meta">Location: <code>{selectedSource?.location_id || '—'}</code></p>
                    <div className="node-sub-info">
                      <span>Available inventory:</span>
                      <strong>
                        {Object.values(selectedSource?.inventory || {}).reduce((s, v) => s + Number(v || 0), 0)} units
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="node-detail-card">
                  <div className="node-detail-head">
                    <Hospital size={14} className="icon-blue" />
                    <strong>Destination Hospital</strong>
                  </div>
                  <div className="node-detail-body">
                    <p className="node-name">{selectedDestination?.name || selected.destination}</p>
                    <p className="node-meta">Location: <code>{selectedDestination?.location_id || '—'}</code></p>
                    <div className="node-sub-info">
                      <span>Total requested demand:</span>
                      <strong>
                        {Object.values(selectedDestination?.demand || {}).reduce((s, v) => s + Number(v || 0), 0)} units
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <p className="small-disclaimer">
            Route travel times, distances, and unit costs represent fixed parameters within this synthetic scenario.
            Blocked routes are isolated and cannot be assigned shipments by any compliant optimizer.
          </p>
        </div>
      )}

      {!loading && !error && data && data.synthetic !== true && (
        <div className="notice notice-error">
          The backend did not identify this scenario as synthetic. Network information is not displayed.
        </div>
      )}
    </>
  );
}
