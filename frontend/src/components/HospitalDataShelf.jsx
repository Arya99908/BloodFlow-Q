import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Hospital, MapPin } from 'lucide-react';
import CardSwap, { Card } from './CardSwap';
import BorderGlow from './BorderGlow';

const demandTotal = (hospital) => Object.values(hospital?.demand || {}).reduce((sum, value) => sum + Number(value || 0), 0);
const priorityCount = (hospital) => Object.values(hospital?.urgency || {}).filter((item) => ['high', 'critical'].includes(item?.category)).length;

export default function HospitalDataShelf({ hospitals = [], theme = 'light', onOpen }) {
  const swapRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const records = useMemo(() => hospitals.slice(0, 6), [hospitals]);
  if (!records.length) return null;

  return <BorderGlow className="hospital-shelf-glow" backgroundColor={theme === 'dark' ? '#202438' : '#ffffff'} borderRadius={18} glowRadius={20} glowColor="350 82 62" colors={['#ef233c', '#8d99ae', '#2b2d42']}>
    <section className="panel hospital-data-shelf" aria-labelledby="hospital-shelf-title">
      <div className="panel-heading"><div><span className="eyebrow">SCENARIO RECORDS</span><h2 id="hospital-shelf-title">Hospital data</h2><p>Swipe or drag through the hospitals in this synthetic scenario.</p></div><button className="text-button" onClick={onOpen}>All hospitals <ArrowRight size={14}/></button></div>
      <div className="hospital-swap-layout">
        <div className="hospital-swap-stage">
          <CardSwap ref={swapRef} width={430} height={270} cardDistance={44} verticalDistance={30} depth={62} skewAmount={2} visibleCards={Math.min(4, records.length)} delay={6500} autoplay={records.length > 1} pauseOnHover draggable speed={0.8} dim={0.25} cardRadius={17} intro={false} theme={theme} onChange={(index) => setActiveIndex(index)}>
            {records.map((hospital, index) => <Card key={hospital.id} className="hospital-swap-card">
              <div className="hospital-swap-card-content">
                <div className="hospital-swap-topline"><span className="hospital-swap-icon"><Hospital size={17}/></span><span className="eyebrow">HOSPITAL {String(index + 1).padStart(2, '0')} / {String(records.length).padStart(2, '0')}</span></div>
                <h3>{hospital.name}</h3>
                <p className="hospital-swap-location"><MapPin size={13}/> Location {hospital.location_id || 'not reported'} <span>·</span> <code>{hospital.id}</code></p>
                <div className="hospital-swap-summary"><strong>{demandTotal(hospital)}<small>synthetic demand units</small></strong><strong>{priorityCount(hospital)}<small>high priority groups</small></strong></div>
                <div className="hospital-tilt-groups">{Object.entries(hospital.demand || {}).map(([group, value]) => <span key={group}>{group}<b>{value}</b></span>)}</div>
                <button type="button" className="hospital-swap-open" onClick={onOpen}>Open hospital directory <ArrowRight size={14}/></button>
              </div>
            </Card>)}
          </CardSwap>
          <div className="hospital-swap-controls"><button aria-label="Previous hospital" onClick={() => swapRef.current?.prev()}><ArrowLeft size={15}/></button><span>{Math.min(activeIndex + 1, records.length)} <i>/</i> {records.length} records <small>· drag a card to cycle</small></span><button aria-label="Next hospital" onClick={() => swapRef.current?.next()}><ArrowRight size={15}/></button></div>
        </div>
        <div className="hospital-swap-note"><span className="eyebrow">ACTIVE SCENARIO</span><h3>Demand stays connected to the model.</h3><p>These records feed the network view, allocation optimizer, and disruption simulations. Quantities are synthetic logistics inputs, not clinical recommendations.</p><button type="button" className="button button-secondary button-small" onClick={onOpen}>Review all hospital demand <ArrowRight size={14}/></button></div>
      </div>
    </section>
  </BorderGlow>;
}
