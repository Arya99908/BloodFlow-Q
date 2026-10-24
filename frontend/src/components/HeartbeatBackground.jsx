import './HeartbeatBackground.css';

// Decorative ECG motif only; it does not display a patient's pulse or live data.
const TRACE = 'M0 90 H160 L177 82 L191 90 H233 L248 106 L268 30 L288 150 L309 72 L328 90 H480 L497 82 L511 90 H553 L568 106 L588 30 L608 150 L629 72 L648 90 H800 L817 82 L831 90 H873 L888 106 L908 30 L928 150 L949 72 L968 90 H1200';

export default function HeartbeatBackground() {
  return <div className="heartbeat-background" aria-hidden="true">
    {[0, 1, 2].map(row => <svg key={row} className={`heartbeat-background__row heartbeat-background__row--${row}`} viewBox="0 0 1200 180" preserveAspectRatio="xMidYMid slice" focusable="false">
      <path className="heartbeat-background__track" d={TRACE} pathLength="1200" />
      <path className="heartbeat-background__signal" d={TRACE} pathLength="1200" />
    </svg>)}
  </div>;
}
