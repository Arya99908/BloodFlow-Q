import { useMemo } from 'react';
import { Activity, ArrowUpRight, Boxes, Building2, CircleHelp, Clock3, Droplets, Hospital, Play, TriangleAlert } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import LoadingState, { EmptyState, ErrorState } from '../components/Feedback';
import MetricCard from '../components/MetricCard';
import NetworkOverview from '../components/NetworkOverview';
import PageHeader from '../components/PageHeader';

function summarize(scenario, savedResults) {
  const banks = scenario.blood_banks || [];
  const hospitals = scenario.hospitals || [];
  const demand = hospitals.flatMap((hospital) => Object.entries(hospital.demand || {}).map(([group, units]) => ({
    group, units, urgency: hospital.urgency?.[group]?.category || 'unknown',
  })));
  const latestRun = [...savedResults].reverse().find((entry) => ['/optimize', '/simulate-emergency'].includes(entry.endpoint));
  const latestPayload = latestRun?.result || null;
  const latestMetrics = latestRun?.endpoint === '/simulate-emergency' ? latestPayload?.after_metrics : null;
  const currentUnmet = latestMetrics?.total_unmet_demand ?? latestPayload?.total_unmet_demand ?? null;
  const runStatus = latestPayload?.status || (latestPayload ? (latestMetrics?.feasibility === false ? 'infeasible' : 'completed') : 'not_run');
  return {
    banks: banks.length,
    hospitals: hospitals.length,
    totalInventory: banks.reduce((sum, bank) => sum + Object.values(bank.inventory || {}).reduce((subtotal, units) => subtotal + units, 0), 0),
    totalDemand: demand.reduce((sum, item) => sum + item.units, 0),
    criticalDemand: demand.filter((item) => ['critical', 'high'].includes(item.urgency)).reduce((sum, item) => sum + item.units, 0),
    currentUnmet,
    runStatus,
    latestRun,
  };
}

export default function Dashboard({ onNavigate, onOptimization }) {
  const { data, loading, error, reload } = useApi(async () => {
    const [scenario, health, resultSet] = await Promise.all([api.getScenario(), api.getHealth(), api.getResults()]);
    return { scenario, health, results: resultSet.results || [] };
  }, []);

  const summary = useMemo(() => data ? summarize(data.scenario, data.results) : null, [data]);
  const handleRun = async () => {
    onNavigate('optimization');
    await onOptimization();
  };

  return <>
    <PageHeader eyebrow="OVERVIEW" title="Dashboard" description="A live view of the synthetic allocation network and recent optimization activity."
      action={<button className="button button-primary" onClick={handleRun}><Play size={16} fill="currentColor" /> Run optimization</button>} />
    {loading && <LoadingState label="Connecting to the BloodFlow-Q API…" />}
    {!loading && error && <ErrorState message={error} onRetry={reload} />}
    {!loading && !error && data && <>
      {data.scenario.synthetic !== true && <div className="notice notice-error"><TriangleAlert size={17} /> The API scenario is not marked synthetic. Dashboard metrics are withheld.</div>}
      {data.scenario.synthetic === true && summary && <>
        <div className="status-strip"><span className="status-live"><i className="pulse-dot" /> API connected</span><span className="strip-divider" /><span>Scenario <strong>{data.scenario.id}</strong></span><span className="strip-divider" /><span>Data source <strong>Backend API</strong></span>
          <button className="icon-button" aria-label="Refresh dashboard data" title="Refresh" onClick={reload}><Activity size={16} /></button>
        </div>
        <section className="metric-grid" aria-label="Scenario metrics">
          <MetricCard icon={Droplets} label="Blood banks" value={summary.banks} detail="Connected supply sources" tone="red" />
          <MetricCard icon={Hospital} label="Hospitals" value={summary.hospitals} detail="Demand locations" tone="blue" />
          <MetricCard icon={Boxes} label="Total inventory" value={summary.totalInventory.toLocaleString()} detail="Synthetic units across banks" tone="teal" />
          <MetricCard icon={Building2} label="Total demand" value={summary.totalDemand.toLocaleString()} detail="Units requested in this scenario" tone="violet" />
          <MetricCard icon={TriangleAlert} label="Critical / high priority" value={summary.criticalDemand.toLocaleString()} detail="Demand with high or critical urgency" tone="amber" />
          <MetricCard icon={CircleHelp} label="Current unmet demand" value={summary.currentUnmet == null ? '—' : summary.currentUnmet.toLocaleString()} detail={summary.currentUnmet == null ? 'Run optimization to calculate' : 'From the latest saved optimization'} tone="slate" />
          <MetricCard icon={Activity} label="Optimization status" value={summary.runStatus === 'not_run' ? 'Not run' : summary.runStatus.replaceAll('_', ' ')} detail={summary.latestRun ? `Latest method: ${summary.latestRun.result?.method || 'not reported'}` : 'Waiting for first run'} tone="blue" />
        </section>
        <div className="dashboard-columns">
          <NetworkOverview scenario={data.scenario} />
          <section className="panel latest-panel">
            <div className="panel-heading"><div><h2>Latest optimization</h2><p>Most recent run recorded by this API process</p></div><Clock3 size={17} className="muted-icon" /></div>
            {summary.latestRun ? <>
              <div className={`run-status status-${summary.runStatus}`}><span className="status-indicator" />{summary.runStatus.replaceAll('_', ' ')}</div>
              <div className="latest-method">{summary.latestRun.endpoint === '/simulate-emergency' ? 'Emergency re-optimization' : 'Allocation optimization'}</div>
              <div className="latest-meta"><span>Method</span><strong>{summary.latestRun.endpoint === '/simulate-emergency' ? summary.latestRun.result?.method : summary.latestRun.result?.method}</strong></div>
              <div className="latest-meta"><span>Unmet demand</span><strong>{summary.currentUnmet == null ? 'Not reported' : `${summary.currentUnmet} units`}</strong></div>
              <div className="latest-meta"><span>Feasibility</span><strong>{summary.runStatus === 'infeasible' ? 'Infeasible sample' : summary.runStatus === 'not_run' ? 'Not run' : 'Feasibility checked'}</strong></div>
              <button className="text-button" onClick={() => onNavigate('results')}>View results <ArrowUpRight size={15} /></button>
            </> : <EmptyState title="No optimization recorded" detail="Run the allocator to see its measured result here. No sample values are shown." />}
          </section>
        </div>
        <div className="prototype-note"><CircleHelp size={16} /><span>Research prototype using synthetic scenario data. This dashboard is for logistics experimentation and does not support clinical decisions.</span></div>
      </>}
    </>}
  </>;
}
