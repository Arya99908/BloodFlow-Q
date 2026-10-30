import { useMemo, useState } from "react";
import { ArrowUpRight, Download, FlaskConical, RefreshCw } from "lucide-react";
import useObservatory from "../hooks/useObservatory";
import ScientificChart from "./charts/ScientificChart";
import {
  classical,
  density,
  fmt,
  isNumber,
  label,
  pairedRows,
  paretoFront,
  statistics,
} from "../utils/observatoryData";
import "./ComparativeEvidenceExplorer.css";

const COLORS = [
  "#367cdd",
  "#199eb4",
  "#8c74dc",
  "#dd755a",
  "#339d74",
  "#bc8d36",
  "#7489b2",
  "#b86b9c",
  "#468b98",
  "#9a885e",
  "#696cc4",
  "#b75966",
];
const METRICS = {
  relative_gap: { label: "Objective gap (%)", scale: 100 },
  runtime_seconds: { label: "Runtime (ms)", scale: 1000 },
  operational_feasible_shot_rate: {
    label: "Operational feasible shots (%)",
    scale: 100,
  },
  strict_optimal_shot_rate: { label: "Strict optimal shots (%)", scale: 100 },
};
const tabs = [
  ["overview", "Quality & runtime"],
  ["paired", "Paired seeds"],
  ["distribution", "Distributions"],
  ["heatmap", "Scenario matrix"],
  ["scaling", "Scalability"],
  ["methodology", "Reproducibility"],
];
const solverOrder = [
  "standard",
  "warm",
  "xy",
  "warm_xy",
  "warm_keep",
  "warm_zero",
  "warm_zero_keep",
  "greedy_warm",
];
const color = (solver, index) =>
  classical(solver)
    ? ["#367cdd", "#739ce3", "#526bb5", "#91acd7"][
        ["lp", "milp", "exact", "greedy"].indexOf(solver)
      ]
    : COLORS[(Math.max(0, solverOrder.indexOf(solver)) + 1) % COLORS.length];
const axis = (name, type = "value") => ({
  type,
  name,
  nameLocation: "middle",
  nameGap: 35,
});
const chartLegend = { type: "scroll", top: 0 };

