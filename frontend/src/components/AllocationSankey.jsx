import { useId, useMemo, useState } from "react";
import { allocationFlow } from "../utils/allocationFlow";
import "./AllocationSankey.css";

export default function AllocationSankey({
  scenario,
  result,
  title = "Where the available blood goes",
}) {
  const data = useMemo(
    () => allocationFlow(scenario, result),
    [scenario, result],
  );
  const [selected, setSelected] = useState(null),
    titleId = useId();
  if (!data)
    return (
      <section className="allocation-flow">
        <h4>{title}</h4>
        <p role="status">
          Flow unavailable: this result has not passed synthetic scenario,
          inventory, route, compatibility and demand checks.
        </p>
      </section>
    );
  const maxNodes = Math.max(
    ...[0, 1, 2, 3, 4].map(
      (s) => data.nodes.filter((n) => n.stage === s).length,
    ),
    1,
  );
  const height = Math.max(340, 110 + maxNodes * 65),
    scale = (height - 100 - maxNodes * 28) / Math.max(data.stock, 1),
    placed = new Map();
  for (let stage = 0; stage < 5; stage++) {
    let y = 65;
    for (const n of data.nodes.filter((n) => n.stage === stage)) {
      placed.set(n.id, {
        ...n,
        x: 28 + stage * 205,
        y,
        h: n.value * scale,
        incoming: 0,
        outgoing: 0,
      });
      y += n.value * scale + 28;
    }
  }
  const paths = data.links.map((l, i) => {
    const s = placed.get(l.source),
      t = placed.get(l.target),
      width = l.value * scale,
      y1 = s.y + s.outgoing + width / 2,
      y2 = t.y + t.incoming + width / 2;
    s.outgoing += width;
    t.incoming += width;
    return {
      ...l,
      id: i,
      width,
      d: `M${s.x + 12},${y1} C${s.x + 95},${y1} ${t.x - 85},${y2} ${t.x},${y2}`,
      label: `${s.label} → ${t.label}: ${l.value} units`,
    };
  });
  return (
    <section className="allocation-flow" aria-labelledby={titleId}>
      <div className="allocation-flow-heading">
        <h4 id={titleId}>{title}</h4>
        <span>Validated allocation · units</span>
      </div>
      <dl className="allocation-totals">
        {[
          ["Available", data.stock],
          ["Allocated", data.allocated],
          ["Remaining", data.remaining],
          ["Unmet demand", data.unmet],
        ].map(([label, v]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {data.stock ? (
        <div
          className="allocation-svg-scroll"
          tabIndex={0}
          role="region"
          aria-label="Resource flow diagram, scroll horizontally on narrow screens"
        >
          <svg
            viewBox={`0 0 1020 ${height}`}
            aria-label="Conserved inventory flow through compatible allocations to hospitals"
            role="group"
          >
            {[
              "Blood banks",
              "Available inventory",
              "Compatibility",
              "Allocation",
              "Hospitals",
            ].map((name, i) => (
              <text
                key={name}
                x={28 + i * 205}
                y="24"
                className="allocation-stage"
              >
                {name}
              </text>
            ))}
            {paths.map((p) => (
              <path
                key={p.id}
                d={p.d}
                strokeWidth={p.width}
                className={`allocation-ribbon allocation-${p.kind} ${selected === p.id ? "is-selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={p.label}
                aria-pressed={selected === p.id}
                onMouseEnter={() => setSelected(p.id)}
                onFocus={() => setSelected(p.id)}
                onClick={() => setSelected(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(p.id);
                  }
                }}
              >
                <title>{p.label}</title>
              </path>
            ))}
            {[...placed.values()].map((n) => (
              <g key={n.id} className={`allocation-node allocation-${n.kind}`}>
                <rect x={n.x} y={n.y} width="12" height={n.h} />
                <text x={n.x} y={n.y - 7}>
                  {n.label.length > 23 ? `${n.label.slice(0, 21)}…` : n.label} ·{" "}
                  {n.value}
                </text>
              </g>
            ))}
          </svg>
        </div>
      ) : (
        <p>
          No available inventory. Unmet demand is shown below; no supply flow is
          fabricated.
        </p>
      )}
      <p className="allocation-readout" role="status">
        {paths.find((p) => p.id === selected)?.label ||
          "Focus, hover or select a ribbon to inspect its quantity."}
      </p>
      <p className="allocation-caption">
        Ribbon width represents units on a shared scale. Green: compatible
        proposed shipment. Amber: stock retained. Unmet demand is a separate
        obligation, not blood flowing through the network. Compatibility is
        checked against the scenario. Ribbons aggregate by compatible blood
        group; the table preserves individual routes. Rejected candidate
        quantities are not recorded.
      </p>
      <div className="allocation-hospitals">
        {data.hospitals.map((h) => (
          <div key={h.id}>
            <strong>{h.name}</strong>
            <span>
              {h.served}/{h.demand} units fulfilled
              {h.criticalDemand > 0
                ? ` · critical ${h.criticalServed}/${h.criticalDemand}`
                : ""}
            </span>
            <div
              className="allocation-demand-track"
              role="img"
              aria-label={`${h.name}: ${h.served} served, ${h.unmet} unmet`}
            >
              <i
                style={{
                  width: `${h.demand ? (h.served / h.demand) * 100 : 0}%`,
                }}
              />
            </div>
            <small>{h.unmet} unmet</small>
          </div>
        ))}
      </div>
      <details>
        <summary>Inspect flow quantities and remaining inventory</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bank</th>
                <th>Starting stock</th>
                <th>Allocated</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {data.banks.map((b) => (
                <tr key={b.id}>
                  <th>{b.name}</th>
                  <td>{b.stock}</td>
                  <td>{b.used}</td>
                  <td>{b.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Hospital</th>
                <th>Compatibility</th>
                <th>Units</th>
              </tr>
            </thead>
            <tbody>
              {result.allocation
                .filter((a) => a.quantity > 0)
                .map((a, i) => (
                  <tr key={i}>
                    <td>{a.source}</td>
                    <td>{a.destination}</td>
                    <td>
                      {a.blood_group} → {a.recipient_group}
                    </td>
                    <td>{a.quantity}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
