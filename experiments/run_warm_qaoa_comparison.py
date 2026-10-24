"""Run paired standard and LP warm-start QAOA runs on fixed synthetic cases.

Each seed uses the same p, optimizer, iteration cap, restarts, shots, and
simulator seed for both variants. Every raw measured string is independently
decoded and validated; infeasible results remain in the output.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import random
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from statistics import mean, median
from time import perf_counter
from typing import Any

from experiments.run_experiments import ROOT, build_scenarios, _experiment_output_paths, _write_experiment_files
from backend.data_loader import load_data
from backend.demo_scenarios import build_demo_case
from backend.scenario_factory import scenario_from_loaded_data
from emergency.simulator import apply_emergency_events
from optimization.decoder import evaluate_quantum_solution
from optimization.exact import ExactSolver, ExactSolverConfig, ExactSolverLimitError
from optimization.greedy import GreedyAllocator
from optimization.objective import ObjectiveConfig
from optimization.constraints import validate_allocation
from quantum.qaoa_solver import QAOAConfig, QAOASolver
from quantum.qubo import QUBOPenaltyConfig, build_qubo


def _version(name: str) -> str | None:
    try:
        return version(name)
    except PackageNotFoundError:
        return None


def _candidate_audit(qubo, bitstring: str, count: int) -> dict[str, Any]:
    evaluation = evaluate_quantum_solution(qubo, bitstring)
    return {
        "bitstring": bitstring,
        "shots": count,
        "feasible": evaluation.feasibility,
        "objective": evaluation.total_objective,
        "violations": list(evaluation.violations),
        "allocation": [asdict(row) for row in evaluation.decoded_allocation],
        "unmet_demand": [
            {"hospital_id": hospital, "blood_group": group, "units": value}
            for (hospital, group), value in sorted(evaluation.unmet_demand.items())
        ],
    }


def _paired_rate_summaries(records: list[dict[str, Any]], scenarios: list[str]) -> list[dict[str, Any]]:
    """Summarize per-seed feasible-shot rates and a paired bootstrap difference CI."""
    summaries = []
    for scenario in scenarios:
        by_seed: dict[int, dict[str, dict[str, Any]]] = {}
        for row in records:
            if row["scenario_id"] == scenario and row["status"] == "completed":
                by_seed.setdefault(row["seed"], {})[row["variant"]] = row
        standard = [pair["standard"]["feasible_shot_rate"] for _, pair in sorted(by_seed.items())
                    if "standard" in pair]
        warm = []
        paired_differences = []
        for pair in by_seed.values():
            if "standard" in pair and "lp_warm_start" in pair:
                standard_row, warm_row = pair["standard"], pair["lp_warm_start"]
                warm.append(warm_row["feasible_shot_rate"])
                paired_differences.append(warm_row["feasible_shot_rate"] - standard_row["feasible_shot_rate"])
        rng = random.Random(20261022)
        bootstrap_means = sorted(
            mean(rng.choices(paired_differences, k=len(paired_differences)))
            for _ in range(10_000)
        ) if paired_differences else []
        low = bootstrap_means[int(0.025 * (len(bootstrap_means) - 1))] if bootstrap_means else None
        high = bootstrap_means[int(0.975 * (len(bootstrap_means) - 1))] if bootstrap_means else None
        summaries.append({
            "scenario_id": scenario,
            "paired_completed_seeds": len(paired_differences),
            "standard_mean_feasible_shot_rate": mean(standard) if standard else None,
            "warm_start_mean_feasible_shot_rate": mean(warm) if warm else None,
            "mean_paired_difference_warm_minus_standard": mean(paired_differences) if paired_differences else None,
            "paired_difference_bootstrap_95_percentile_ci": [low, high] if bootstrap_means else None,
            "seeds_warm_better": sum(value > 0 for value in paired_differences),
            "seeds_tied": sum(value == 0 for value in paired_differences),
            "seeds_warm_worse": sum(value < 0 for value in paired_differences),
            "standard_median_runtime_seconds": median(
                row["runtime_seconds"] for row in records
                if row["scenario_id"] == scenario and row["variant"] == "standard"
                and row["status"] == "completed"
            ) if standard else None,
            "warm_start_median_runtime_seconds": median(
                row["runtime_seconds"] for row in records
                if row["scenario_id"] == scenario and row["variant"] == "lp_warm_start"
                and row["status"] == "completed"
            ) if warm else None,
            "standard_optimal_runs": sum(row.get("known_optimum_found") is True for row in records
                                         if row["scenario_id"] == scenario and row["variant"] == "standard"),
            "warm_start_optimal_runs": sum(row.get("known_optimum_found") is True for row in records
                                           if row["scenario_id"] == scenario and row["variant"] == "lp_warm_start"),
        })
    return summaries


def run_paired(*, seeds: tuple[int, ...], count: int, p: int, shots: int,
               max_iterations: int, restarts: int, epsilon: float,
               optimizer: str, normalize_cost: bool) -> dict[str, Any]:
    scenarios = list(build_scenarios(min(count, 5)))
    if count == 6:
        base = scenario_from_loaded_data(load_data(), "warm_qaoa_emergency_source")
        emergency_case, event = build_demo_case(base, "emergency_demand_spike")
        scenarios.append(apply_emergency_events(emergency_case, [event]))
    objective = ObjectiveConfig(10.0, 5.0, 1.0, 0.1, 0.0)
    penalties = QUBOPenaltyConfig(10_000.0, 10_000.0)
    records: list[dict[str, Any]] = []
    pairs: list[dict[str, Any]] = []
    sizes: dict[str, Any] = {}

    for scenario in scenarios:
        qubo = build_qubo(scenario, objective, penalties)
        exact_result = None
        exact_reference_status = "unavailable"
        try:
            exact_result = ExactSolver(ExactSolverConfig(50_000)).solve(scenario, objective)
            exact_reference_status = "completed_independently_validated"
        except ExactSolverLimitError:
            exact_reference_status = "skipped_too_large"
        except Exception as error:
            exact_reference_status = f"error:{type(error).__name__}"
        exact_reference = (
            float(exact_result.objective_value)
            if exact_result is not None and exact_result.feasibility_report.get("feasible")
            else None
        )
        sizes[scenario.id] = {
            "blood_banks": len(scenario.blood_banks),
            "hospitals": len(scenario.hospitals),
            "blood_groups": len(scenario.blood_groups),
            "allocation_variables": len(scenario.allocation_variables()),
            "qubo_variables_qubits": qubo.variable_count,
            "inventory_units": sum(sum(bank.inventory.values()) for bank in scenario.blood_banks),
            "demand_units": sum(sum(h.demand.values()) for h in scenario.hospitals),
            "exact_reference_status": exact_reference_status,
            "exact_reference_objective": exact_reference,
            "exact_examined_candidates": exact_result.examined_candidate_count if exact_result else None,
        }
        for seed in seeds:
            pair_rows: dict[str, dict[str, Any]] = {}
            for variant, warm in (("standard", False), ("lp_warm_start", True)):
                started = perf_counter()
                row: dict[str, Any] = {
                    "scenario_id": scenario.id,
                    "seed": seed,
                    "variant": variant,
                    "status": "error",
                    "objective": None,
                    "feasibility": None,
                    "runtime_seconds": None,
                    "shots": shots,
                    "feasible_shots": None,
                    "feasible_shot_rate": None,
                    "best_feasible_objective": None,
                    "feasible_objective_observations": [],
                    "feasible_objective_median": None,
                    "feasible_objective_shot_distribution": [],
                    "unique_feasible_solutions": 0,
                    "infeasible_shots": None,
                    "optimality_gap": None,
                    "known_optimum_found": None,
                    "seed_source": None,
                    "seed_objective": None,
                    "seed_feasibility": None,
                    "candidate_audit": [],
                    "counts": {},
                    "error": None,
                }
                try:
                    config = QAOAConfig(
                        p=p, shots=shots, optimizer=optimizer,
                        max_iterations=max_iterations, seed=seed,
                        max_qubits=16, warm_start=warm,
                        warm_start_epsilon=epsilon,
                        normalize_cost=normalize_cost, restarts=restarts,
                    )
                    sample = QAOASolver(config).solve(qubo)
                    audit = [
                        _candidate_audit(qubo, bitstring, count)
                        for bitstring, count in sorted(sample.counts.items())
                    ]
                    feasible_shots = sum(item["shots"] for item in audit if item["feasible"])
                    feasible = [item["objective"] for item in audit if item["feasible"]]
                    info = dict(sample.optimizer_information)
                    best = min(feasible) if feasible else None
                    feasible_shot_objectives = [
                        item["objective"] for item in audit if item["feasible"]
                        for _ in range(item["shots"])
                    ]
                    best_gap = ((best - exact_reference) / abs(exact_reference)
                                if best is not None and exact_reference not in (None, 0.0)
                                else (0.0 if best == exact_reference and best is not None else None))
                    best_validation = next((item for item in audit if item["feasible"] and item["objective"] == best), None)
                    row.update({
                        "status": "completed",
                        "objective": best,
                        "feasibility": best is not None,
                        "runtime_seconds": sample.runtime_seconds,
                        "feasible_shots": feasible_shots,
                        "feasible_shot_rate": feasible_shots / shots,
                        "best_feasible_objective": best,
                        "feasible_objective_observations": [item["objective"] for item in audit if item["feasible"]],
                        "feasible_objective_median": median(feasible_shot_objectives) if feasible_shot_objectives else None,
                        "feasible_objective_shot_distribution": feasible_shot_objectives,
                        "unique_feasible_solutions": len({
                            json.dumps([item["allocation"], item["unmet_demand"]], sort_keys=True)
                            for item in audit if item["feasible"]
                        }),
                        "infeasible_shots": shots - feasible_shots,
                        "exact_reference_status": exact_reference_status,
                        "exact_reference_objective": exact_reference,
                        "optimality_gap": best_gap,
                        "known_optimum_found": (best == exact_reference) if best is not None and exact_reference is not None else None,
                        "best_feasible_allocation": best_validation["allocation"] if best_validation else None,
                        "best_feasible_unmet_demand": best_validation["unmet_demand"] if best_validation else None,
                        "seed_source": info.get("seed_source", "uniform_initialization"),
                        "seed_objective": info.get("seed_objective"),
                        "seed_feasibility": info.get("seed_feasibility", "not_applicable"),
                        "seed_preprocessing_seconds": info.get("seed_preprocessing_seconds", 0.0),
                        "candidate_audit": audit,
                        "counts": dict(sample.counts),
                        "measured_mean_energy": sample.measured_mean_energy,
                        "best_measured_energy": sample.objective_value,
                        "parameter_count": info.get("parameter_count"),
                        "circuit_depth": info.get("circuit_depth"),
                        "two_qubit_gate_count": info.get("two_qubit_gate_count"),
                        "optimizer_information": info,
                    })
                except Exception as error:
                    row["error"] = f"{type(error).__name__}: {error}"
                    row["runtime_seconds"] = perf_counter() - started
                records.append(row)
                pair_rows[variant] = row
            pair_rows["paired_comparison"] = {
                "same_seed_and_budget": True,
                "both_completed": all(pair_rows.get(name, {}).get("status") == "completed"
                                      for name in ("standard", "lp_warm_start")),
                "same_feasible_objective": (
                    pair_rows.get("standard", {}).get("best_feasible_objective")
                    == pair_rows.get("lp_warm_start", {}).get("best_feasible_objective")
                    if all(pair_rows.get(name, {}).get("status") == "completed"
                           for name in ("standard", "lp_warm_start")) else None
                ),
            }
            pairs.append({"scenario_id": scenario.id, "seed": seed,
                          **pair_rows["paired_comparison"]})

    tracked = [ROOT / "experiments" / "run_warm_qaoa_comparison.py",
               ROOT / "quantum" / "qaoa_solver.py", ROOT / "quantum" / "qubo.py",
               ROOT / "optimization" / "decoder.py", ROOT / "optimization" / "constraints.py",
               ROOT / "optimization" / "milp.py", ROOT / "backend" / "demo_scenarios.py",
               ROOT / "emergency" / "simulator.py", ROOT / "data" / "blood_banks.json",
               ROOT / "data" / "hospitals.json", ROOT / "data" / "routes.json",
               ROOT / "data" / "compatibility.json"]
    hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
              for path in tracked}
    return {
        "configuration": {
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "invocation": {"module": "experiments.run_warm_qaoa_comparison", "arguments": sys.argv[1:]},
            "source_files_sha256": hashes,
            "scenario_source": "five fixed compact cases from the experiment harness plus the actual backend emergency demand-spike event",
            "scenario_sizes": sizes,
            "scenarios": [scenario.id for scenario in scenarios],
            "instances": {
                scenario.id: {
                    "synthetic": scenario.synthetic,
                    "blood_groups": list(scenario.blood_groups),
                    "blood_banks": [asdict(bank) for bank in scenario.blood_banks],
                    "hospitals": [
                        {"id": hospital.id, "name": hospital.name,
                         "location_id": hospital.location_id, "demand": dict(hospital.demand),
                         "urgency": {group: asdict(value) for group, value in hospital.urgency.items()}}
                        for hospital in scenario.hospitals
                    ],
                    "routes": [asdict(route) for route in scenario.routes],
                    "compatibility": [
                        {"donor_group": donor, "recipient_group": recipient, "allowed": allowed}
                        for (donor, recipient), allowed in scenario.compatibility.items()
                    ],
                } for scenario in scenarios
            },
            "paired_seeds": list(seeds),
            "pairing": "each standard/warm pair shares simulator seed and all run budgets",
            "qaoa": {"p": p, "shots": shots, "optimizer": optimizer,
                     "max_iterations": max_iterations, "restarts": restarts,
                     "normalize_cost": normalize_cost, "warm_start_epsilon": epsilon,
                     "max_qubits": 16},
            "warm_start": {
                "source": "SciPy HiGHS continuous LP relaxation",
                "fallback": "independently validated deterministic greedy allocation; uniform state if unavailable",
                "mixer": "product of single-qubit rotations around prepared-state axes",
                "feasibility_guarantee": False,
                "measured_candidate_policy": "raw measured bitstrings; no repair; decoder plus independent operational validator",
            },
            "objective_weights": asdict(objective),
            "qubo_penalty_weights": asdict(penalties),
            "environment": {"python": sys.version.split()[0], "platform": platform.platform(),
                            "packages": {name: _version(name) for name in
                                         ("qiskit", "qiskit-aer", "numpy", "scipy")}},
        },
        "summary": {"paired_seed_count": len(seeds), "scenario_count": len(scenarios),
                    "run_count": len(records), "completed_runs": sum(r["status"] == "completed" for r in records),
                    "paired_comparisons": pairs,
                    "paired_scenario_summary": _paired_rate_summaries(records, [scenario.id for scenario in scenarios])},
        "results": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenarios", type=int, default=6, choices=range(1, 7))
    parser.add_argument("--seeds", type=int, default=10, choices=range(10, 101))
    parser.add_argument("--seed-start", type=int, default=301)
    parser.add_argument("--p", type=int, default=1, choices=range(1, 4))
    parser.add_argument("--shots", type=int, default=128, choices=range(32, 1025))
    parser.add_argument("--optimizer", choices=("COBYLA", "Nelder-Mead", "Powell"), default="COBYLA")
    parser.add_argument("--max-iterations", type=int, default=10, choices=range(1, 101))
    parser.add_argument("--restarts", type=int, default=1, choices=range(1, 11))
    parser.add_argument("--epsilon", type=float, default=0.25)
    parser.add_argument("--no-normalize-cost", action="store_true")
    parser.add_argument("--run-id", help="safe output filename suffix; defaults to UTC timestamp")
    args = parser.parse_args()
    if not 0.0 < args.epsilon < 0.5:
        parser.error("--epsilon must be strictly between 0 and 0.5")
    run_id = args.run_id or datetime.now(timezone.utc).strftime("warm-qaoa-%Y%m%dT%H%M%SZ")
    try:
        results_path, config_path = _experiment_output_paths(run_id)
    except (ValueError, FileExistsError) as error:
        parser.error(str(error))
    experiment = run_paired(
        seeds=tuple(range(args.seed_start, args.seed_start + args.seeds)),
        count=args.scenarios, p=args.p, shots=args.shots,
        max_iterations=args.max_iterations, restarts=args.restarts,
        epsilon=args.epsilon, optimizer=args.optimizer,
        normalize_cost=not args.no_normalize_cost,
    )
    _write_experiment_files(results_path, config_path, experiment)
    print(f"Wrote paired raw results: {results_path.relative_to(ROOT)}")
    print(f"Wrote reproducibility configuration: {config_path.relative_to(ROOT)}")
    for row in experiment["results"]:
        print(f"{row['scenario_id']:<24} seed={row['seed']:<4} {row['variant']:<13} "
              f"{row['status']:<10} objective={row['objective']} feasible_shots={row['feasible_shot_rate']} "
              f"runtime={row['runtime_seconds']}s")


if __name__ == "__main__":
    main()
