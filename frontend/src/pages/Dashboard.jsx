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
import DemandAllocationChart from '../components/DemandAllocationChart';
import MagicBento from '../components/MagicBento';
import BorderGlow from '../components/BorderGlow';
import SpecularButton from '../components/SpecularButton';
import TextType from '../components/TextType';
import DotField from '../components/DotField';
import Orb from '../components/Orb';
import ClickSpark from '../components/ClickSpark';
import HospitalDataShelf from '../components/HospitalDataShelf';

function summarize(scenario, savedResults) {
  const banks = scenario.blood_banks || [];
  const hospitals = scenario.hospitals || [];
  const demand = hospitals.flatMap((hospital) => Object.entries(hospital.demand || {}).map(([group, units]) => ({
    group, units, urgency: hospital.urgency?.[group]?.category || 'unknown',
  })));
  const totalDemand = demand.reduce((sum, item) => sum + item.units, 0);
  const latestRun = [...savedResults].reverse().find((entry) => ['/optimize', '/simulate-emergency'].includes(entry.endpoint));
  const latestPayload = latestRun?.result || null;
  const latestMetrics = latestRun?.endpoint === '/simulate-emergency' ? latestPayload?.after_metrics : null;
  const currentUnmet = latestMetrics?.total_unmet_demand ?? latestPayload?.total_unmet_demand ?? null;
  const runStatus = latestPayload?.status || (latestPayload ? (latestMetrics?.feasibility === false ? 'infeasible' : 'completed') : 'not_run');
  const satisfactionRate = currentUnmet != null && totalDemand > 0
    ? Math.max(0, Math.round(((totalDemand - currentUnmet) / totalDemand) * 100))
    : null;
  return {
    banks: banks.length,
    hospitals: hospitals.length,
    totalInventory: banks.reduce((sum, bank) => sum + Object.values(bank.inventory || {}).reduce((subtotal, units) => subtotal + units, 0), 0),
    totalDemand,
    criticalDemand: demand.filter((item) => ['critical', 'high'].includes(item.urgency)).reduce((sum, item) => sum + item.units, 0),
    currentUnmet,
    satisfactionRate,
    runStatus,
    latestRun,
    latestAllocation: latestRun?.endpoint === '/simulate-emergency'
      ? latestPayload?.after_allocation
      : latestPayload?.allocation,
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

export default function Dashboard({ onNavigate, onOptimization, theme = 'light' }) {
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
    <PageHeader eyebrow="BLOODFLOW-Q / RESEARCH NETWORK" title="Operations overview" description="A live view of the synthetic allocation network and recent optimization activity."
      action={<ClickSpark className="dashboard-run-spark" style={{width:'auto',height:'auto'}} sparkColor="#ef233c" sparkCount={8}><SpecularButton size="md" radius={11} tint="#2b2d42" tintOpacity={0.08} textColor="#fff" lineColor="#ff8e9c" baseColor="#d90429" glow={0.6} className="dashboard-run-button" onClick={handleRun}><Play size={15} fill="currentColor" /> Run optimization</SpecularButton></ClickSpark>} />
    <section className="dashboard-capability-hero" aria-label="BloodFlow-Q capabilities">
      <div className="hero-background-effects" aria-hidden="true"><DotField dotRadius={1.1} dotSpacing={22} gradientFrom="#ef233c" gradientTo="#8d99ae" glowColor="#edf2f4" glowIntensity={0.25} baseOpacity={0.22} waveAmplitude={3} sparkle interactive={false} intro={false} className="hero-dot-field" /><Orb colors={['#ef233c','#8d99ae','#2b2d42']} backgroundColor="#000000" size={0.72} glow={0.6} opacity={0.38} speed={0.35} followCursor={false} clickPulse={false} intro={false} className="hero-orb" /></div>
      <div className="dashboard-capability-copy"><span className="eyebrow">NETWORK DECISION SUPPORT · SYNTHETIC RESEARCH</span><TextType as="h2" text="Model the network. Re-plan when conditions change." typingSpeed={22} loop={false} showCursor={false} typeEffect="fade" startOnVisible /><p>Investigate allocation strategies across simulated blood banks, hospitals, supply, demand and routes. Compare classical and quantum-assisted methods, then test resilience under disruption.</p><div className="dashboard-hero-actions"><button className="button button-primary" onClick={() => onNavigate('emergency')}><Siren size={15} /> Simulate disruption</button><button className="button button-secondary" onClick={() => onNavigate('quantum-lab')}>Explore Quantum Lab <ArrowUpRight size={15} /></button></div></div>
      <div className="dashboard-capability-list">
        <div className="dashboard-network-art" aria-hidden="true">
          <div className="dashboard-network-caption"><span className="network-live-indicator" /> SYNTHETIC NETWORK <span>MODEL PREVIEW</span></div>
          <svg viewBox="0 0 420 176" role="presentation">
            <defs><linearGradient id="flow-line" x1="0" x2="1"><stop offset="0" stopColor="#fb7185" /><stop offset="1" stopColor="#38bdf8" /></linearGradient><radialGradient id="node-glow"><stop stopColor="#fb7185" stopOpacity=".55" /><stop offset="1" stopColor="#fb7185" stopOpacity="0" /></radialGradient></defs>
            <path className="network-route route-a" d="M58 48 C140 48 128 126 206 126 S285 48 362 48" /><path className="network-route route-b" d="M58 126 C126 126 140 48 206 48 S286 126 362 126" /><path className="network-route route-c" d="M58 48 C155 48 162 86 210 86 S287 126 362 126" />
            <circle className="network-node-halo" cx="58" cy="48" r="27" /><circle className="network-node-halo" cx="58" cy="126" r="27" />
            <circle className="network-node-dot network-supply" cx="58" cy="48" r="7" /><circle className="network-node-dot network-supply" cx="58" cy="126" r="7" />
            <circle className="network-hub" cx="210" cy="86" r="22" /><path className="network-hub-mark" d="M210 75v22m-11-11h22" />
            <circle className="network-node-dot network-demand" cx="362" cy="48" r="7" /><circle className="network-node-dot network-demand" cx="362" cy="126" r="7" />
            <text x="58" y="23" textAnchor="middle">SUPPLY</text><text x="210" y="151" textAnchor="middle">ALLOCATION ENGINE</text><text x="362" y="23" textAnchor="middle">HOSPITALS</text>
          </svg>
          <div className="dashboard-network-legend"><span><i className="legend-supply" /> Blood banks</span><span><i className="legend-demand-dot" /> Demand nodes</span><span><i className="legend-route" /> Route pathways</span></div>
        </div>
        <button onClick={() => onNavigate('network')}><span>01</span><strong>Network intelligence</strong><small>Supply · demand · routes</small><ArrowUpRight size={15} /></button><button onClick={() => onNavigate('optimization')}><span>02</span><strong>Allocation optimization</strong><small>Compare methods and validate</small><ArrowUpRight size={15} /></button><button onClick={() => onNavigate('emergency')}><span>03</span><strong>Emergency resilience</strong><small>Disrupt · re-optimize · review</small><ArrowUpRight size={15} /></button></div>
    </section>
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
        <section className="metric-grid dashboard-metrics" aria-label="Scenario metrics">
          <MetricCard icon={Droplets} label="Blood banks" value={summary.banks} detail="Connected supply sources" tone="red" />
          <MetricCard icon={Hospital} label="Hospitals" value={summary.hospitals} detail="Demand locations" tone="blue" />
          <MetricCard icon={Boxes} label="Total inventory" value={summary.totalInventory.toLocaleString()} detail="Synthetic units across banks" tone="teal" />
          <MetricCard icon={Building2} label="Total demand" value={summary.totalDemand.toLocaleString()} detail="Units requested in this scenario" tone="violet" />
          <MetricCard icon={TriangleAlert} label="Critical / high priority" value={summary.criticalDemand.toLocaleString()} detail="Demand with high or critical urgency" tone="amber" />
          <MetricCard
            icon={CircleHelp}
            label="Current unmet demand"
            value={summary.currentUnmet == null ? '—' : `${summary.currentUnmet.toLocaleString()} units`}
            detail={summary.currentUnmet == null
              ? 'Run optimization to calculate'
              : `${summary.totalDemand - summary.currentUnmet} of ${summary.totalDemand} units fulfilled (${summary.satisfactionRate}%)`}
            tone={summary.currentUnmet == null ? 'slate' : summary.currentUnmet === 0 ? 'emerald' : 'amber'}
          />
          <MetricCard
            icon={Activity}
            label="Optimization status"
            value={formatStatusLabel(summary.runStatus)}
            detail={summary.latestRun ? `Latest method: ${formatMethodLabel(summary.latestRun.result?.method)}` : 'Waiting for first run'}
            tone="blue"
          />
        </section>
        <section className="home-bento-section" aria-label="Research workspace shortcuts"><div className="home-bento-heading"><div><span className="eyebrow">WORKSPACE SHORTCUTS</span><h2>Move from network context to action</h2></div></div><MagicBento theme={theme} columns={3} rowHeight={142} gap={12} radius={15} glowColor="#ef233c" enableStars={false} enableTilt disableAnimations={false} intro={false} items={[
          { id:'allocation', label:'OPTIMIZATION', title:'Compare allocation methods', description:'Run Greedy, MILP, Exact, or QAOA against the active scenario.', icon:<SettingsIcon/>, onClick:()=>onNavigate('optimization'), colSpan:1 },
          { id:'resilience', label:'RESILIENCE', title:'Test a disruption', description:'Change synthetic demand, supply, priorities, or transport routes.', icon:<Siren size={17}/>, onClick:()=>onNavigate('emergency'), colSpan:1 },
          { id:'network-map', label:'TRANSPORT NETWORK', title:'Inspect the network', description:'Explore supply sources, demand destinations, and connecting routes.', icon:<Truck size={17}/>, onClick:()=>onNavigate('network'), colSpan:1 }
        ]}/></section>
        <HospitalDataShelf hospitals={data.scenario.hospitals || []} theme={theme} onOpen={()=>onNavigate('hospitals')} />
        <DemandAllocationChart scenario={data.scenario} allocation={summary.latestAllocation} onNavigate={onNavigate} />
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
          <BorderGlow
            className="dashboard-latest-glow"
            backgroundColor="var(--bg-surface)"
            borderRadius={16}
            glowRadius={14}
            glowColor="350 82 62"
            colors={['#ef233c', '#8d99ae', '#2b2d42']}
          >
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
                  <MetaRow label="Unmet demand" value={summary.currentUnmet == null ? 'Not reported' : `${summary.currentUnmet} units`} />
                  {summary.satisfactionRate != null && <MetaRow label="Fulfillment rate" value={`${summary.satisfactionRate}%`} tone={summary.satisfactionRate === 100 ? 'success' : 'default'} />}
                  <MetaRow label="Feasibility status" value={summary.runStatus === 'infeasible' ? 'Infeasible candidate' : summary.runStatus === 'not_run' ? 'Not run' : 'Feasible candidate'} tone={summary.runStatus === 'infeasible' ? 'danger' : 'success'} />
                </div>
                <button className="text-button" onClick={() => onNavigate('results')}>View results <ArrowUpRight size={15} /></button>
              </> : <EmptyState title="No optimization recorded" detail="Run the allocator to see its measured result here. No sample values are shown." />}
            </section>
          </BorderGlow>
        </div>
        <div className="prototype-note"><CircleHelp size={16} /><span>Research prototype using synthetic scenario data. This dashboard is for logistics experimentation and does not support clinical decisions.</span></div>
      </>}
    </>}
  </>;
}

function SettingsIcon() { return <Activity size={17}/>; }
