import { useState } from "react";
import useObservatory from "../hooks/useObservatory";
import ScientificChart from "./charts/ScientificChart";
import { fmt, label, validCounts, isNumber } from "../utils/observatoryData";
import "./ComparativeEvidenceExplorer.css";
const percent = (v) => (isNumber(v) ? `${fmt(v * 100)}%` : "Not recorded");
export default function QuantumExecutionInspector() {
  const { data, error, retry } = useObservatory();
  const [selected, setSelected] = useState("");
  if (error)
    return (
      <section className="panel">
        <p role="alert">{error}</p>
        <button onClick={retry}>Retry execution archive</button>
      </section>
    );
  if (!data) return <p role="status">Loading execution evidence…</p>;
  const examples = data.execution_examples || [],
    r = examples.find((x) => x.id === selected) || examples[0];
  if (!r) return <p>No execution records available.</p>;
  const counts = validCounts(r),
    shown = counts.slice(0, 16),
    others = counts.slice(16).reduce((s, [, n]) => s + n, 0),
    entries = others ? [...shown, ["Other recorded outcomes", others]] : shown;
  return (
    <section
      className="observatory execution-inspector"
      aria-labelledby="execution-title"
    >
      <header className="obs-header">
        <div>
          <span className="obs-kicker">BloodFlow-Q / Execution provenance</span>
          <h2 id="execution-title">
            Inside the
            <br />
            <em>quantum experiment</em>
          </h2>
          <p>Real circuit resources. Recorded measurements. Explicit limits.</p>
        </div>
        <div className="obs-provenance">
          <span className="obs-status">Classical simulation</span>
          <strong>No physical QPU run</strong>
          <span>No backend job ID or hardware calibration evidence</span>
        </div>
      </header>
      <div className="execution-stages">
        {[
          ["Formulation", "QUBO → Ising", "Implemented"],
          ["Simulation", "Statevector training + Aer shots", "Recorded"],
          ["Basis decomposition", "Separate all-to-all fixtures", "Unrouted"],
          [
            "Physical hardware",
            "Device execution and calibration",
            "Not demonstrated",
          ],
        ].map(([title, note, status]) => (
          <div key={title}>
            <span>{title}</span>
            <strong>{status}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="obs-controls">
        <label>
          Saved execution
          <select value={r.id} onChange={(e) => setSelected(e.target.value)}>
            {examples.map((x) => (
              <option key={x.id} value={x.id}>
                {label(x.scenario)} / {label(x.solver)} / seed {x.seed}
              </option>
            ))}
          </select>
        </label>
        <p className="obs-note">
          Curated execution examples include complete counts. The observatory
          exposes every run.
        </p>
      </div>
      <div className="obs-stat-strip">
        {[
          ["Qubits", r.qubits],
          ["QAOA layers (p)", r.config?.p],
          ["Compiled depth", r.circuit_depth],
          ["Two-qubit operations", r.two_qubit_gates],
          ["Shots", r.shots],
          [
            "Runtime (ms)",
            isNumber(r.runtime_seconds) ? r.runtime_seconds * 1000 : null,
          ],
        ].map(([name, v]) => (
          <div key={name}>
            <span>{name}</span>
            <strong>{fmt(v)}</strong>
          </div>
        ))}
      </div>
      <p className="obs-caution">
        {r.backend}. {r.resource_scope}. QAOA layers p are not compiled gate
        depth. Simulator gate counts are not hardware-native gate counts.
      </p>
      <div className="obs-grid">
        <ScientificChart
          title="Measurement distribution"
          description="16 most frequent bitstrings plus all remaining counts. Percentages use the complete recorded shot total."
          empty={!counts.length}
          height={420}
          option={{
            grid: {
              left: 36,
              right: 20,
              top: 20,
              bottom: 135,
              containLabel: true,
            },
            xAxis: {
              type: "category",
              data: entries.map(([bits]) => bits),
              axisLabel: { rotate: 70, fontSize: 9 },
            },
            yAxis: { type: "value", name: "Measured shots (%)", max: 100 },
            series: [
              {
                type: "bar",
                itemStyle: { color: "#199eb4" },
                data: entries.map(([bits, count]) => ({
                  name: `${bits}: ${count} / ${r.shots} shots`,
                  value: (count / r.shots) * 100,
                })),
              },
            ],
          }}
        />
        <div className="execution-detail">
          <h3>Feasibility, with definitions</h3>
          <dl>
            <div>
              <dt>Returned allocation</dt>
              <dd>
                {r.feasible === true
                  ? "Feasible"
                  : r.feasible === false
                    ? "Infeasible"
                    : "Not evaluated"}
              </dd>
            </div>
            <div>
              <dt>Operationally feasible shots</dt>
              <dd>{percent(r.operational_feasible_shot_rate)}</dd>
            </div>
            <div>
              <dt>Strict feasible probability (statevector)</dt>
              <dd>{percent(r.strict_feasible_probability)}</dd>
            </div>
            <div>
              <dt>Strict optimal shots</dt>
              <dd>{percent(r.strict_optimal_shot_rate)}</dd>
            </div>
            <div>
              <dt>Objective / exact reference</dt>
              <dd>
                {fmt(r.objective)} / {fmt(r.reference_objective)}
              </dd>
            </div>
            <div>
              <dt>Optimizer</dt>
              <dd>
                {r.optimizer} · {r.function_evaluations} evaluations
              </dd>
            </div>
            <div>
              <dt>Gate counts</dt>
              <dd>
                {Object.entries(r.gate_counts || {})
                  .map(([g, n]) => `${g}: ${n}`)
                  .join(" · ") || "Not recorded"}
              </dd>
            </div>
          </dl>
          <p>
            Operational checks validate decoded logistics. Strict feasibility
            additionally checks the encoded equality constraints. Statevector
            probabilities are not finite-shot confidence estimates.
          </p>
        </div>
      </div>
      <details>
        <summary>Every observed bitstring ({counts.length})</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bitstring</th>
                <th>Count</th>
                <th>Probability (%)</th>
              </tr>
            </thead>
            <tbody>
              {counts.map(([b, n]) => (
                <tr key={b}>
                  <th>
                    <code>{b}</code>
                  </th>
                  <td>{n}</td>
                  <td>{fmt((n / r.shots) * 100, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <section className="execution-circuit">
        <h3>Circuit reconstruction</h3>
        <p>
          The archive records aggregate operation counts and variational
          parameters, but no ordered gate instructions or QASM. A faithful
          circuit drawing cannot be reconstructed from these counts alone.
        </p>
        <p>
          <strong>Recorded final parameters (radians):</strong>{" "}
          {r.parameters?.map((x) => fmt(x, 5)).join(", ") || "Not recorded"}
        </p>
      </section>
      <details>
        <summary>Execution configuration and source record</summary>
        <pre>{JSON.stringify(r, null, 2)}</pre>
      </details>
      <details>
        <summary>Separate basis-decomposition fixtures</summary>
        <p>
          These historical fixtures use rz, sx, x, cx with all-to-all unrouted
          connectivity. They are not the selected run and do not demonstrate
          device compatibility.
        </p>
        <pre>{JSON.stringify(data.basis_resources, null, 2)}</pre>
      </details>
    </section>
  );
}
