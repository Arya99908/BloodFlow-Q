"""Summarize one actual experiment JSON file without changing its measurements."""

from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
METRICS = (
    ("objective", "Objective"),
    ("critical_satisfaction", "Critical satisfaction rate"),
    ("total_unmet_demand", "Total unmet demand"),
    ("transport_cost", "Transport cost"),
    ("average_travel_time", "Average travel time"),
    ("runtime_seconds", "Runtime (seconds)"),
    ("approximation_gap", "Approximation gap vs Exact"),
)


def summarize(experiment: dict[str, Any]) -> dict[str, Any]:
    rows = experiment["results"]
    summary: dict[str, Any] = {"scenario_count": experiment["configuration"]["scenario_count"],
                               "methods": {}}
    for method in ("greedy", "exact", "qaoa"):
        method_rows = [row for row in rows if row["method"] == method]
        method_summary: dict[str, Any] = {
            "status_counts": {status: sum(row.get("status") == status for row in method_rows)
                              for status in sorted({row.get("status") for row in method_rows})},
            "feasible_count": sum(row.get("feasibility") is True for row in method_rows),
            "infeasible_count": sum(row.get("feasibility") is False for row in method_rows),
            "metrics": {},
        }
        for metric, _label in METRICS:
            # Objective values for infeasible QAOA samples use an unpenalized
            # expression, so they are excluded from solver-to-solver objective
            # summaries. Other observed metrics are retained for completed
            # QAOA samples, with feasibility counts shown separately.
            eligible = [row.get(metric) for row in method_rows
                        if row.get("status") in {"completed", "infeasible"}
                        and row.get(metric) is not None
                        and (metric != "objective" or row.get("feasibility") is True)]
            values = [float(value) for value in eligible if math.isfinite(float(value))]
            method_summary["metrics"][metric] = {
                "count": len(values),
                "mean": statistics.fmean(values) if values else None,
                "median": statistics.median(values) if values else None,
                "minimum": min(values) if values else None,
                "maximum": max(values) if values else None,
                "standard_deviation_population": statistics.pstdev(values) if values else None,
            }
        summary["methods"][method] = method_summary
    return summary


