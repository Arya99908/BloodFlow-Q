import { ArrowUpRight, Info } from 'lucide-react';
import { Tooltip } from './Tooltip';

export default function DemandAllocationChart({ scenario, allocation, onNavigate }) {
  const rows = (scenario?.hospitals || []).map((hospital) => {
    const demand = Object.values(hospital.demand || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    const allocated = (allocation || []).filter((item) => item.destination === hospital.id).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return { id: hospital.id, name: hospital.name || hospital.id, demand, allocated, unmet: Math.max(0, demand - allocated) };
  });
  const max = Math.max(...rows.map((row) => row.demand), 0);

  return <section className="panel demand-allocation-panel" aria-labelledby="demand-allocation-title">
    <div className="panel-heading"><div><h2 id="demand-allocation-title">Supply allocated against modeled demand</h2><p>Backend allocation for the latest completed run · units by hospital</p></div><Tooltip label="Demand is summed from the selected synthetic scenario. Allocated units come from the latest backend allocation response; unmet is the remaining scenario demand, floored at zero. This chart is unavailable until a run is saved."><Info size={15} /></Tooltip></div>
    {Array.isArray(allocation) ? <>
      <div className="demand-chart-legend"><span><i className="legend-demand" /> Demand</span><span><i className="legend-allocated" /> Allocated</span><span><i className="legend-unmet" /> Unmet</span></div>
      <div className="demand-chart-rows">{rows.map((row) => <div className="demand-chart-row" key={row.id}>
        <div className="demand-chart-label"><strong>{row.name}</strong><small>{row.allocated} allocated · {row.unmet} unmet / {row.demand} demanded</small></div>
        <div className="demand-chart-track" role="img" aria-label={`${row.name}: ${row.allocated} allocated, ${row.unmet} unmet, ${row.demand} demanded`}>
          <span className="demand-bar" style={{ width: `${max ? (row.demand / max) * 100 : 0}%` }} />
          <span className="allocated-bar" style={{ width: `${max ? (Math.min(row.allocated, row.demand) / max) * 100 : 0}%` }} />
          {row.unmet > 0 && <span className="unmet-marker" style={{ left: `${max ? (Math.min(row.allocated, row.demand) / max) * 100 : 0}%` }} />}
        </div>
      </div>)}</div>
      <button className="text-button" onClick={() => onNavigate('results')}>Inspect solver outputs <ArrowUpRight size={14} /></button>
    </> : <p className="chart-unavailable">Run an optimization to show actual allocation quantities here. No illustrative values are substituted.</p>}
  </section>;
}
