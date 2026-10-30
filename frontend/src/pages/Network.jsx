import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Focus, Minus, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';
import { StatusBadge } from '../components/DataField';
import { buildNetwork, DEFAULT_NETWORK_FILTERS, filterNetwork, fitNetwork, GRAPH_SIZE, latestNetworkAllocation, quantityTotal, routeKey, zoomNetwork, validateNetworkAllocation } from '../utils/networkGraph';
import './Network.css';
import './network-enhancements.css';
import AllocationSankey from '../components/AllocationSankey';

const format = value => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'Not recorded';
const edgeLabel = edge => `${edge.sourceNode.name || edge.source} → ${edge.destinationNode.name || edge.destination}`;
const edgeDetails = edge => `${edgeLabel(edge)} · ${edge.status || 'status not recorded'} · ${format(edge.travel_time_minutes)} min · ${format(edge.distance_km)} km · ${format(edge.transport_cost)} cost points/unit`;
const activate = action => event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } };

export default function Network({ inspection = null, onClearInspection }) {
  const loadedScenario = useApi(api.getScenario, []);
  const scenario = inspection ? { ...loadedScenario, data: inspection.scenario, loading: false, error: null } : loadedScenario;
  const history = useApi(api.getResults, []);
  const [filters, setFilters] = useState(DEFAULT_NETWORK_FILTERS);
  const [selection, setSelection] = useState(null);
  const [after, setAfter] = useState(false);
  const [animateFlows, setAnimateFlows] = useState(false);
  const [hover, setHover] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const svg = useRef(null);
  const drag = useRef(null);
  const graph = useMemo(() => buildNetwork(scenario.data), [scenario.data]);
  const proposal = useMemo(() => inspection ? validateNetworkAllocation(inspection.scenario, inspection.result) : latestNetworkAllocation(scenario.data, history.data?.results), [inspection, scenario.data, history.data]);
  const visible = useMemo(() => filterNetwork(graph, filters, selection, proposal?.totals), [graph, filters, selection, proposal]);
  const node = selection?.kind === 'node' ? graph.nodes.find(item => item.key === selection.key) : null;
  const edge = selection?.kind === 'edge' ? graph.edges.find(item => item.key === selection.key) : null;
  const selectedVisible = !selection || (node ? visible.nodes.some(item => item.key === node.key) : edge ? visible.edges.some(item => item.key === edge.key) : false);
  const nodeSignature = graph.nodes.map(item => item.key).join('|');
  useEffect(() => { setView(fitNetwork(graph.nodes)); setHover(null); }, [nodeSignature]);
  useEffect(() => {
    if (selection && !(selection.kind === 'node' ? graph.nodes : graph.edges).some(item => item.key === selection.key)) {
      setSelection(null); setFilters(current => ({ ...current, neighbors: false }));
    }
  }, [graph, selection]);
  useEffect(() => { setHover(null); }, [graph]);
  useEffect(() => { if (!proposal) setFilters(current => current.allocatedOnly ? { ...current, allocatedOnly: false } : current); }, [proposal]);
  const updateFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setHover(null); };
  const choose = (kind, key) => { setSelection({ kind, key }); if (kind !== 'node') updateFilter('neighbors', false); };
  const reset = () => { setAfter(false); setAnimateFlows(false); setFilters(DEFAULT_NETWORK_FILTERS); setSelection(null); setHover(null); setView(fitNetwork(graph.nodes)); };
  const point = event => new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.current.getScreenCTM().inverse());
  const startPan = event => {
    if (event.button !== 0 || event.target.closest('[data-network-item]')) return;
    const p = point(event); drag.current = { pointerId: event.pointerId, p, view };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePan = event => { if (drag.current?.pointerId === event.pointerId) { const p = point(event); setView({ ...drag.current.view, x: drag.current.view.x + p.x - drag.current.p.x, y: drag.current.view.y + p.y - drag.current.p.y }); } };
  const stopPan = () => { drag.current = null; };
  const keyboardView = event => {
    if (event.key === 'Escape') { setSelection(null); updateFilter('neighbors', false); return; }
    if (event.target !== event.currentTarget) return;
    const shifts = { ArrowLeft: [35, 0], ArrowRight: [-35, 0], ArrowUp: [0, 35], ArrowDown: [0, -35] };
    if (shifts[event.key]) { event.preventDefault(); setView(current => ({ ...current, x: current.x + shifts[event.key][0], y: current.y + shifts[event.key][1] })); }
    if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); setView(current => zoomNetwork(current, event.key === '-' ? 1 / 1.2 : 1.2)); }
    if (event.key === 'Home') { event.preventDefault(); setView(fitNetwork(visible.nodes)); }
  };
  const displayedQuantity = item => after && proposal ? Object.entries(item.quantities).reduce((sum, [group, amount]) => sum + amount - ((item.kind === 'bank' ? proposal.used : proposal.served)[routeKey(item.id, group)] || 0), 0) : quantityTotal(item.quantities);
  const critical = item => item.kind === 'hospital' && Object.entries(item.quantities).some(([group, amount]) => amount > 0 && ['critical','high'].includes(item.urgency?.[group]?.category));
  const maxDemand = Math.max(1, ...graph.nodes.filter(item => item.kind === 'hospital').map(item => quantityTotal(item.quantities)));
  const maxStock = Math.max(1, ...graph.nodes.filter(item => item.kind === 'bank').map(item => quantityTotal(item.quantities)));
  const groups = [...new Set(graph.nodes.flatMap(item => Object.keys(item.quantities)))].sort();
  const neighbors = node ? graph.edges.filter(item => item.sourceNode.key === node.key || item.destinationNode.key === node.key) : [];

  return <div className="network-explorer">
    <PageHeader eyebrow="SUPPLY & DISTRIBUTION NETWORK" title="Transport Network" description="Explore actual scenario inventory, demand and transport connections. Select a facility or route to inspect its constraints." action={<button className="button button-secondary" onClick={() => { scenario.reload(); history.reload(); }} disabled={scenario.loading || history.loading}><RefreshCw size={14} /> Refresh data</button>} />
    {inspection && <section className="panel nx-snapshot-banner"><div><strong>Emergency scenario snapshot</strong><p>This is the affected scenario and its re-optimized allocation, passed from the emergency report. Refreshing session data does not replace this snapshot.</p></div><button className="button button-secondary" onClick={onClearInspection}>Return to default network</button><a className="button button-secondary" href="/reports">Inspect research evidence</a></section>}
    {scenario.loading && <LoadingState label="Loading network scenario…" />}
    {!scenario.loading && scenario.error && <ErrorState message={scenario.error} onRetry={scenario.reload} />}
    {!scenario.loading && !scenario.error && scenario.data?.synthetic !== true && <EmptyState title="Synthetic scenario unavailable" detail="The API must explicitly identify this scenario as synthetic before it can be explored." />}
    {!scenario.loading && !scenario.error && scenario.data?.synthetic === true && <>
      <div className="nx-summary"><span><strong>{graph.nodes.filter(item => item.kind === 'bank').length}</strong> blood banks</span><span><strong>{graph.nodes.filter(item => item.kind === 'hospital').length}</strong> hospitals</span><span><strong>{graph.edges.filter(item => item.status === 'available').length}</strong> available routes</span><span><strong>{graph.edges.filter(item => item.status === 'blocked').length}</strong> blocked routes</span><span>Scenario <code>{scenario.data.id}</code></span></div>
      {graph.warnings.length > 0 && <div className="notice notice-error" role="alert">{graph.warnings.join(' ')}</div>}
      <section className="panel nx-toolbar" aria-label="Network filters">
        <label className="nx-search"><span><Search size={14} /> Search facilities</span><input className="field-control" type="search" placeholder="Name, ID, location or blood group" value={filters.query} onChange={event => updateFilter('query', event.target.value)} /></label>
        <label><span>Facility type</span><select className="field-control" value={filters.category} onChange={event => updateFilter('category', event.target.value)}><option value="all">All facilities</option><option value="bank">Blood banks</option><option value="hospital">Hospitals</option></select></label>
        <label><span>Route status</span><select className="field-control" value={filters.status} onChange={event => updateFilter('status', event.target.value)}><option value="all">All routes</option><option value="available">Available</option><option value="blocked">Blocked</option></select></label>
        <label><span>Positive stock / demand</span><select className="field-control" value={filters.bloodGroup} onChange={event => updateFilter('bloodGroup', event.target.value)}><option value="all">All blood groups</option>{groups.map(group => <option key={group}>{group}</option>)}</select></label>
        <button className="button button-secondary" onClick={reset}><RotateCcw size={14} /> Reset all</button>
        <div className="nx-filter-toggles"><label><input type="checkbox" checked={filters.neighbors} disabled={!node} onChange={event => updateFilter('neighbors', event.target.checked)} /> Selected facility and direct neighbors</label><label><input type="checkbox" checked={filters.allocatedOnly} disabled={!proposal} onChange={event => updateFilter('allocatedOnly', event.target.checked)} /> Routes with proposed shipments</label></div>
      </section>
      <section className="nx-comparison-controls" aria-label="Allocation comparison"><div role="group" aria-label="Network state"><button className="button button-secondary" aria-pressed={!after} onClick={() => setAfter(false)}>Before allocation</button><button className="button button-secondary" aria-pressed={after} disabled={!proposal} onClick={() => setAfter(true)}>After proposed allocation</button></div><label><input type="checkbox" checked={animateFlows} disabled={!proposal} onChange={e => setAnimateFlows(e.target.checked)} /> Animate proposed flows</label><p>{after && proposal ? 'Remaining bank stock and hospital unmet demand after the validated proposal.' : 'Starting inventory and requested demand. Allocation is a proposal, not a completed delivery.'}</p></section>
      <div className="nx-workspace">
        <section className="panel nx-map-panel" aria-label="Interactive logistics graph">
          <div className="nx-map-top"><p role="status" aria-live="polite"><strong>{visible.nodes.length}/{graph.nodes.length}</strong> facilities · <strong>{visible.edges.length}/{graph.edges.length}</strong> routes visible</p><div className="nx-view-tools"><button className="button button-secondary button-small" aria-label="Zoom out" disabled={view.scale <= 0.1} onClick={() => setView(current => zoomNetwork(current, 1 / 1.2))}><Minus size={16} /></button><output aria-label="Zoom level">{Math.round(view.scale * 100)}%</output><button className="button button-secondary button-small" aria-label="Zoom in" disabled={view.scale >= 4} onClick={() => setView(current => zoomNetwork(current, 1.2))}><Plus size={16} /></button><button className="button button-secondary button-small" disabled={!visible.nodes.length} onClick={() => setView(fitNetwork(visible.nodes))}><Focus size={14} /> Fit visible</button></div></div>
          <p id="nx-instructions" className="nx-help">Drag empty space to pan. Use zoom buttons, or focus the canvas and use + / −, arrows and Home. Tab to a facility or route; Enter selects, Escape clears. Positions are schematic, not a geographic map.</p>
          <div className="nx-canvas-wrap">
            <svg ref={svg} className={`nx-canvas ${animateFlows ? 'nx-animate-flows' : ''}`} viewBox={`0 0 ${GRAPH_SIZE.width} ${GRAPH_SIZE.height}`} role="group" aria-label="Supply and demand graph" aria-describedby="nx-instructions" tabIndex={0} onKeyDown={keyboardView} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onLostPointerCapture={stopPan}>
              <defs><pattern id="nx-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="currentColor" /></pattern></defs>
              <rect width="900" height="520" className="nx-grid" fill="url(#nx-grid)" />
              <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                {visible.edges.map(item => { const selected = edge?.key === item.key; const amount = proposal?.totals[item.key] || 0; const d = `M ${item.sourceNode.x + 110} ${item.sourceNode.y} C 430 ${item.sourceNode.y}, 470 ${item.destinationNode.y}, ${item.destinationNode.x - 110} ${item.destinationNode.y}`; return <g data-network-item="edge" key={item.key} role="button" tabIndex={0} aria-label={`${edgeDetails(item)}${proposal ? ` · ${amount} proposed units` : ''}`} aria-pressed={selected} className={`nx-edge ${item.status === 'blocked' ? 'nx-edge-blocked' : ''} ${amount > 0 ? 'nx-edge-allocated' : ''} ${selected ? 'nx-selected' : ''}`} onClick={() => choose('edge', item.key)} onKeyDown={activate(() => choose('edge', item.key))} onPointerEnter={() => setHover({ kind: 'edge', item })} onPointerLeave={() => setHover(null)} onFocus={() => setHover({ kind: 'edge', item })} onBlur={() => setHover(null)}><title>{edgeDetails(item)}</title><path className="nx-edge-hit" d={d} /><path className="nx-edge-line" d={d} />{amount > 0 && <text className="nx-edge-quantity" x="450" y={(item.sourceNode.y + item.destinationNode.y) / 2 - 5}>{amount} units</text>}</g>; })}
                {visible.nodes.map(item => <g data-network-item="node" key={item.key} transform={`translate(${item.x} ${item.y})`} role="button" tabIndex={0} aria-label={`${item.name || item.id}, ${item.kind === 'bank' ? after && proposal ? 'remaining inventory' : 'blood bank inventory' : after && proposal ? 'unmet demand' : 'hospital demand'} ${displayedQuantity(item)} units`} aria-pressed={node?.key === item.key} className={`nx-node nx-node-${item.kind} ${displayedQuantity(item) === 0 ? 'nx-zero' : ''} ${critical(item) ? 'nx-critical' : ''} ${node?.key === item.key ? 'nx-selected' : ''}`} onClick={() => choose('node', item.key)} onKeyDown={activate(() => choose('node', item.key))} onPointerEnter={() => setHover({ kind: 'node', item })} onPointerLeave={() => setHover(null)} onFocus={() => setHover({ kind: 'node', item })} onBlur={() => setHover(null)}><title>{item.name || item.id} · {item.id} · {item.location_id || 'Location not recorded'} · {displayedQuantity(item)} {after && proposal ? 'remaining' : 'initial'} units</title><rect x="-110" y="-37" width="220" height="74" rx="12" /><circle cx="-90" cy="-14" r="5" /><text x="-77" y="-10" className="nx-node-name">{(item.name || item.id).length > 22 ? `${(item.name || item.id).slice(0, 21)}…` : item.name || item.id}</text><text x="-90" y="15" className="nx-node-meta">{item.kind === 'bank' ? after && proposal ? 'Remaining' : 'Stock' : after && proposal ? 'Unmet' : 'Demand'} · {format(displayedQuantity(item))} units</text>{<rect className={item.kind === 'hospital' ? 'nx-demand-indicator' : 'nx-stock-indicator'} x="-90" y="27" width={180 * displayedQuantity(item) / (item.kind === 'hospital' ? maxDemand : maxStock)} height="4" rx="2" />}{critical(item) && <text className="nx-urgency-marker" x="92" y="-14" aria-label="Critical or high urgency">!</text>}</g>)}
              </g>
            </svg>
            {!visible.nodes.length && <div className="nx-no-matches"><EmptyState title="No facilities match" detail="Reset filters or choose another facility type, route status or blood group." /><button className="button button-secondary" onClick={reset}>Reset filters and view</button></div>}
          </div>
          <div className="nx-hover" role="status">{hover ? hover.kind === 'edge' ? edgeDetails(hover.item) : `${hover.item.name || hover.item.id} · ${hover.item.id} · ${hover.item.location_id || 'No location recorded'} · ${format(displayedQuantity(hover.item))} ${hover.item.kind === 'bank' ? after && proposal ? 'remaining stock' : 'stock' : after && proposal ? 'unmet demand' : 'demand'} units` : 'Hover or focus a facility or route for a quick readout; select it for full details.'}</div>
          <div className="nx-legend" aria-label="Graph legend"><span><i className="nx-bank-dot" /> Blood bank</span><span><i className="nx-hospital-dot" /> Hospital</span><span><i className="nx-route-line" /> Available</span><span><i className="nx-blocked-line" /> Blocked</span><span><i className="nx-allocated-line" /> Proposed allocation · ribbon labels in units</span><span>! Critical / high demand</span><span>Bars = displayed units; shared scale within facility type</span></div>
        </section>
        <aside className="panel nx-inspector" aria-label="Selection details">
          <span className="eyebrow">NETWORK INSPECTOR</span>
          {!selection && <EmptyState title="Select a facility or route" detail="Inspect stock, demand, compatibility and the actual route parameters. Use the graph or the accessible lists below." />}
          {selection && !selectedVisible && <p className="nx-filtered-note" role="status">This selection is hidden by the current filters. <button onClick={() => setFilters(DEFAULT_NETWORK_FILTERS)}>Clear filters</button></p>}
          {node && <><h2>{node.name || node.id}</h2><p><code>{node.id}</code> · {node.kind === 'bank' ? 'Blood bank' : 'Hospital'}</p><p>Location: {node.location_id || 'Not recorded'}</p><h3>{node.kind === 'bank' ? after && proposal ? 'Remaining inventory' : 'Available inventory' : after && proposal ? 'Remaining unmet demand' : 'Requested demand'}</h3><table className="data-table"><thead><tr><th>Group</th><th>Units</th>{node.kind === 'hospital' && <th>Urgency</th>}</tr></thead><tbody>{Object.entries(node.quantities).map(([group, amount]) => <tr key={group}><th>{group}</th><td>{format(after && proposal ? amount - ((node.kind === 'bank' ? proposal.used : proposal.served)[routeKey(node.id, group)] || 0) : amount)}</td>{node.kind === 'hospital' && <td>{node.urgency?.[group]?.category || 'Not recorded'}</td>}</tr>)}</tbody></table><h3>{neighbors.length} connected routes</h3><div className="nx-neighbors">{neighbors.map(item => <button className="button button-secondary button-small" key={item.key} onClick={() => choose('edge', item.key)}>{node.kind === 'bank' ? item.destinationNode.name || item.destination : item.sourceNode.name || item.source} <ArrowRight size={12} /><span>{item.status}</span></button>)}</div><button className="button button-secondary" onClick={() => setFilters({ ...DEFAULT_NETWORK_FILTERS, neighbors: true })}>Explore direct neighbors</button></>}
          {edge && <><h2>{edgeLabel(edge)}</h2><StatusBadge status={edge.status} /><dl><dt>Travel time</dt><dd>{format(edge.travel_time_minutes)} min</dd><dt>Distance</dt><dd>{format(edge.distance_km)} km</dd><dt>Transport cost</dt><dd>{format(edge.transport_cost)} points per unit</dd><dt>Shipment capacity</dt><dd>{edge.status === 'blocked' ? 'Blocked: no shipments allowed' : 'Limited by source inventory and destination demand; no route-specific capacity is modeled.'}</dd><dt>Proposed shipments</dt><dd>{proposal ? `${format(proposal.totals[edge.key] || 0)} units` : 'No matching validated proposal loaded'}</dd></dl><h3>Compatible groups with stock and demand</h3><p className="nx-help">Eligibility only; group quantities share inventory and do not sum to an independent route capacity.</p><ul className="nx-compatibility">{(Array.isArray(scenario.data.compatibility) ? scenario.data.compatibility : []).filter(item => item?.allowed && edge.sourceNode.quantities[item.donor_group] > 0 && edge.destinationNode.quantities[item.recipient_group] > 0).map(item => <li key={`${item.donor_group}-${item.recipient_group}`}>{item.donor_group} → {item.recipient_group}{edge.status === 'blocked' ? ' · route blocked' : ''}</li>)}</ul><div className="nx-neighbors"><button className="button button-secondary" onClick={() => choose('node', edge.sourceNode.key)}>Inspect source</button><button className="button button-secondary" onClick={() => choose('node', edge.destinationNode.key)}>Inspect destination</button></div></>}
        </aside>
      </div>
      <section className="panel nx-proposal"><h2>Allocation overlay</h2>{history.loading ? <p role="status">Loading session results…</p> : history.error ? <p role="status">Session results unavailable: {history.error} <button className="button button-secondary button-small" onClick={history.reload}>Retry results</button></p> : proposal ? <p>{inspection ? 'Showing the emergency report’s' : 'Showing a saved'} <strong>{proposal.method}</strong> proposal{!inspection && <> from {proposal.createdAt || 'an unrecorded time'}</>}. Its scenario ID matches, the backend marked it feasible, and this view rechecked stock, demand accounting, compatibility and available routes against the displayed scenario. Colored routes are proposed shipments, not dispatches or finalized deliveries.</p> : <p>No saved feasible optimization matches this scenario and passes the current allocation checks. <a href="/optimization">Run an optimization</a>, then refresh data. A missing proposal is not a zero-allocation result.</p>}</section>
      {proposal && <section className="panel nx-flow-panel"><AllocationSankey scenario={scenario.data} result={proposal.result} /></section>}
      <details className="panel nx-accessible-list"><summary>Explore visible facilities and routes as a list</summary><div className="nx-list-grid"><div><h3>Facilities</h3>{visible.nodes.map(item => <button key={item.key} className="button button-secondary" aria-pressed={node?.key === item.key} onClick={() => choose('node', item.key)}>{item.name || item.id} · {item.kind} · {format(quantityTotal(item.quantities))} units</button>)}</div><div><h3>Routes</h3>{visible.edges.map(item => <button key={item.key} className="button button-secondary" aria-pressed={edge?.key === item.key} onClick={() => choose('edge', item.key)}>{edgeDetails(item)}</button>)}</div></div></details>
      <p className="nx-help">Blood-group filters show positive stock and demand for the selected group; they do not imply cross-group compatibility. The selected route inspector lists compatibility from the scenario. Synthetic data only.</p>
    </>}
  </div>;
}