def render_report(experiment: dict[str, Any], summary: dict[str, Any], source: str) -> str:
    config = experiment["configuration"]
    rows = experiment["results"]
    lines = [
        "# BloodFlow-Q Experiment Results", "",
        f"**Raw data:** [`{Path(source).name}`](../{source})  ",
        f"**Configuration:** [`{Path(source).stem}.json`](../experiments/configurations/{Path(source).stem}.json)",
        "", "## Methodology", "",
        "This report is generated from the raw JSON experiment output. It does not alter source measurements. "
        "Each method runs on the same compact, fictional scenario with a shared objective. Greedy is the "
        "deterministic baseline; Exact enumerates the bounded allocation states up to its configured limit; "
        "QAOA uses the local Qiskit Aer simulator, samples finite-shot bitstrings, decodes them, and runs "
        "the shared classical feasibility validator. An infeasible QAOA sample is retained as infeasible and "
        "is not repaired. Runtime is measured locally and is environment-dependent.", "",
        "## Number and size of scenarios", "",
        f"The run contains **{config['scenario_count']} scenarios**. Full scenario inputs and per-case "
        f"unit counts are in [`{Path(source).stem}.json`](../experiments/configurations/{Path(source).stem}.json). "
        "Each case has one synthetic bank, one synthetic hospital, one modeled blood group, and at most one potential "
        "allocation variable. Inventory and demand are bounded by 12 and 7 units respectively. The QUBO bit count "
        "is reported per case below. This deliberately "
        "small design keeps exact enumeration and the local simulator bounded.", "",
        "| Scenario | Banks | Hospitals | Groups | Inventory units | Demand units | QUBO bits |", "|---|---:|---:|---:|---:|---:|---:|",
    ]
    qaoa_variables = {row["scenario_id"]: row.get("qubo_variable_count")
                      for row in rows if row["method"] == "qaoa"}
    for scenario_id, size in config["scenario_sizes"].items():
        lines.append(f"| {scenario_id} | {size['blood_banks']} | {size['hospitals']} | {size['blood_groups']} | {size['inventory_units']} | {size['demand_units']} | {qaoa_variables.get(scenario_id, '—')} |")
    lines += ["", "## Parameters", "",
              f"- Objective weights: `{json.dumps(config['objective_weights'], sort_keys=True)}`",
              f"- QAOA: `{json.dumps(config['qaoa'], sort_keys=True)}`",
              f"- QUBO penalty weights: `{json.dumps(config['qubo_penalty_weights'], sort_keys=True)}`",
              f"- Exact candidate-state cap: `{config['exact_max_candidate_states']:,}`",
              f"- Software versions: `{json.dumps(config['environment']['packages'], sort_keys=True)}`", "",
              "## Per-scenario results", "",
              "`Feasible` is the validator result. A QAOA objective is reported only for a feasible decoded allocation; "
              "an infeasible measured candidate's raw objective expression is not comparable and is excluded from "
              "objective statistics. Approximation gap is `(method objective - exact objective) / abs(exact objective)` "
              "and is recorded only when both method and Exact results are feasible. Runtime includes solving and "
              "the independent validation performed by this runner.", "",
              "| Scenario | Method | Status | Objective | Critical satisfied | Unmet | Transport cost | Avg travel time | Feasible | Runtime (s) | Gap vs Exact |",
              "|---|---|---|---:|---:|---:|---:|---:|:---:|---:|---:|"]
    for row in rows:
        val = lambda value: "—" if value is None else (f"{value:.6g}" if isinstance(value, float) else str(value))
        critical = None if row.get("critical_satisfaction") is None else 100 * row["critical_satisfaction"]
        lines.append("| " + " | ".join((row["scenario_id"], row["method"], row["status"],
            val(row.get("objective")), "—" if critical is None else f"{critical:.1f}%",
            val(row.get("total_unmet_demand")), val(row.get("transport_cost")),
            val(row.get("average_travel_time")), val(row.get("feasibility")),
            val(row.get("runtime_seconds")), val(row.get("approximation_gap")))) + " |")
    lines += ["", "## Summary statistics", "",
              "Mean, median, minimum, maximum, and population standard deviation are calculated across available "
              "measurements only. No missing or failed run is converted to zero. Objective summaries use feasible "
              "results only; the remaining metrics use actual completed outputs, including infeasible QAOA samples. "
              "Critical satisfaction is summarized as a fraction from 0 to 1 (the scenario table shows percentages).", ""]
    for method in ("greedy", "exact", "qaoa"):
        method_summary = summary["methods"][method]
        lines += [f"### {method.title()}", "",
                  f"Completed statuses: `{method_summary['status_counts']}`; feasible: "
                  f"`{method_summary['feasible_count']}`; infeasible: `{method_summary['infeasible_count']}`.", "",
                  "| Metric | n | Mean | Median | Min | Max | Std. dev. (population) |", "|---|---:|---:|---:|---:|---:|---:|"]
        for metric, label in METRICS:
            values = method_summary["metrics"][metric]
            fmt = lambda value: "—" if value is None else f"{value:.6g}"
            lines.append(f"| {label} | {values['count']} | {fmt(values['mean'])} | {fmt(values['median'])} | {fmt(values['minimum'])} | {fmt(values['maximum'])} | {fmt(values['standard_deviation_population'])} |")
        lines.append("")
    lines += ["## Interpretation", "",
              "These measurements describe only this small synthetic instance set and this local software environment. "
              "Greedy and Exact outputs can be compared directly where both completed; Exact serves as an optimum "
              "certificate only for cases it actually solved within its cap. QAOA uses a hybrid classical optimizer "
              "and local simulator, so its runtime includes classical optimization and simulator work. Finite shots "
              "can yield infeasible samples; those remain visible. The sample is too small and the execution setup "
              "too limited to support broad performance claims.", "",
              "## Limitations", "",
              "- Scenarios contain only one bank, one hospital, and one blood-group label, and use synthetic values. They are not representative of operational networks.",
              "- Compatibility is a simplified prototype assumption, not a complete clinical compatibility model.",
              "- Local simulator results and wall-clock timings depend on package versions, machine load, and platform.",
              "- The QAOA candidate is a measured sample, not an optimality proof. Infeasible samples are not repaired.",
              "- The fixed seed supports repeatability but does not guarantee bit-identical results across environments.", "",
              "## Quantum advantage statement", "",
              "**These results do not demonstrate quantum advantage.** They are small, local simulator experiments with a hybrid classical-quantum workflow. No comparison establishes an advantage over classical optimization in runtime, quality, scale, or energy use.", "",
              "## Data integrity", "",
              "Raw result values are preserved in the linked JSON output. This report contains derived descriptive statistics only; it does not overwrite or edit raw results.", ""]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("results", type=Path, help="raw experiment JSON file")
    parser.add_argument("--report", type=Path, default=ROOT / "docs" / "EXPERIMENT_RESULTS.md")
    parser.add_argument("--summary-json", type=Path, help="optional machine-readable statistics output")
    args = parser.parse_args()
    path = args.results if args.results.is_absolute() else ROOT / args.results
    experiment = json.loads(path.read_text(encoding="utf-8"))
    summary = summarize(experiment)
    try:
        source = str(path.relative_to(ROOT))
    except ValueError:
        source = str(path)
    report = render_report(experiment, summary, source)
    report_path = args.report if args.report.is_absolute() else ROOT / args.report
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report, encoding="utf-8")
    if args.summary_json:
        summary_path = args.summary_json if args.summary_json.is_absolute() else ROOT / args.summary_json
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"Analyzed {len(experiment['results'])} raw result rows from {path}")
    print(f"Wrote {report_path}")


if __name__ == "__main__":
    main()
