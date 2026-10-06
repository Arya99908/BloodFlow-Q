import { useMemo } from 'react';
import { Boxes, Droplet, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import InventoryBar from '../components/InventoryBar';
import PageHeader from '../components/PageHeader';

export default function BloodBanks() {
  const { data, loading, error, reload } = useApi(api.getScenario, []);
  const groups = data?.blood_groups || [];
  const banks = data?.blood_banks || [];
  const maxima = useMemo(() => Object.fromEntries(groups.map((group) => [
    group, Math.max(0, ...banks.map((bank) => bank.inventory?.[group] || 0)),
  ])), [groups.join('|'), banks]);

  return <>
    <PageHeader eyebrow="SUPPLY NETWORK" title="Blood banks" description="Inventory by source, loaded directly from the active synthetic scenario." />
    {loading && <LoadingState label="Loading blood-bank inventory…" />}
    {!loading && error && <ErrorState message={error} onRetry={reload} />}
    {!loading && !error && data && data.synthetic === true && <>
      <div className="status-strip"><span className="status-live"><i className="pulse-dot" /> API data</span><span className="strip-divider" /><span>{banks.length} source{banks.length === 1 ? '' : 's'}</span><span className="strip-divider" /><span>Groups supplied by backend: <strong>{groups.join(', ')}</strong></span></div>
      {['O-', 'O+', 'A+', 'B+'].some((group) => !groups.includes(group)) && <div className="notice notice-info"><Droplet size={17} /> This API scenario currently supplies {groups.join(', ')} labels. Rh-negative or Rh-positive inventory such as O−, O+, A+, or B+ is not provided, so this page does not infer or rename those values.</div>}
      {banks.length === 0 ? <EmptyState title="No blood banks in this scenario" detail="The backend returned an empty source list." /> : <section className="panel table-panel">
        <div className="panel-heading"><div><h2>Inventory by blood bank</h2><p>Bars are scaled relative to the highest returned quantity in each group.</p></div><span className="count-pill"><Boxes size={14} /> {banks.length} banks</span></div>
        <div className="table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table className="data-table bank-table"><thead><tr><th scope="col">Blood bank</th><th scope="col">ID</th>{groups.map((group) => <th scope="col" key={group}>{group}</th>)}<th scope="col">Total inventory</th></tr></thead>
          <tbody>{banks.map((bank) => {
            const total = groups.reduce((sum, group) => sum + (bank.inventory?.[group] || 0), 0);
            return <tr key={bank.id}><td><div className="table-primary"><span className="table-avatar bank-avatar"><Droplet size={15} /></span><span>{bank.name}<small><MapPin size={11} />{bank.location_id}</small></span></div></td><td><code className="id-tag">{bank.id}</code></td>
              {groups.map((group) => <td key={group}><InventoryBar value={bank.inventory?.[group] ?? 0} maximum={maxima[group]} /></td>)}
              <td><strong className="total-quantity">{total.toLocaleString()} <small>units</small></strong></td></tr>;
          })}</tbody></table></div>
        <div className="table-legend"><span><i className="legend-swatch bar-high" /> Higher relative stock</span><span><i className="legend-swatch bar-medium" /> Mid-range</span><span><i className="legend-swatch bar-low" /> Lower relative stock</span><span className="legend-note">Relative only · no clinical threshold</span></div>
      </section>}
      <div className="prototype-note"><Droplet size={15} />Synthetic inventory values are supplied by the backend; group compatibility is a simplified operational assumption.</div>
    </>}
    {!loading && !error && data && data.synthetic !== true && <div className="notice notice-error">The backend did not identify this scenario as synthetic. Inventory is not displayed.</div>}
  </>;
}