function ObservationTable({ rows }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / 20)),
    current = Math.min(page, pages - 1);
  return (
    <details className="obs-table-panel">
      <summary>
        Inspect individual observations{" "}
        <span>{rows.length} records · source-linked</span>
      </summary>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Individual experiment observations"
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Scenario / seed</th>
              <th>Solver</th>
              <th>Status</th>
              <th>Feasible</th>
              <th>Gap (%)</th>
              <th>Runtime (ms)</th>
              <th>Source line</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(current * 20, (current + 1) * 20).map((r) => (
              <tr key={r.id}>
                <td>
                  {label(r.scenario)} / {r.seed ?? "—"}
                </td>
                <th scope="row">{label(r.solver)}</th>
                <td>{r.status}</td>
                <td>
                  {r.feasible === true
                    ? "Yes"
                    : r.feasible === false
                      ? "No"
                      : "Not evaluated"}
                </td>
                <td>
                  {fmt(isNumber(r.relative_gap) ? r.relative_gap * 100 : null)}
                </td>
                <td>
                  {fmt(
                    isNumber(r.runtime_seconds)
                      ? r.runtime_seconds * 1000
                      : null,
                  )}
                </td>
                <td>
                  <a
                    title={r.source.path}
                    href={`https://github.com/syedafnan7-lab/BloodFlow-Q1/blob/cfe11b1/${r.source.path}#L${r.source.line}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Line {r.source.line} ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="obs-pagination">
        <button onClick={() => setPage(current - 1)} disabled={!current}>
          Previous
        </button>
        <span>
          Page {current + 1} of {pages}
        </span>
        <button
          onClick={() => setPage(current + 1)}
          disabled={current >= pages - 1}
        >
          Next
        </button>
      </div>
    </details>
  );
}

function WarmStart({ data }) {
  const w = data.warm_start;
  if (!w?.observations?.length) return null;
  const groups = [...new Set(w.observations.map((r) => r.solver))];
  const option = {
    legend: chartLegend,
    xAxis: {
      ...axis("Initialization"),
      type: "category",
      data: groups.map(label),
    },
    yAxis: { ...axis("Optimal shots (%)"), min: 0, max: 100 },
    series: groups.map((solver, i) => ({
      name: label(solver),
      type: "scatter",
      symbolSize: 12,
      itemStyle: { color: i ? "#199eb4" : "#367cdd" },
      data: w.observations
        .filter((r) => r.solver === solver)
        .map((r) => ({
          name: `Seed ${r.seed}: ${fmt(r.optimal_shot_rate * 100, 3)}%`,
          value: [i, r.optimal_shot_rate * 100],
        })),
    })),
  };
  return (
    <section className="obs-warm">
      <div className="obs-warm-story">
        <span className="obs-kicker">Historical warm-start audit · demo_normal</span>
        <h3>
          Same optimum.
          <br />
          More useful shots.
        </h3>
        <p>
          LP initialization concentrates sampling around an optimum already
          found by the classical relaxation.
        </p>
        <div className="obs-warm-numbers">
          <div>
            <span>Hadamard</span>
            <strong>
              {fmt(w.standard_mean * 100, 2)}
              <small>%</small>
            </strong>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <span>LP warm-start</span>
            <strong>
              {fmt(w.warm_mean * 100, 2)}
              <small>%</small>
            </strong>
          </div>
        </div>
        <p>
          <b>+{fmt(w.difference_pp, 2)} percentage points</b> ·{" "}
          {fmt(w.ratio, 2)}× sampling density from unrounded observations.
        </p>
        <p className="obs-caution">
          Three paired seeds, one tiny synthetic case. This is not a quantum
          speedup or advantage over LP.
        </p>
      </div>
      <div>
        <ScientificChart
          title="Every recorded seed"
          description="Optimal-bitstring probability · 512 shots per run · seeds 7, 11, 19"
          option={option}
          height={300}
        />
        <details>
          <summary>Experiment conditions & observations</summary>
          <pre>
            {JSON.stringify(
              { conditions: w.conditions, observations: w.observations },
              null,
              2,
            )}
          </pre>
        </details>
      </div>
    </section>
  );
}

export default function ComparativeEvidenceExplorer() {
  const { data, error, retry } = useObservatory();
  const [family, setFamily] = useState("primary"),
    [scenario, setScenario] = useState("critical_shortage"),
    [selected, setSelected] = useState(["lp", "milp", "standard", "warm"]),
    [tab, setTab] = useState("overview"),
    [metric, setMetric] = useState("relative_gap"),
    [left, setLeft] = useState("standard"),
    [right, setRight] = useState("warm");
  const families = useMemo(
    () => [...new Set((data?.observations || []).map((r) => r.family))],
    [data],
  );
  const scoped = useMemo(
    () => (data?.observations || []).filter((r) => r.family === family),
    [data, family],
  );
  const scenarios = useMemo(
    () => [...new Set(scoped.map((r) => r.scenario))],
    [scoped],
  );
  const solvers = useMemo(
    () =>
      [...new Set(scoped.map((r) => r.solver))].sort(
        (a, b) =>
          Number(classical(b)) - Number(classical(a)) || a.localeCompare(b),
      ),
    [scoped],
  );
  const scenarioRows = useMemo(
    () => scoped.filter((r) => scenario === "all" || r.scenario === scenario),
    [scoped, scenario],
  );
  const rows = useMemo(
    () => scenarioRows.filter((r) => selected.includes(r.solver)),
    [scenarioRows, selected],
  );
  const active = solvers.filter((s) => selected.includes(s)),
    complete = rows.filter((r) => r.status === "completed");
  const compare = pairedRows(scenarioRows, left, right, metric),
    pairedStats = statistics(
      compare.map((r) => r.difference * METRICS[metric].scale),
      { confidence: true },
    );
  const metricValue = (r) =>
    isNumber(r[metric]) &&
    (!["relative_gap"].includes(metric) || r.feasible === true)
      ? r[metric] * METRICS[metric].scale
      : null;
  const finite = rows.filter((r) => isNumber(metricValue(r))),
    allScenarios = (scope) => [...new Set(scope.map((r) => r.scenario))];
  const option = useMemo(() => {
    const quality = rows.filter(
      (r) =>
        r.feasible === true &&
        isNumber(r.relative_gap) &&
        r.runtime_seconds > 0,
    );
    return {
      legend: chartLegend,
      xAxis: axis("End-to-end runtime (ms · log scale)", "log"),
      yAxis: { ...axis("Gap to exact objective (%)"), min: 0 },
      series: [
        ...active.map((solver, i) => ({
          name: label(solver),
          type: "scatter",
          symbol: classical(solver) ? "rect" : "circle",
          symbolSize: classical(solver) ? 10 : 11,
          itemStyle: { color: color(solver, i), opacity: 0.8 },
          data: quality
            .filter((r) => r.solver === solver)
            .map((r) => ({
              name: `${label(r.scenario)} · seed ${r.seed}\n${fmt(r.runtime_seconds * 1000)} ms / ${fmt(r.relative_gap * 100)}% gap`,
              value: [r.runtime_seconds * 1000, r.relative_gap * 100],
            })),
        })),
        ...(scenario !== "all"
          ? [
              {
                name: "Observed Pareto frontier",
                type: "line",
                showSymbol: false,
                lineStyle: { type: "dashed", color: "#8795a5" },
                data: paretoFront(rows).map((r) => [
                  r.runtime_seconds * 1000,
                  r.relative_gap * 100,
                ]),
              },
            ]
          : []),
      ],
    };
  }, [rows, scenario, selected]);
  if (error)
    return (
      <section className="panel">
        <h2>Solver Benchmark Observatory</h2>
        <p role="alert">{error}</p>
        <button className="button" onClick={retry}>
          <RefreshCw size={16} /> Retry evidence
        </button>
      </section>
    );
  if (!data)
    return (
      <section className="science-empty" role="status">
        Loading verified experiment observations…
      </section>
    );
  const exportRows = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              schema_version: data.schema_version,
              filters: { family, scenario, solvers: selected },
              sources: data.sources,
              observations: rows,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "bloodflow-selected-evidence.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const metricSelect = (
    <label>
      Measurement
      <select value={metric} onChange={(e) => setMetric(e.target.value)}>
        {Object.entries(METRICS).map(([id, m]) => (
          <option value={id} key={id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="observatory" aria-labelledby="observatory-title">
      <header className="obs-header">
        <div>
          <span className="obs-kicker">
            <FlaskConical size={15} /> BloodFlow-Q / Research instruments
          </span>
          <h2 id="observatory-title">
            Solver Benchmark
            <br />
            <em>Observatory</em>
          </h2>
          <p>Trace a result from allocation problem to measured evidence.</p>
        </div>
        <div className="obs-provenance">
          <span className="obs-live-dot" /> Saved experiment archive
          <strong>
            {data.observations.length.toLocaleString()} observations
          </strong>
          <span>Local classical computation & quantum simulation</span>
          <button className="obs-export" onClick={exportRows}>
            <Download size={15} /> Export selected evidence
          </button>
        </div>
      </header>
      <div className="obs-context">
        <span>Independent feasibility checks</span>
        <span>Synthetic scenarios</span>
        <span>No physical QPU execution</span>
        <a href="/quantum-lab">
          Inspect execution <ArrowUpRight size={14} />
        </a>
      </div>
      <div className="obs-controls">
        <label>
          Experiment family
          <select
            value={family}
            onChange={(e) => {
              setFamily(e.target.value);
              setScenario("all");
            }}
          >
            {families.map((f) => (
              <option key={f} value={f}>
                {label(f)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Scenario
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
          >
            <option value="all">All scenarios (descriptive only)</option>
            {scenarios.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <div className="obs-filter-count">
          <strong>{rows.length}</strong>
          <span>
            selected observations
            <br />
            {rows.length - complete.length} not completed
          </span>
        </div>
      </div>
      <fieldset className="obs-solvers">
        <legend>Visible solvers</legend>
        {solvers.map((s, i) => (
          <label key={s} style={{ "--solver-color": color(s, i) }}>
            <input
              type="checkbox"
              checked={selected.includes(s)}
              onChange={() =>
                setSelected((v) =>
                  v.includes(s) ? v.filter((x) => x !== s) : [...v, s],
                )
              }
            />
            <span>{label(s)}</span>
          </label>
        ))}
      </fieldset>
      <div className="obs-tabs" role="tablist" aria-label="Evidence views">
        {tabs.map(([id, title]) => (
          <button
            key={id}
            id={`obs-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls="obs-view"
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const i = tabs.findIndex((x) => x[0] === tab),
                  n =
                    e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? tabs.length - 1
                        : (i +
                            (e.key === "ArrowRight" ? 1 : -1) +
                            tabs.length) %
                          tabs.length;
                setTab(tabs[n][0]);
                document.getElementById(`obs-tab-${tabs[n][0]}`)?.focus();
              }
            }}
          >
            {title}
          </button>
        ))}
      </div>
      <div id="obs-view" role="tabpanel" aria-labelledby={`obs-tab-${tab}`}>
        {scenario === "all" && (
          <p className="obs-caution">
            Different scenarios have different difficulty and objectives. Pooled
            summaries are descriptive; select one scenario for paired inference
            and a Pareto frontier.
          </p>
        )}
        {tab === "overview" && (
          <>
            <ScientificChart
              title="Solution quality meets computational cost"
              description="Each mark is one feasible completed observation. Lower gap and lower runtime are better. Rectangles: classical; circles: simulated quantum."
              option={option}
              empty={
                !rows.some(
                  (r) =>
                    r.feasible &&
                    isNumber(r.relative_gap) &&
                    r.runtime_seconds > 0,
                )
              }
              height={420}
            />
            <div className="obs-grid">
              <ScientificChart
                title="Returned allocation feasibility"
                description="Feasible / all attempts. Skips and failures remain in the denominator; this is not shot feasibility."
                empty={!rows.length}
                option={{
                  xAxis: {
                    ...axis("Solver"),
                    type: "category",
                    data: active.map(label),
                    axisLabel: { rotate: 25 },
                  },
                  yAxis: { ...axis("Attempts (%)"), max: 100 },
                  legend: chartLegend,
                  series: [
                    [
                      "Feasible",
                      "#339d74",
                      (r) => r.feasible === true && r.status === "completed",
                    ],
                    [
                      "Infeasible",
                      "#dd755a",
                      (r) => r.feasible === false && r.status === "completed",
                    ],
                    [
                      "Not evaluated",
                      "#bc8d36",
                      (r) => r.status !== "completed" || r.feasible == null,
                    ],
                  ].map(([name, c, filter]) => ({
                    name,
                    type: "bar",
                    stack: "all",
                    itemStyle: { color: c },
                    data: active.map((s) => {
                      const a = rows.filter((r) => r.solver === s);
                      return a.length
                        ? (a.filter(filter).length / a.length) * 100
                        : 0;
                    }),
                  })),
                }}
              />
              <ScientificChart
                title="Runtime spread"
                description="Median recorded runtime per solver. See distributions for every run and quartiles. No QPU timings."
                empty={!complete.length}
                option={{
                  xAxis: {
                    ...axis("Solver"),
                    type: "category",
                    data: active.map(label),
                    axisLabel: { rotate: 25 },
                  },
                  yAxis: axis("Median runtime (ms · log)", "log"),
                  series: [
                    {
                      type: "scatter",
                      symbolSize: 12,
                      data: active.map((s, i) => ({
                        value: [
                          i,
                          statistics(
                            complete
                              .filter((r) => r.solver === s)
                              .map((r) => r.runtime_seconds),
                          ).median * 1000 || null,
                        ],
                        itemStyle: { color: color(s, i) },
                      })),
                    },
                  ],
                }}
              />
            </div>
            <WarmStart data={data} />
          </>
        )}
        {tab === "paired" && (
          <>
            <div className="obs-controls">
              {metricSelect}
              <label>
                Reference solver
                <select value={left} onChange={(e) => setLeft(e.target.value)}>
                  {solvers.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Compared solver
                <select
                  value={right}
                  onChange={(e) => setRight(e.target.value)}
                >
                  {solvers.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="obs-grid">
              <ScientificChart
                title="Matched seed observations"
                description={`${label(left)} → ${label(right)}. Matched by experiment family, scenario and seed; unmatched and unavailable outcomes are excluded.`}
                empty={!compare.length || left === right}
                option={{
                  xAxis: {
                    type: "category",
                    data: [label(left), label(right)],
                  },
                  yAxis: axis(METRICS[metric].label),
                  series: compare.map((r, i) => ({
                    name: `${label(r.scenario)} / seed ${r.seed}`,
                    type: "line",
                    symbolSize: 8,
                    lineStyle: { width: 1.4, opacity: 0.7 },
                    itemStyle: { color: COLORS[i % COLORS.length] },
                    data: [
                      r.left * METRICS[metric].scale,
                      r.right * METRICS[metric].scale,
                    ],
                  })),
                }}
              />
              <ScientificChart
                title="Paired differences"
                description={`${label(right)} minus ${label(left)}. Negative gap/runtime favors the compared solver; positive sampling probability favors it.`}
                empty={!compare.length || left === right}
                option={{
                  xAxis: {
                    type: "category",
                    data: compare.map((r) => `${r.scenario} / ${r.seed}`),
                    axisLabel: { show: false },
                  },
                  yAxis: axis(
                    metric === "runtime_seconds"
                      ? "Runtime difference (ms)"
                      : "Difference (percentage points)",
                  ),
                  series: [
                    {
                      type: "bar",
                      data: compare.map((r) => ({
                        name: `${r.scenario} / seed ${r.seed}`,
                        value: r.difference * METRICS[metric].scale,
                        itemStyle: {
                          color: r.difference < 0 ? "#367cdd" : "#199eb4",
                        },
                      })),
                    },
                  ],
                }}
              />
            </div>
            <div className="obs-stat-strip">
              <Stat name="Matched pairs" value={compare.length} />
              <Stat name="Mean difference" value={fmt(pairedStats.mean)} />
              <Stat name="Median difference" value={fmt(pairedStats.median)} />
              <Stat
                name="Interquartile interval"
                value={`${fmt(pairedStats.q1)} to ${fmt(pairedStats.q3)}`}
              />
              <Stat
                name="95% bootstrap mean interval"
                value={
                  scenario === "all"
                    ? "Select one scenario"
                    : pairedStats.ci?.map((v) => fmt(v)).join(" to ") ||
                      "At least 3 pairs required"
                }
              />
            </div>
            <p className="obs-note">
              Interval: 2,000 deterministic percentile resamples of paired
              differences. Small seed counts give fragile uncertainty estimates;
              exploratory comparisons are not corrected for multiple testing.
              Pairing preserves differing solver settings, which remain visible
              in the exported records.
            </p>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Seed</th>
                    <th>{label(left)}</th>
                    <th>{label(right)}</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map((r) => (
                    <tr key={r.key}>
                      <td>{label(r.scenario)}</td>
                      <td>{r.seed}</td>
                      <td>{fmt(r.left * METRICS[metric].scale)}</td>
                      <td>{fmt(r.right * METRICS[metric].scale)}</td>
                      <td>{fmt(r.difference * METRICS[metric].scale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === "distribution" && (
          <>
            <div className="obs-controls">{metricSelect}</div>
            <div className="obs-grid">
              <ScientificChart
                title="Repeated-run box plots"
                description="Box: Q1–Q3; line: median; whiskers: observed minimum–maximum (not Tukey fences)."
                empty={!finite.length}
                option={{
                  xAxis: {
                    type: "category",
                    data: active.map(label),
                    axisLabel: { rotate: 25 },
                  },
                  yAxis: axis(METRICS[metric].label),
                  series: [
                    {
                      type: "boxplot",
                      data: active.map((s, i) => {
                        const a = statistics(
                          rows.filter((r) => r.solver === s).map(metricValue),
                        );
                        return {
                          value: a.n
                            ? [a.min, a.q1, a.median, a.q3, a.max]
                            : [],
                          itemStyle: { color: color(s, i), opacity: 0.65 },
                        };
                      }),
                    },
                  ],
                }}
              />
              <Violin
                rows={rows}
                active={active}
                metric={metric}
                value={metricValue}
              />
            </div>
            <ScientificChart
              title="Every experimental observation"
              description="No jitter or synthetic values. Coincident observations overlap; inspect the table for exact counts and source lines."
              empty={!finite.length}
              option={{
                legend: chartLegend,
                xAxis: {
                  type: "category",
                  data: active.map(label),
                  axisLabel: { rotate: 25 },
                },
                yAxis: axis(METRICS[metric].label),
                series: active.map((s, i) => ({
                  name: label(s),
                  type: "scatter",
                  symbolSize: 9,
                  itemStyle: { color: color(s, i), opacity: 0.65 },
                  data: rows
                    .filter((r) => r.solver === s && isNumber(metricValue(r)))
                    .map((r) => ({
                      name: `${r.scenario} / seed ${r.seed}`,
                      value: [i, metricValue(r)],
                    })),
                })),
              }}
            />
            <Summary rows={rows} active={active} value={metricValue} />
          </>
        )}
        {tab === "heatmap" && (
          <>
            <div className="obs-controls">{metricSelect}</div>
            <ScientificChart
              title="Scenario × solver"
              description="Median of completed recorded values per cell. Empty cells are unmeasured, not zero. This view spans the selected family; solver filters apply."
              height={Math.max(380, allScenarios(scoped).length * 30 + 130)}
              empty={!active.length}
              option={{
                xAxis: {
                  type: "category",
                  data: active.map(label),
                  axisLabel: { rotate: 30 },
                },
                yAxis: {
                  type: "category",
                  data: allScenarios(scoped).map(label),
                },
                visualMap: {
                  min: 0,
                  max: Math.max(1, ...scoped.map(metricValue).filter(isNumber)),
                  calculable: true,
                  orient: "horizontal",
                  bottom: 0,
                  left: "center",
                  inRange: { color: ["#e2eff2", "#53a4b5", "#18546d"] },
                },
                series: [
                  {
                    type: "heatmap",
                    data: allScenarios(scoped).flatMap((s, yi) =>
                      active.flatMap((solver, xi) => {
                        const a = statistics(
                          scoped
                            .filter(
                              (r) =>
                                r.scenario === s &&
                                r.solver === solver &&
                                r.status === "completed",
                            )
                            .map(metricValue),
                        );
                        return a.n
                          ? [
                              {
                                name: `${label(s)} · ${label(solver)}\nn=${a.n} · median ${fmt(a.median)}`,
                                value: [xi, yi, a.median],
                              },
                            ]
                          : [];
                      }),
                    ),
                    label: { show: true, formatter: (p) => fmt(p.value[2], 1) },
                  },
                ],
              }}
            />
          </>
        )}
        {tab === "scaling" && (
          <Scalability
            data={data}
            rows={scoped.filter((r) => selected.includes(r.solver))}
            active={active}
          />
        )}
        {tab === "methodology" && (
          <section className="obs-methodology">
            <h3>Evidence you can reproduce</h3>
            <p>
              All plotted measurements come from saved experiments. No
              experiment is rerun in the browser. Runtime comparisons use
              recorded end-to-end wall time; skipped attempts have no solver
              runtime.
            </p>
            <div className="obs-grid">
              <div>
                <h4>Interpretation boundaries</h4>
                <ul>
                  <li>
                    Operational feasibility and strict encoded equality
                    feasibility are separate metrics.
                  </li>
                  <li>
                    Feasible objectives are compared to the exact reference for
                    the same case.
                  </li>
                  <li>
                    LP warm-start quality includes work already performed by a
                    classical solver.
                  </li>
                  <li>
                    Local simulator timings do not predict QPU performance.
                  </li>
                  <li>
                    Facilities, inventory and demands are synthetic logistics
                    examples.
                  </li>
                </ul>
              </div>
              <div>
                <h4>Rebuild the archive</h4>
                <code>python experiments/build_observatory_evidence.py</code>
                <p>
                  Download the selected observations to inspect configuration,
                  seed, backend and source line for every point.
                </p>
                <a
                  href="/observatory-evidence.json"
                  download
                  className="button button-secondary"
                >
                  Download complete archive
                </a>
              </div>
            </div>
            <details open>
              <summary>Methodology and metric definitions</summary>
              <pre>{JSON.stringify(data.methodology, null, 2)}</pre>
            </details>
            <details>
              <summary>
                Source files and SHA-256 hashes ({data.sources.length})
              </summary>
              <pre>{JSON.stringify(data.sources, null, 2)}</pre>
            </details>
          </section>
        )}
      </div>
      <ObservationTable rows={rows} />
      <footer className="obs-footer">
        Evidence first. Better sampling is not proof of quantum advantage.
        <span>Classical baselines remain part of every honest comparison.</span>
      </footer>
    </section>
  );
}
function Stat({ name, value }) {
  return (
    <div>
      <span>{name}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Summary({ rows, active, value }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Solver</th>
            <th>n</th>
            <th>Mean</th>
            <th>Median</th>
            <th>Q1</th>
            <th>Q3</th>
          </tr>
        </thead>
        <tbody>
          {active.map((s) => {
            const a = statistics(rows.filter((r) => r.solver === s).map(value));
            return (
              <tr key={s}>
                <th>{label(s)}</th>
                <td>{a.n}</td>
                <td>{fmt(a.mean)}</td>
                <td>{fmt(a.median)}</td>
                <td>{fmt(a.q1)}</td>
                <td>{fmt(a.q3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function Violin({ rows, active, metric, value }) {
  const datasets = active.map((s) =>
    density(rows.filter((r) => r.solver === s).map(value)),
  );
  const max = Math.max(0, ...datasets.flatMap((a) => a.map((x) => x[1])));
  const option = {
    xAxis: {
      type: "category",
      data: active.map(label),
      axisLabel: { rotate: 25 },
    },
    yAxis: axis(METRICS[metric].label),
    series: active.map((s, i) => ({
      name: label(s),
      type: "custom",
      data: datasets[i].length
        ? [[i, datasets[i][0][0], datasets[i].at(-1)[0]]]
        : [],
      encode: { x: 0, y: [1, 2] },
      renderItem: (params, api) => {
        const width = Math.min(35, Math.abs(api.size([1, 0])[0]) * 0.4);
        const points = datasets[i]
          .map(([v, d]) => {
            const p = api.coord([i, v]);
            return [p[0] - (width * d) / max, p[1]];
          })
          .concat(
            [...datasets[i]].reverse().map(([v, d]) => {
              const p = api.coord([i, v]);
              return [p[0] + (width * d) / max, p[1]];
            }),
          );
        return {
          type: "polygon",
          shape: { points },
          style: { fill: color(s, i), opacity: 0.55, stroke: color(s, i) },
        };
      },
    })),
  };
  return (
    <ScientificChart
      title="Empirical density / violin"
      description="Gaussian KDE, Silverman bandwidth; clipped to observed range. Width is density, not sample count. At least 3 nonconstant observations required."
      option={option}
      empty={!max}
    />
  );
}
function Scalability({ data, rows, active }) {
  const [measure, setMeasure] = useState("runtime_seconds");
  const fields = {
    runtime_seconds: ["Runtime (ms)", 1000],
    relative_gap: ["Objective gap (%)", 100],
    circuit_depth: ["Recorded circuit depth (layers)", 1],
    two_qubit_gates: ["Recorded two-qubit operations", 1],
    peak_rss_bytes: ["Process peak RSS (MiB)", 1 / 1048576],
  };
  const [name, scale] = fields[measure];
  return (
    <>
      <div className="obs-controls">
        <label>
          Resource / outcome
          <select value={measure} onChange={(e) => setMeasure(e.target.value)}>
            {Object.entries(fields).map(([id, [title]]) => (
              <option value={id} key={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ScientificChart
        title="Measured resource envelope"
        description="Actual tested encoded sizes only. Cases and configurations vary: this is a profile, not a controlled scaling law. No extrapolation."
        empty={!rows.some((r) => isNumber(r[measure]))}
        option={{
          legend: chartLegend,
          xAxis: axis("Encoded binary variables / qubits"),
          yAxis: axis(name),
          series: active.map((s, i) => ({
            name: label(s),
            type: "scatter",
            symbol: classical(s) ? "rect" : "circle",
            symbolSize: 8,
            itemStyle: { color: color(s, i), opacity: 0.6 },
            data: rows
              .filter(
                (r) =>
                  r.solver === s &&
                  r.status === "completed" &&
                  isNumber(r[measure]) &&
                  (measure !== "relative_gap" || r.feasible === true),
              )
              .map((r) => ({
                name: `${label(r.scenario)} · seed ${r.seed}`,
                value: [r.qubits, r[measure] * scale],
              })),
          })),
        }}
      />
      <p className="obs-caution">
        Statevector simulation grows exponentially with qubits. RSS is a process
        high-water mark and may include earlier runs. Compiled gate counts are
        simulator-target resources, not routed physical-device measurements.
      </p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Banks</th>
              <th>Hospitals</th>
              <th>Shipment variables</th>
              <th>Qubits</th>
              <th>Inventory</th>
              <th>Demand</th>
            </tr>
          </thead>
          <tbody>
            {data.scenarios
              .filter((s) =>
                rows.some((r) => r.scenario === s.id && r.family === s.family),
              )
              .map((s) => (
                <tr key={`${s.family}/${s.id}`}>
                  <th>{label(s.id)}</th>
                  {[
                    "banks",
                    "hospitals",
                    "decision_variables",
                    "qubits",
                    "inventory",
                    "demand",
                  ].map((k) => (
                    <td key={k}>{fmt(s[k], 0)}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>Supplementary scalability records (separate protocol)</summary>
        <pre>{JSON.stringify(data.scaling, null, 2)}</pre>
      </details>
    </>
  );
}
