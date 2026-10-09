import { useMemo } from 'react';
import { Boxes, Droplet, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import InventoryBar from '../components/InventoryBar';
import PageHeader from '../components/PageHeader';
import { StatItem } from '../components/DataField';

export default function BloodBanks() {
  const { data, loading, error, reload } = useApi(api.getScenario, []);
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
          <div className="table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}>
            <table className="data-table bank-table">
              <thead>
                <tr>
                  <th scope="col">Blood bank</th>
                  <th scope="col">ID</th>
                  {groups.map((group) => <th scope="col" key={group} className="num-cell">{group}</th>)}
                  <th scope="col" className="num-cell">Total inventory</th>
                </tr>
              </thead>
              <tbody>
                {banks.map((bank) => {
                  const total = groups.reduce((sum, group) => sum + (bank.inventory?.[group] || 0), 0);
                  return (
                    <tr key={bank.id}>
                      <td>
                        <div className="table-primary">
                          <span className="table-avatar bank-avatar"><Droplet size={15} /></span>
                          <div className="table-cell-meta">
                            <strong className="table-cell-title">{bank.name}</strong>
                            <span className="table-subline"><MapPin size={11} /> {bank.location_id}</span>
                          </div>
                        </div>
                      </td>
                      <td><code className="id-tag">{bank.id}</code></td>
                      {groups.map((group) => (
                        <td key={group} className="num-cell">
                          <InventoryBar value={bank.inventory?.[group] ?? 0} maximum={maxima[group]} />
                        </td>
                      ))}
                      <td className="num-cell">
                        <strong className="total-quantity">{total.toLocaleString()}</strong> <small className="unit-label">units</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
