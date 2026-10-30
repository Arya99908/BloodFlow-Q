"""Build a compact chart-data artifact from the saved Experiment Reports data.

This script only summarizes existing records. It does not run solvers or invent
measurements. Study families remain separate because their protocols differ.
Run from the repository root with:

    python3 experiments/build_comparative_evidence.py
"""

from __future__ import annotations

import hashlib
import json
import statistics
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public"
OUTPUT = PUBLIC / "comparative-evidence.json"


def read_json(name: str) -> tuple[dict[str, Any], str]:
    path = PUBLIC / name
    raw = path.read_bytes()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def mean(values: list[float]) -> float | None:
    return statistics.fmean(values) if values else None


def summarize_full_review(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "study_date": data.get("study_date"),
        "status": data.get("status"),
        "counts": data.get("counts", {}),
        "methods": data.get("methods", []),
        "notes": data.get("notes", []),
        "scope": "Primary full-review and ablation summary; method case counts vary.",
    }


def summarize_warm_paired(data: dict[str, Any]) -> dict[str, Any]:
    rows = data.get("results", [])
    scenarios = data.get("summary", {}).get("paired_scenario_summary", [])
    variants = []
    for variant in ("standard", "lp_warm_start"):
        group = [row for row in rows if row.get("variant") == variant]
        completed = [row for row in group if row.get("status") == "completed"]
        rates = [row["feasible_shot_rate"] for row in completed if isinstance(row.get("feasible_shot_rate"), (int, float))]
        runtimes = [row["runtime_seconds"] for row in group if isinstance(row.get("runtime_seconds"), (int, float))]
        total_shots = sum(row.get("shots", 0) for row in completed if isinstance(row.get("shots"), int))
        feasible_shots = sum(row.get("feasible_shots", 0) for row in completed if isinstance(row.get("feasible_shots"), int))
        variants.append({
            "variant": variant,
            "attempts": len(group),
            "completed": len(completed),
            "mean_feasible_shot_rate": mean(rates),
            "median_runtime_seconds": statistics.median(runtimes) if runtimes else None,
            "exact_optimum_runs": sum(row.get("known_optimum_found") is True for row in completed),
            "feasible_shots": feasible_shots,
            "total_shots": total_shots,
        })
    return {
        "created_at_utc": data.get("configuration", {}).get("created_at_utc"),
        "protocol": data.get("configuration", {}).get("invocation", {}),
        "run_count": data.get("summary", {}).get("run_count"),
        "completed_runs": data.get("summary", {}).get("completed_runs"),
        "paired_seed_count": data.get("summary", {}).get("paired_seed_count"),
        "scenario_count": data.get("summary", {}).get("scenario_count"),
        "variants": variants,
        "scenarios": scenarios,
        "status_counts": dict(Counter(row.get("status", "not_recorded") for row in rows)),
        "scope": "Six synthetic scenarios, paired seeds and fixed p=1/64-shot protocol. Separate from other studies.",
    }


def summarize_legacy(data: dict[str, Any]) -> dict[str, Any]:
    rows = data.get("results", [])
    methods = []
    method_order = ["greedy", "exact", "milp", "classical_multistart", "qaoa", "hybrid_qaoa_local_search"]
    for method in method_order:
        group = [row for row in rows if row.get("method") == method]
        if not group:
            continue
        # The website's report treats an explicitly infeasible sampled QAOA
        # candidate as an evaluated run, while skipped seeds remain skipped.
        evaluated = [row for row in group if row.get("status") in {"completed", "infeasible"}]
        feasible = [row for row in evaluated if row.get("feasibility") is True]
        exact = [row for row in feasible if isinstance(row.get("approximation_gap"), (int, float)) and row["approximation_gap"] == 0]
        runtime_values = [row["runtime_seconds"] for row in group if isinstance(row.get("runtime_seconds"), (int, float))]
        methods.append({
            "method": method,
            "attempts": len(group),
            "evaluated": len(evaluated),
            "feasible": len(feasible),
            "infeasible": sum(row.get("status") == "infeasible" or (row.get("status") == "completed" and row.get("feasibility") is False) for row in group),
            "skipped": sum(str(row.get("status", "")).startswith("skipped") for row in group),
            "exact_reference_matches": len(exact),
            "mean_runtime_seconds": mean(runtime_values),
            "mean_feasible_objective": mean([row["objective"] for row in feasible if isinstance(row.get("objective"), (int, float))]),
        })
    return {
        "created_at_utc": data.get("configuration", {}).get("created_at_utc"),
        "invocation": data.get("configuration", {}).get("invocation", {}),
        "attempts": len(rows),
        "status_counts": dict(Counter(row.get("status", "not_recorded") for row in rows)),
        "methods": methods,
        "scope": "Historical confirmatory experiment; do not pool with October 24 or warm-start paired studies.",
    }


def main() -> None:
    full, full_hash = read_json("full-review-study.json")
    warm, warm_hash = read_json("warm-qaoa-paired-20261022.json")
    legacy, legacy_hash = read_json("quantum-value-study.json")
    artifact = {
        "schema_version": 1,
        "generated_from_saved_experiment_reports": True,
        "interpretation": "Recorded synthetic local-simulator experiments only; no quantum advantage is established.",
        "sources": {
            "full-review-study.json": full_hash,
            "warm-qaoa-paired-20261022.json": warm_hash,
            "quantum-value-study.json": legacy_hash,
        },
        "datasets": {
            "full_review": summarize_full_review(full),
            "warm_paired": summarize_warm_paired(warm),
            "legacy": summarize_legacy(legacy),
        },
    }
    OUTPUT.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")
    print(f"Dataset run counts: full={full['counts']}; warm={warm['summary']['run_count']}; legacy={len(legacy['results'])}")


if __name__ == "__main__":
    main()
