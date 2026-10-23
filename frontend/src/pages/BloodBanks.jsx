import { useMemo, useState } from 'react';
import { Boxes, Droplet, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import InventoryBar from '../components/InventoryBar';
import PageHeader from '../components/PageHeader';
import { StatItem } from '../components/DataField';
import BorderGlow from '../components/BorderGlow';
import SwipeRow from '../components/SwipeRow';

export default function BloodBanks() {
  const { data, loading, error, reload } = useApi(api.getScenario, []);
  const [copiedBank, setCopiedBank] = useState('');
  const groups = data?.blood_groups || [];
  const banks = data?.blood_banks || [];
  const maxima = useMemo(() => Object.fromEntries(groups.map((group) => [
    group, Math.max(0, ...banks.map((bank) => bank.inventory?.[group] || 0)),
  ])), [groups.join('|'), banks]);

  const totalInventory = useMemo(() => banks.reduce((sum, bank) => (
    sum + Object.values(bank.inventory || {}).reduce((sub, u) => sub + Number(u || 0), 0)
  ), 0), [banks]);

  return <>
    <PageHeader eyebrow="SUPPLY NETWORK" title="Blood banks" description="Inventory by source, loaded directly from the active synthetic scenario." />
    {loading && <LoadingState label="Loading blood-bank inventory…" />}
    {!loading && error && <ErrorState message={error} onRetry={reload} />}
    {!loading && !error && data && data.synthetic === true && <>
      <div className="hospitals-kpi-strip">
        <StatItem label="Blood banks" value={banks.length} />
        <StatItem label="Total inventory" value={totalInventory} unit="units" />
        <StatItem label="Supplied groups" value={groups.length} />
        <StatItem label="Average stock / bank" value={banks.length ? Math.round(totalInventory / banks.length) : 0} unit="units" />
      </div>

      <div className="status-strip">
        <span className="status-live">
          <i className="pulse-dot" aria-hidden="true" />
          <span>API connected</span>
        </span>
        <span className="strip-divider" aria-hidden="true" />
        <span className="status-strip-item">
          <span>Sources:</span>
          <strong>{banks.length} blood bank{banks.length === 1 ? '' : 's'}</strong>
        </span>
        <span className="strip-divider" aria-hidden="true" />
        <span className="status-strip-item">
          <span>Groups supplied by backend:</span>
          <strong>{groups.join(', ')}</strong>
        </span>
      </div>

      {['O-', 'O+', 'A+', 'B+'].some((group) => !groups.includes(group)) && (
        <div className="notice notice-info">
          <Droplet size={17} /> This API scenario currently supplies {groups.join(', ')} labels. Rh-negative or Rh-positive inventory such as O−, O+, A+, or B+ is not provided, so this page does not infer or rename those values.
        </div>
      )}

      {banks.length === 0 ? (
        <EmptyState title="No blood banks in this scenario" detail="The backend returned an empty source list." />
      ) : (
        <section className="panel table-panel">
          <div className="panel-heading">
            <div>
              <h2>Inventory by blood bank</h2>
              <p>Bars are scaled relative to the highest returned quantity in each group.</p>
            </div>
            <span className="count-pill"><Boxes size={14} /> {banks.length} banks</span>
          </div>
          <div className="blood-bank-cards" aria-label="Blood bank inventory cards">
            {banks.map((bank) => {
              const total = groups.reduce((sum, group) => sum + (bank.inventory?.[group] || 0), 0);
              return <SwipeRow key={bank.id} className="blood-bank-swipe-row" label={`Blood bank ${bank.name}`} height={138} radius={15} actionWidth={86} actions={[{id:'copy-id',label:copiedBank === bank.id ? 'Copied' : 'Copy ID',color:'#ef233c'}]} actionColor="#ef233c" drawerColor="#2b2d42" rowColor="var(--bg-surface)" textColor="var(--text-primary)" haptic={false} onAction={() => { navigator.clipboard?.writeText(bank.id); setCopiedBank(bank.id); window.setTimeout(() => setCopiedBank(''), 1800); }}>
                <BorderGlow className="blood-bank-glow" backgroundColor="var(--bg-surface)" borderRadius={15} glowRadius={14} glowColor="350 82 62" colors={['#ef233c', '#8d99ae', '#2b2d42']}>
                <article className="blood-bank-card">
                  <div className="blood-bank-identity"><span className="table-avatar bank-avatar"><Droplet size={17} /></span><div><strong>{bank.name}</strong><span><MapPin size={12}/> Location {bank.location_id || 'not reported'}</span><code>{bank.id}</code></div></div>
                  <div className="blood-bank-inventory">{groups.map((group) => <div className="blood-bank-group" key={group}><span>{group}</span><InventoryBar value={bank.inventory?.[group] ?? 0} maximum={maxima[group]} /></div>)}</div>
                  <div className="blood-bank-total"><strong>{total.toLocaleString()}</strong><span>units in stock</span></div>
                </article>
                </BorderGlow>
              </SwipeRow>;
            })}
          </div>
          <div className="table-legend">
            <span><i className="legend-swatch bar-high" /> Higher relative stock</span>
            <span><i className="legend-swatch bar-medium" /> Mid-range</span>
            <span><i className="legend-swatch bar-low" /> Lower relative stock</span>
            <span className="legend-note">Relative only · no clinical threshold</span>
          </div>
        </section>
      )}
      <div className="prototype-note">
        <Droplet size={15} />
        <span>Synthetic inventory values are supplied by the backend; group compatibility is a simplified operational assumption.</span>
      </div>
    </>}
    {!loading && !error && data && data.synthetic !== true && (
      <div className="notice notice-error">The backend did not identify this scenario as synthetic. Inventory is not displayed.</div>
    )}
  </>;
}
