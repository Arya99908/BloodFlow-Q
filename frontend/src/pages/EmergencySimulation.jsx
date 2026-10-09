import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleDot, Siren, TriangleAlert } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import PageHeader from '../components/PageHeader';
import { StatItem, MetaRow, StatusBadge } from '../components/DataField';
import { calculateObjectiveUpperBound, countScenarioQubits, estimateCandidateStates } from '../utils/scenarioBounds';

const urgencyLabels = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const titleCase = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const totalDemand = (scenario) => (scenario?.hospitals || []).reduce((total, hospital) => total + Object.values(hospital.demand || {}).reduce((sum, units) => sum + Number(units || 0), 0), 0);

export default function EmergencySimulation() {
  const { data: scenario, loading, error, reload } = useApi(api.getScenario, []);
  const [kind, setKind] = useState('demand_spike');
  const [entity, setEntity] = useState('');
  const [routeKey, setRouteKey] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [quantity, setQuantity] = useState('');
  const [urgency, setUrgency] = useState('keep');
  const [priorityWeight, setPriorityWeight] = useState('');
  const [method, setMethod] = useState('greedy');
  const [inventoryPenalty, setInventoryPenalty] = useState('');
  const [demandPenalty, setDemandPenalty] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const entities = kind === 'inventory_reduction' ? scenario?.blood_banks || [] : scenario?.hospitals || [];
  const selectedEntity = entities.find((item) => item.id === entity);
  const routes = scenario?.routes || [];
  const selectedRoute = routes.find((route) => `${route.source}|${route.destination}` === routeKey) || routes[0];
  const groupOptions = Object.keys(kind === 'inventory_reduction' ? selectedEntity?.inventory || {} : selectedEntity?.demand || {});

  const candidateStates = useMemo(() => estimateCandidateStates(scenario), [scenario]);
  const isExactDisabled = candidateStates > 50000;
  const scenarioQubits = useMemo(() => countScenarioQubits(scenario), [scenario]);
  const isQaoaDisabled = scenarioQubits > 16;
  const objectiveBound = useMemo(() => calculateObjectiveUpperBound(scenario), [scenario]);
  const availableInventory = kind === 'inventory_reduction' ? Number(selectedEntity?.inventory?.[bloodGroup] ?? 0) : null;
  const isOverReduction = kind === 'inventory_reduction' && quantity !== '' && Number(quantity) > (availableInventory ?? 0);

  useEffect(() => {
    if (!entities.some((item) => item.id === entity)) setEntity(entities[0]?.id || '');
  }, [kind, scenario, entities, entity]);
  useEffect(() => {
    if (groupOptions.length && !groupOptions.includes(bloodGroup)) setBloodGroup(groupOptions[0]);
  }, [entity, kind, scenario, groupOptions, bloodGroup]);
  useEffect(() => {
    if (isExactDisabled && method === 'exact') setMethod('greedy');
  }, [isExactDisabled, method]);
  useEffect(() => {
    if (isQaoaDisabled && method === 'qaoa') setMethod('greedy');
  }, [isQaoaDisabled, method]);

  const submit = async (event) => {
    event.preventDefault(); setSubmitError(''); setResult(null); setSubmitting(true);
    let emergencyEvent;
    if (kind === 'demand_spike') {
      emergencyEvent = { kind, hospital_id: entity, blood_group: bloodGroup, new_demand: Number(quantity) };
      if (urgency !== 'keep') emergencyEvent.urgency = { category: urgency, priority_weight: Number(priorityWeight) };
    } else if (kind === 'inventory_reduction') emergencyEvent = { kind, bank_id: entity, blood_group: bloodGroup, units_to_remove: Number(quantity) };
    else if (kind === 'route_disruption') emergencyEvent = { kind, source: selectedRoute?.source, destination: selectedRoute?.destination };
    else emergencyEvent = { kind: 'hospital_priority_change', hospital_id: entity, blood_group: bloodGroup, urgency: { category: urgency, priority_weight: Number(priorityWeight) } };
    try {
      const request = { event: emergencyEvent, method };
      if (method === 'qaoa') {
        const inv = Number(inventoryPenalty);
        const dem = Number(demandPenalty);
        if (objectiveBound && (inv <= objectiveBound || dem <= objectiveBound)) {
          throw new Error(`QUBO penalty weights must strictly exceed this scenario's theoretical objective bound (> ${objectiveBound}). Please enter larger values (e.g. ${Math.ceil(objectiveBound * 1.5)}).`);
        }
        request.qaoa_penalties = { inventory_penalty_weight: inv, demand_penalty_weight: dem };
      }
      setResult(await api.simulateEmergency(request));
    }
    catch (issue) { setSubmitError(issue.message || 'Emergency simulation could not be completed.'); }
    finally { setSubmitting(false); }
  };

  const canSubmit = !submitting
    && !(method === 'exact' && isExactDisabled)
    && !(method === 'qaoa' && (isQaoaDisabled || !inventoryPenalty || !demandPenalty))
    && !(kind === 'route_disruption' && !selectedRoute)
    && !(kind !== 'route_disruption' && (!entity || !bloodGroup))
    && !(kind === 'hospital_priority_change' && !priorityWeight)
    && !(kind === 'demand_spike' && (quantity === '' || Number(quantity) < 0 || (urgency !== 'keep' && !priorityWeight)))
    && !(kind === 'inventory_reduction' && (quantity === '' || Number(quantity) < 0 || isOverReduction));

  return <>
    <PageHeader eyebrow="SCENARIO CHANGE" title="Emergency simulation" description="Change a synthetic scenario, re-optimize it, then inspect the returned before and after results." />
    {loading && <LoadingState label="Loading scenario for simulation…" />}
    {!loading && error && <ErrorState message={error} onRetry={reload} />}
    {!loading && !error && scenario?.synthetic === true && <>
      <WorkflowState stage={result ? 'complete' : submitting ? 'running' : 'ready'} />
      <div className="emergency-layout">
        <form className="panel form-panel" onSubmit={submit}>
          <div className="panel-heading"><div><h2>Configure an emergency event</h2><p>The backend applies this event to a copy of the active scenario.</p></div><Siren size={19} className="red-icon" /></div>
          <div className="form-stack">
            <label className="field-label" htmlFor="event-kind">Event type</label>
            <select id="event-kind" className="field-control" value={kind} onChange={(event) => { setKind(event.target.value); setResult(null); }}>
              <option value="demand_spike">Demand change</option><option value="inventory_reduction">Inventory reduction</option><option value="route_disruption">Route disruption</option><option value="hospital_priority_change">Hospital priority change</option>
            </select>
            {kind !== 'route_disruption' && <>
              <label className="field-label" htmlFor="event-entity">{kind === 'inventory_reduction' ? 'Blood bank' : 'Hospital'}</label>
              <select id="event-entity" className="field-control" value={entity} onChange={(event) => setEntity(event.target.value)}>{entities.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.id}</option>)}</select>
              <label className="field-label" htmlFor="event-group">Blood group</label><select id="event-group" className="field-control" value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value)}>{groupOptions.map((group) => <option key={group}>{group}</option>)}</select>
            </>}
            {kind === 'demand_spike' && <>
              <label className="field-label" htmlFor="new-demand">New total demand (units)</label><input id="new-demand" type="number" min="0" step="1" required className="field-control" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              <label className="field-label" htmlFor="new-urgency">Urgency update</label><select id="new-urgency" className="field-control" value={urgency} onChange={(event) => setUrgency(event.target.value)}><option value="keep">Keep current urgency</option>{Object.entries(urgencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
              {urgency !== 'keep' && <><label className="field-label" htmlFor="demand-priority-weight">Priority weight (scenario value)</label><input id="demand-priority-weight" type="number" min="0.0001" step="any" required className="field-control" value={priorityWeight} onChange={(event) => setPriorityWeight(event.target.value)} /></>}
            </>}
            {kind === 'inventory_reduction' && <>
              <label className="field-label" htmlFor="reduction">Units to remove</label>
              <input
                id="reduction"
                type="number"
                min="0"
                max={availableInventory != null ? availableInventory : undefined}
                step="1"
                required
                className="field-control"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
              <span className="table-subline">
                Available inventory at {selectedEntity?.name || entity} ({bloodGroup}): <strong>{availableInventory ?? 0} units</strong>
              </span>
              {isOverReduction && (
                <div className="inline-error" role="alert">
                  Cannot remove {quantity} units: exceeds available stock ({availableInventory} units).
                </div>
              )}
            </>}
            {kind === 'hospital_priority_change' && <><label className="field-label" htmlFor="priority">New urgency label</label><select id="priority" className="field-control" value={urgency === 'keep' ? 'critical' : urgency} onChange={(event) => setUrgency(event.target.value)}>{Object.entries(urgencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label className="field-label" htmlFor="priority-weight">Priority weight (scenario value)</label><input id="priority-weight" type="number" min="0.0001" step="any" required className="field-control" value={priorityWeight} onChange={(event) => setPriorityWeight(event.target.value)} /></>}
            {kind === 'route_disruption' && <><label className="field-label" htmlFor="route-choice">Route to disrupt</label><select id="route-choice" className="field-control" value={routeKey || (routes[0] ? `${routes[0].source}|${routes[0].destination}` : '')} onChange={(event) => setRouteKey(event.target.value)}>{routes.map((route) => <option key={`${route.source}-${route.destination}`} value={`${route.source}|${route.destination}`}>{scenario.blood_banks.find((item) => item.id === route.source)?.name || route.source} → {scenario.hospitals.find((item) => item.id === route.destination)?.name || route.destination} · {titleCase(route.status)}</option>)}</select><div className="notice notice-info"><TriangleAlert size={16} /><span>Route values and status come from the active scenario.</span></div></>}
            <label className="field-label" htmlFor="emergency-method">Re-optimization method</label>
            <select id="emergency-method" className="field-control" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="greedy">Greedy baseline</option>
              <option value="milp">MILP (HiGHS classical optimal)</option>
              <option value="exact" disabled={isExactDisabled}>
                {isExactDisabled ? 'Exact (tiny instances only — unavailable for this scenario)' : 'Exact (tiny instances only)'}
              </option>
              <option value="qaoa" disabled={isQaoaDisabled}>
                {isQaoaDisabled ? `QAOA (max 16 qubits — requires ${scenarioQubits} qubits)` : 'QAOA (when configured)'}
              </option>
            </select>
            {isExactDisabled && method === 'exact' && (
              <div className="notice notice-info" role="note">
                <TriangleAlert size={16} />
                <span>The Exact solver is restricted to tiny instances (max 50,000 candidate states). This full scenario exceeds that limit and cannot be evaluated exhaustively. Please select Greedy baseline.</span>
              </div>
            )}
            {method === 'qaoa' && <div className="qaoa-config-box">
              <div className="notice notice-info">
                <TriangleAlert size={16} />
                <span>Set explicit QUBO penalty weights. Both weights must strictly exceed this scenario’s objective bound (&gt; {objectiveBound != null ? objectiveBound : '—'}). Insufficient weights will be rejected.</span>
              </div>
              <label className="field-label" htmlFor="emergency-inventory-penalty">Inventory penalty weight (min &gt; {objectiveBound != null ? objectiveBound : '—'})</label>
              <input id="emergency-inventory-penalty" className="field-control" type="number" min={objectiveBound ? Number((objectiveBound + 0.1).toFixed(1)) : undefined} placeholder={objectiveBound ? `e.g. ${Math.ceil(objectiveBound * 1.5)}` : ''} step="any" required value={inventoryPenalty} onChange={(event) => setInventoryPenalty(event.target.value)} />
              <label className="field-label" htmlFor="emergency-demand-penalty">Demand penalty weight (min &gt; {objectiveBound != null ? objectiveBound : '—'})</label>
              <input id="emergency-demand-penalty" className="field-control" type="number" min={objectiveBound ? Number((objectiveBound + 0.1).toFixed(1)) : undefined} placeholder={objectiveBound ? `e.g. ${Math.ceil(objectiveBound * 1.5)}` : ''} step="any" required value={demandPenalty} onChange={(event) => setDemandPenalty(event.target.value)} />
            </div>}
            <button className="button button-danger button-wide emergency-run-button" type="submit" disabled={!canSubmit}><Siren size={16} />{submitting ? 'RE-OPTIMIZING…' : 'SIMULATE EMERGENCY'}</button>
          </div>
          {submitError && <div className="inline-error" role="alert">{submitError}</div>}
        </form>
        <section className="panel emergency-result-panel"><div className="panel-heading"><div><h2>Re-optimization report</h2><p>Scenario changes and metrics returned by the API.</p></div></div>
          {submitting && <LoadingState label="Emergency request sent. Waiting for the backend optimizer…" />}
          {!submitting && !result && !submitError && <EmptyState title="No emergency event simulated" detail="Choose an event and run the simulation to see its actual before and after results." />}
          {result && <EmergencyComparison report={result} />}
        </section>
      </div>
    </>}
    {!loading && !error && scenario && scenario.synthetic !== true && <div className="notice notice-error">The backend scenario is not marked synthetic. Emergency simulation is disabled.</div>}
  </>;
}

function WorkflowState({ stage }) {
  const steps = ['Normal state', 'Emergency event', 'Re-optimization', 'New allocation'];
  const active = stage === 'complete' ? 3 : stage === 'running' ? 2 : 0;
  return (
    <section className="panel emergency-workflow" aria-label="Emergency simulation workflow">
      <div className="workflow-steps-row">
        {steps.map((step, index) => (
          <Fragment key={step}>
            <div
              className={`emergency-workflow-step ${
                index < active ? 'step-done' : ''
              } ${index === active ? 'step-active' : ''}`}
            >
              <span className="workflow-step-icon">
                {index < active ? (
                  <CheckCircle2 size={15} />
                ) : index === active && stage === 'running' ? (
                  <CircleDot size={15} className="workflow-running-dot" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </span>
              <strong className="workflow-step-title">{step}</strong>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`workflow-arrow-connector ${
                  index < active ? 'arrow-done' : ''
                }`}
                aria-hidden="true"
              >
                <ArrowRight size={16} />
              </div>
            )}
          </Fragment>
        ))}
      </div>
      <p className="workflow-status-desc">
        {stage === 'running'
          ? 'The API request is running. Progress is not estimated; this step completes when the backend returns.'
          : stage === 'complete'
          ? 'The returned report includes the changed scenario, solver result, validation, and before/after metrics.'
          : 'Ready. The original scenario remains unchanged until you submit an event.'}
      </p>
    </section>
  );
}

function EmergencyComparison({ report }) {
  const beforeScenario = report.original_scenario; const afterScenario = report.modified_scenario;
  const before = report.before_metrics || {}; const after = report.after_metrics || {};
  const nameById = useMemo(() => Object.fromEntries([...(beforeScenario?.blood_banks || []), ...(beforeScenario?.hospitals || [])].map((item) => [item.id, item.name])), [beforeScenario]);
  const eventLines = describeEvent(report.emergency_event, nameById);
  const scenarioChanges = getScenarioChanges(beforeScenario, afterScenario, nameById);
  const bothFeasible = report.feasibility_status?.both_feasible;

  return <div className="comparison-content">
    <div className="emergency-status-bar">
      <StatusBadge
        tone={bothFeasible ? 'success' : 'danger'}
        label={bothFeasible ? 'Before and after allocations feasible' : 'At least one allocation is infeasible'}
      />
      <span className="emergency-method-pill">Re-optimization method: <strong>{titleCase(report.method)}</strong></span>
    </div>

    <section className="emergency-report-block">
      <div className="result-section-title">Emergency event · {titleCase(report.emergency_event?.kind || report.emergency_event?.type || 'event')}</div>
      <div className="emergency-event-meta-list">
        {eventLines.map((line) => (
          <MetaRow key={line.label} label={line.label} value={line.value} />
        ))}
      </div>
    </section>

    <section className="emergency-report-block">
      <div className="result-section-title">Changes applied to the scenario</div>
      {scenarioChanges.length ? (
        <div className="scenario-changes-list">
          {scenarioChanges.map((change) => (
            <div className="scenario-change-card" key={change.key}>
              <span className="scenario-change-label">{change.label}</span>
              <div className="scenario-change-values">
                <span className="change-value-before">{change.before}</span>
                <ArrowRight size={13} className="change-arrow" />
                <span className="change-value-after">{change.after}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted-copy">This event changed inventory or route availability. Hospital demand and urgency stayed the same in the returned scenario.</p>
      )}
    </section>

    <div className="emergency-demand-compare-card">
      <div className="compare-card-title">Scenario total demand</div>
      <div className="compare-values-grid">
        <StatItem label="Before event" value={formatNumber(totalDemand(beforeScenario))} unit="units" />
        <div className="compare-arrow-cell"><ArrowRight size={18} /></div>
        <StatItem
          label="After event"
          value={formatNumber(totalDemand(afterScenario))}
          unit="units"
          tone={totalDemand(afterScenario) > totalDemand(beforeScenario) ? 'warning' : 'default'}
        />
      </div>
    </div>

    <div className="emergency-metric-compare-panel">
      <div className="result-section-title">Key metric impacts</div>
      <div className="emergency-metric-grid">
        <div className="metric-compare-header">
          <span className="col-metric">Metric</span>
          <span className="col-val">Before</span>
          <span className="col-val">After</span>
        </div>
        <MetricCompareRow label="Unmet demand" before={before.total_unmet_demand} after={after.total_unmet_demand} suffix="units" />
        <MetricCompareRow label="Critical / high satisfaction" before={before.critical_satisfaction?.rate} after={after.critical_satisfaction?.rate} percent />
        <MetricCompareRow label="Transport cost" before={before.transport_cost} after={after.transport_cost} />
      </div>
    </div>

    <div className="result-section-title">Allocation changes</div>
    {report.allocation_changes?.length ? (
      <div className="table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}>
        <table className="data-table allocation-table emergency-change-table">
          <thead>
            <tr>
              <th>Blood bank</th>
              <th>Hospital</th>
              <th>Blood group</th>
              <th className="num-cell">Change</th>
            </tr>
          </thead>
          <tbody>
            {report.allocation_changes.map((item, index) => (
              <tr key={`${item.source}-${item.destination}-${item.blood_group}-${item.recipient_group}-${index}`}>
                <td>{nameById[item.source] || item.source}</td>
                <td>{nameById[item.destination] || item.destination}</td>
                <td>{item.blood_group}{item.recipient_group && item.recipient_group !== item.blood_group ? ` → ${item.recipient_group}` : ''}</td>
                <td className={`num-cell ${Number(item.quantity_change) > 0 ? 'quantity-increase' : Number(item.quantity_change) < 0 ? 'quantity-decrease' : ''}`}>
                  {Number(item.quantity_change) > 0 ? '+' : ''}{item.quantity_change} units
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="muted-copy">The backend reported no allocation quantity changes.</p>
    )}

    <div className="result-section-title">New allocation</div>
    {report.after_allocation?.length ? (
      <div className="table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}>
        <table className="data-table allocation-table">
          <thead>
            <tr>
              <th>Blood bank</th>
              <th>Hospital</th>
              <th>Product group</th>
              <th>Recipient group</th>
              <th className="num-cell">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {report.after_allocation.map((item, index) => (
              <tr key={`${item.source}-${item.destination}-${item.blood_group}-${index}`}>
                <td>{nameById[item.source] || item.source}</td>
                <td>{nameById[item.destination] || item.destination}</td>
                <td>{item.blood_group}</td>
                <td>{item.recipient_group}</td>
                <td className="num-cell"><strong>{item.quantity}</strong> units</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="muted-copy">The optimizer returned no shipments for the updated scenario.</p>
    )}
    <p className="small-disclaimer">This is an aggregate synthetic logistics scenario. It does not make decisions for individual patients.</p>
  </div>;
}

function MetricCompareRow({ label, before, after, suffix = '', percent = false }) {
  const show = (value) => value == null ? 'Not available' : percent ? `${(Number(value) * 100).toFixed(1)}%` : `${formatNumber(value)}${suffix ? ` ${suffix}` : ''}`;
  return (
    <div className="metric-compare-row">
      <span className="metric-name">{label}</span>
      <span className="metric-val before-val">{show(before)}</span>
      <span className="metric-val after-val">{show(after)}</span>
    </div>
  );
}

function describeEvent(event = {}, names = {}) {
  const values = [];
  const put = (label, value) => { if (value !== undefined && value !== null) values.push({ label, value: String(value) }); };
  put('Event type', titleCase(event.kind || event.type));
  if (event.hospital_id) put('Hospital', names[event.hospital_id] ? `${names[event.hospital_id]} (${event.hospital_id})` : event.hospital_id);
  if (event.bank_id) put('Blood bank', names[event.bank_id] ? `${names[event.bank_id]} (${event.bank_id})` : event.bank_id);
  if (event.source) put('Route', `${names[event.source] || event.source} → ${names[event.destination] || event.destination}`);
  put('Blood group', event.blood_group);
  if (event.new_demand !== undefined) put('Requested new demand', `${event.new_demand} units`);
  if (event.units_to_remove !== undefined) put('Inventory reduction', `${event.units_to_remove} units`);
  if (event.urgency) put('Requested urgency', `${titleCase(event.urgency.category)}${event.urgency.priority_weight == null ? '' : ` · priority weight ${event.urgency.priority_weight}`}`);
  return values;
}

function getScenarioChanges(before, after, names) {
  const changes = [];
  (after?.hospitals || []).forEach((hospital) => {
    const prior = (before?.hospitals || []).find((item) => item.id === hospital.id);
    Object.keys(hospital.demand || {}).forEach((group) => {
      const oldValue = prior?.demand?.[group]; const newValue = hospital.demand[group];
      if (oldValue !== newValue) changes.push({ key: `demand-${hospital.id}-${group}`, label: `${names[hospital.id] || hospital.id} · ${group} demand`, before: `${oldValue ?? 'Not set'} units`, after: `${newValue ?? 'Not set'} units` });
      const oldUrgency = prior?.urgency?.[group]; const newUrgency = hospital.urgency?.[group];
      if (oldUrgency?.category !== newUrgency?.category || oldUrgency?.priority_weight !== newUrgency?.priority_weight) {
        const text = (item) => item ? `${titleCase(item.category)}${item.priority_weight == null ? '' : ` · weight ${item.priority_weight}`}` : 'Not set';
        changes.push({ key: `urgency-${hospital.id}-${group}`, label: `${names[hospital.id] || hospital.id} · ${group} urgency`, before: text(oldUrgency), after: text(newUrgency) });
      }
    });
  });
  return changes;
}

function formatNumber(value) { return value == null ? 'Not available' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
