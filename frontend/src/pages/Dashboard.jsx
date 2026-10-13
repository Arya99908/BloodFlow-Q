import { useMemo } from 'react';
import { Activity, ArrowUpRight, Boxes, Building2, CircleHelp, Clock3, Droplets, Hospital, Play, TriangleAlert, UserRoundPlus, Siren, ClipboardCheck, Truck } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import LoadingState, { EmptyState, ErrorState } from '../components/Feedback';
import MetricCard from '../components/MetricCard';
import NetworkOverview from '../components/NetworkOverview';
import PageHeader from '../components/PageHeader';
import { MetaRow } from '../components/DataField';
import { getDashboardMetrics } from '../services/donorNetwork';

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

function formatStatusLabel(status) {
  if (!status || status === 'not_run') return 'Not run';
  const clean = String(status).replaceAll('_', ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function formatMethodLabel(method) {
  if (!method) return 'Not reported';
  return String(method).toUpperCase();
}

export default function Dashboard({ onNavigate, onOptimization }) {
  const { data, loading, error, reload } = useApi(async () => {
    const [scenario, health, resultSet, coordination] = await Promise.all([
      api.getScenario(), api.getHealth(), api.getResults(),
      api.getDonorNetworkDashboard().catch((issue) => ({
        available: false,
        message: `Coordination service is unavailable: ${issue.message}`,
        metrics: {},
      })),
    ]);
    let coordinationMetrics = coordination;
    const hasPrivateConfig = Boolean(
      import.meta.env.VITE_SUPABASE_URL?.trim()
      && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
    );
    if (hasPrivateConfig) {
      try {
        // Keep the authentication SDK out of the first dashboard bundle.
        const { supabase } = await import('../services/supabase');
        const { data: authData, error: authError } = await supabase.auth.getSession();
        if (!authError && authData.session) {
          coordinationMetrics = {
            available: true,
            message: '',
            metrics: await getDashboardMetrics(supabase),
          };
        } else {
          coordinationMetrics = {
            available: false,
            message: 'Sign in with an authorized platform-administrator account to view private coordination counts.',
            metrics: {},
          };
        }
      } catch {
        coordinationMetrics = {
          available: false,
          message: 'Counts require an authorized platform-administrator account.',
          metrics: {},
        };
      }
    }
    return { scenario, health, results: resultSet.results || [], coordination: coordinationMetrics };
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
        <div className="status-strip">
          <span className="status-live">
            <i className="pulse-dot" aria-hidden="true" />
            <span>API connected</span>
          </span>
          <span className="strip-divider" aria-hidden="true" />
          <span className="status-strip-item">
            <span>Scenario:</span>
            <strong>{data.scenario.id}</strong>
          </span>
          <span className="strip-divider" aria-hidden="true" />
          <span className="status-strip-item">
            <span>Data source:</span>
            <strong>Backend API</strong>
          </span>
          <button
            className="icon-button status-strip-refresh"
            aria-label="Refresh dashboard data"
            title="Refresh dashboard data"
            onClick={reload}
          >
            <Activity size={15} />
          </button>
        </div>
        <section className="metric-grid" aria-label="Scenario metrics">
          <MetricCard icon={Droplets} label="Blood banks" value={summary.banks} detail="Connected supply sources" tone="red" />
          <MetricCard icon={Hospital} label="Hospitals" value={summary.hospitals} detail="Demand locations" tone="blue" />
          <MetricCard icon={Boxes} label="Total inventory" value={summary.totalInventory.toLocaleString()} detail="Synthetic units across banks" tone="teal" />
          <MetricCard icon={Building2} label="Total demand" value={summary.totalDemand.toLocaleString()} detail="Units requested in this scenario" tone="violet" />
          <MetricCard icon={TriangleAlert} label="Critical / high priority" value={summary.criticalDemand.toLocaleString()} detail="Demand with high or critical urgency" tone="amber" />
          <MetricCard icon={CircleHelp} label="Current unmet demand" value={summary.currentUnmet == null ? '—' : summary.currentUnmet.toLocaleString()} detail={summary.currentUnmet == null ? 'Run optimization to calculate' : 'From the latest saved optimization'} tone="slate" />
          <MetricCard
            icon={Activity}
            label="Optimization status"
            value={formatStatusLabel(summary.runStatus)}
            detail={summary.latestRun ? `Latest method: ${formatMethodLabel(summary.latestRun.result?.method)}` : 'Waiting for first run'}
            tone="blue"
          />
        </section>
        <section className="donor-dashboard-section" aria-labelledby="donor-dashboard-title">
          <div className="donor-dashboard-heading"><div><span className="eyebrow">DONOR COORDINATION</span><h2 id="donor-dashboard-title">Donor network activity</h2><p>Private counts are shown only in an authenticated platform-administrator session. Synthetic coordination walkthroughs are available in Donor Network.</p></div><button type="button" className="button button-secondary button-small" onClick={() => onNavigate('donor-network')}>Open Donor Network <ArrowUpRight size={14} /></button></div>
          <div className="metric-grid coordination-dashboard-grid" aria-label="Donor coordination metrics">
            {[
              [UserRoundPlus, 'Registered donors', 'registered_donors'],
              [UserRoundPlus, 'Available donors', 'available_registered_donors'],
              [Siren, 'Active requests', 'active_emergency_requests'],
              [CircleHelp, 'Awaiting donor responses', 'requests_awaiting_donor_responses'],
              [ClipboardCheck, 'Collection appointments', 'collection_appointments'],
              [Boxes, 'Fulfilled from verified stock', 'fulfilled_from_verified_stock'],
              [Truck, 'Awaiting bank confirmation', 'awaiting_blood_bank_confirmation'],
            ].map(([Icon, label, key]) => {
              const value = data.coordination?.metrics?.[key];
              return <MetricCard key={key} icon={Icon} label={label} value={value == null ? 'Unavailable' : value.toLocaleString()} detail={value == null ? (data.coordination?.message || 'Live database not configured') : 'Live authorized records'} tone="slate" />;
            })}
          </div>
        </section>
        <div className="dashboard-columns">
          <NetworkOverview scenario={data.scenario} />
          <section className="panel latest-panel">
            <div className="panel-heading"><div><h2>Latest optimization</h2><p>Most recent run recorded by this API process</p></div><Clock3 size={17} className="muted-icon" /></div>
            {summary.latestRun ? <>
              <div className={`run-status status-${summary.runStatus}`}>
                <span className="status-indicator" />
                {formatStatusLabel(summary.runStatus)}
              </div>
              <div className="latest-method">{summary.latestRun.endpoint === '/simulate-emergency' ? 'Emergency re-optimization' : 'Allocation optimization'}</div>
              <div className="latest-meta-list">
                <MetaRow label="Method" value={summary.latestRun.result?.method?.toUpperCase() || 'Not reported'} />
                <MetaRow label="Unmet demand" value={summary.currentUnmet == null ? 'Not reported' : summary.currentUnmet} unit={summary.currentUnmet != null ? 'units' : ''} />
                <MetaRow label="Feasibility status" value={summary.runStatus === 'infeasible' ? 'Infeasible candidate' : summary.runStatus === 'not_run' ? 'Not run' : 'Feasible candidate'} tone={summary.runStatus === 'infeasible' ? 'danger' : 'success'} />
              </div>
              <button className="text-button" onClick={() => onNavigate('results')}>View results <ArrowUpRight size={15} /></button>
            </> : <EmptyState title="No optimization recorded" detail="Run the allocator to see its measured result here. No sample values are shown." />}
          </section>
        </div>
        <div className="prototype-note"><CircleHelp size={16} /><span>Research prototype using synthetic scenario data. This dashboard is for logistics experimentation and does not support clinical decisions.</span></div>
      </>}
    </>}
  </>;
}
