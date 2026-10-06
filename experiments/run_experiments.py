"""Run a bounded suite of synthetic cases through Greedy, Exact, and QAOA.

Example (from the project root)::

    .venv/bin/python -m experiments.run_experiments --scenarios 5 --shots 128

Every output file contains real solver responses. Failed or unavailable
methods are stored with an error status and null metrics, never imputed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from time import perf_counter
from typing import Any

from backend.data_loader import load_data
from backend.scenario_factory import scenario_from_loaded_data
from optimization.constraints import validate_allocation
from optimization.decoder import evaluate_quantum_solution
from optimization.exact import ExactSolver, ExactSolverConfig, ExactSolverLimitError
from optimization.greedy import GreedyAllocator
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig
from quantum.qubo import QUBOPenaltyConfig, build_qubo
try:
    from quantum.qaoa_solver import QAOAConfig, QAOASolver
    _QAOA_IMPORT_ERROR: Exception | None = None
except Exception as error:  # Classical runs and raw QAOA error recording remain usable.
    QAOAConfig = None  # type: ignore[assignment,misc]
    QAOASolver = None  # type: ignore[assignment,misc]
    _QAOA_IMPORT_ERROR = error

ROOT = Path(__file__).resolve().parents[1]


def build_scenarios(count: int = 5) -> tuple[Scenario, ...]:
    """Create repeatable tiny scenarios using only bundled fictional records.

    Scenario dimensions are intentionally fixed at one bank, one hospital,
    one group. Quantities and route features vary in a small hand-authored
    matrix, keeping Exact and the 16-qubit local simulator within scope.
    """
    if not 1 <= count <= 5:
        raise ValueError("scenario count must be from 1 to 5")
    bundled = scenario_from_loaded_data(load_data(), "experiment_source")
    base_bank = next(bank for bank in bundled.blood_banks if bank.id == "bank_a")
    base_hospital = next(h for h in bundled.hospitals if h.id == "hospital_1")
    base_route = next(r for r in bundled.routes if r.source == base_bank.id and r.destination == base_hospital.id)
    group = "O"
    specifications = (
        ("normal_reference", 12, 4, "high", "available", 18.0, 4.5),
        ("inventory_shortage", 2, 6, "critical", "available", 18.0, 4.5),
        ("demand_below_inventory", 8, 3, "medium", "available", 18.0, 4.5),
        ("transport_disruption", 5, 4, "high", "blocked", 18.0, 4.5),
        ("critical_shortage", 4, 7, "critical", "available", 31.0, 7.0),
    )
    scenarios: list[Scenario] = []
    for name, inventory, demand, urgency, status, travel, cost in specifications[:count]:
        bank = BloodBank(base_bank.id, base_bank.name, base_bank.location_id, {group: inventory})
        hospital = Hospital(
            base_hospital.id, base_hospital.name, base_hospital.location_id,
            {group: demand}, {group: Urgency(urgency, base_hospital.urgency[group].priority_weight)},
        )
        route = Route(base_route.source, base_route.destination, travel, base_route.distance_km,
                      cost, status)
        scenarios.append(Scenario(
            id=name, blood_groups=(group,), blood_banks=(bank,), hospitals=(hospital,),
            routes=(route,), compatibility={(group, group): bundled.compatibility[(group, group)]},
            synthetic=True,
        ))
    return tuple(scenarios)


def _scenario_size(scenario: Scenario) -> dict[str, int]:
    return {
        "blood_banks": len(scenario.blood_banks), "hospitals": len(scenario.hospitals),
        "blood_groups": len(scenario.blood_groups),
        "allocation_decision_variables": len(scenario.allocation_variables()),
        "inventory_units": sum(sum(bank.inventory.values()) for bank in scenario.blood_banks),
        "demand_units": sum(sum(h.demand.values()) for h in scenario.hospitals),
    }


def _critical_satisfaction(scenario: Scenario, result) -> float | None:
    total = sum(h.demand[g] for h in scenario.hospitals for g in h.demand
                if h.urgency[g].category in {"high", "critical"})
    if total == 0:
        return None
    critical_unmet = result.objective_breakdown.critical_unmet_units
    return max(0, total - critical_unmet) / total


def _record(scenario: Scenario, method: str, result: Any, validation: dict[str, Any], runtime: float,
            objective_basis: str = "classical objective on validated allocation") -> dict[str, Any]:
    objective = result.objective_breakdown
    shipped = sum(row.quantity for row in result.allocation)
    return {
        "scenario_id": scenario.id, "method": method,
        "status": "completed" if validation["feasible"] else "infeasible",
        "objective": objective.total_objective,
        "critical_satisfaction": _critical_satisfaction(scenario, result),
        "critical_unmet_demand": objective.critical_unmet_units,
        "total_unmet_demand": objective.total_unmet_units,
        "transport_cost": objective.transportation_cost,
        "average_travel_time": objective.transportation_time / shipped if shipped else None,
        "feasibility": bool(validation["feasible"]),
        "runtime_seconds": runtime,
        "objective_basis": objective_basis,
        "validation": validation,
        "allocation": [asdict(row) for row in result.allocation],
        "unmet_demand": [
            {"hospital_id": hospital, "blood_group": group, "units": amount}
            for (hospital, group), amount in sorted(result.unmet_demand.items())
        ],
    }


def run_experiments(*, count: int, seed: int, p: int, shots: int, optimizer: str,
                    max_iterations: int, penalty_weight: float, max_exact_states: int,
                    critical_weight: float = 10.0, unmet_weight: float = 5.0,
                    transport_cost_weight: float = 1.0, transport_time_weight: float = 0.1,
                    secondary_penalty_weight: float = 0.0) -> dict[str, Any]:
    scenarios = build_scenarios(count)
    objective = ObjectiveConfig(critical_weight, unmet_weight, transport_cost_weight,
                                transport_time_weight, secondary_penalty_weight)
    penalties = QUBOPenaltyConfig(penalty_weight, penalty_weight)
    qaoa_settings = {"p": p, "shots": shots, "optimizer": optimizer,
                     "max_iterations": max_iterations, "seed": seed,
                     "max_qubits": 16}
    records: list[dict[str, Any]] = []
    sizes = {scenario.id: _scenario_size(scenario) for scenario in scenarios}

    for scenario in scenarios:
        scenario_records: dict[str, dict[str, Any]] = {}
        # Classical baselines are timed separately. Their returned candidate
        # is checked again by the shared independent validator.
        for name, solver in (("greedy", GreedyAllocator()),
                             ("exact", ExactSolver(ExactSolverConfig(max_exact_states)))):
            started = perf_counter()
            try:
                result = solver.solve(scenario, objective)
                validation = validate_allocation(scenario, result.allocation, result.unmet_demand)
                item = _record(scenario, name, result, validation, perf_counter() - started)
            except ExactSolverLimitError as error:
                item = {"scenario_id": scenario.id, "method": name, "status": "skipped_too_large",
                        "objective": None, "critical_satisfaction": None,
                        "critical_unmet_demand": None, "total_unmet_demand": None,
                        "transport_cost": None, "average_travel_time": None, "feasibility": None,
                        "runtime_seconds": perf_counter() - started, "detail": str(error),
                        "validation": None, "allocation": [], "unmet_demand": []}
            scenario_records[name] = item

        started = perf_counter()
        try:
            if _QAOA_IMPORT_ERROR is not None or QAOAConfig is None or QAOASolver is None:
                raise RuntimeError(f"QAOA dependency import failed: {_QAOA_IMPORT_ERROR}")
            qubo = build_qubo(scenario, objective, penalties)
            sample = QAOASolver(QAOAConfig(**qaoa_settings)).solve(qubo)
            evaluated = evaluate_quantum_solution(qubo, sample.best_bitstring)
            # The evaluation contains an independent validator report. Run the
            # validator once more directly for the raw experiment record.
            validation = validate_allocation(scenario, evaluated.decoded_allocation,
                                             evaluated.unmet_demand)
            scenario_records["qaoa"] = _record(
                scenario, "qaoa", evaluated, validation, perf_counter() - started,
                evaluated.objective_basis,
            ) | {
                "qubo_variable_count": qubo.variable_count,
                "best_measured_bitstring": sample.best_bitstring,
                "counts": dict(sample.counts),
                "measured_energy": sample.objective_value,
                "qaoa_depth": sample.qaoa_depth,
                "shots": sample.number_of_shots,
                "optimizer_information": dict(sample.optimizer_information),
                "validator_violations": list(evaluated.violations),
            }
        except Exception as error:
            # Preserve the actual failure and mark every result metric missing.
            # A measured QAOA claim is made only after a real sample exists.
            scenario_records["qaoa"] = {
                "scenario_id": scenario.id, "method": "qaoa", "status": "error",
                "detail": f"{type(error).__name__}: {error}", "objective": None,
                "critical_satisfaction": None, "critical_unmet_demand": None,
                "total_unmet_demand": None, "transport_cost": None,
                "average_travel_time": None, "feasibility": None,
                "runtime_seconds": perf_counter() - started, "validation": None,
                "allocation": [], "unmet_demand": [],
            }

        exact = scenario_records["exact"]
        exact_value = exact.get("objective") if exact.get("status") == "completed" and exact.get("feasibility") else None
        for name in ("greedy", "qaoa"):
            item = scenario_records[name]
            if item.get("status") == "completed" and item.get("feasibility") and exact_value is not None:
                if exact_value == 0:
                    item["approximation_gap"] = 0.0 if item["objective"] == 0 else None
                    item["approximation_gap_status"] = ("defined: both objectives are zero" if item["objective"] == 0
                                                         else "undefined: exact objective is zero")
                else:
                    item["approximation_gap"] = (item["objective"] - exact_value) / abs(exact_value)
                    item["approximation_gap_status"] = "defined"
            else:
                item["approximation_gap"] = None
                item["approximation_gap_status"] = "unavailable: feasible exact and method results are required"
        records.extend(scenario_records[method] for method in ("greedy", "exact", "qaoa"))

    tracked_inputs = (ROOT / "data" / "blood_banks.json", ROOT / "data" / "hospitals.json",
                      ROOT / "data" / "routes.json", ROOT / "data" / "compatibility.json")
    tracked_inputs += (Path(__file__).resolve(),)
    source_hashes = {
        str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in tracked_inputs
    }
    config = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "invocation": {"module": "experiments.run_experiments", "arguments": sys.argv[1:]},
        "source_files_sha256": source_hashes,
        "scenario_source": "fixed compact templates using fictional values from data/*.json",
        "scenario_sizes": sizes,
        "scenarios": {
            scenario.id: {
                "synthetic": scenario.synthetic,
                "blood_groups": list(scenario.blood_groups),
                "blood_banks": [asdict(bank) for bank in scenario.blood_banks],
                "hospitals": [
                    {"id": hospital.id, "name": hospital.name,
                     "location_id": hospital.location_id,
                     "demand": dict(hospital.demand),
                     "urgency": {group: asdict(value)
                                 for group, value in hospital.urgency.items()}}
                    for hospital in scenario.hospitals
                ],
                "routes": [asdict(route) for route in scenario.routes],
                "compatibility": [
                    {"donor_group": donor, "recipient_group": recipient, "allowed": allowed}
                    for (donor, recipient), allowed in scenario.compatibility.items()
                ],
            }
            for scenario in scenarios
        },
        "scenario_count": len(scenarios),
        "objective_weights": asdict(objective),
        "qaoa": qaoa_settings,
        "qubo_penalty_weights": asdict(penalties),
        "exact_max_candidate_states": max_exact_states,
        "environment": {
            "python": sys.version.split()[0], "platform": platform.platform(),
            "packages": {name: _package_version(name) for name in
                         ("qiskit", "qiskit-aer", "numpy", "scipy")},
        },
        "limits": {"scenario_count_max": 5, "qaoa_max_qubits": 16,
                   "max_inventory_units_per_bank": 12, "max_demand_units_per_hospital": 7},
    }
    return {"configuration": config, "results": records}


def _package_version(name: str) -> str | None:
    try:
        return version(name)
    except PackageNotFoundError:
        return None


def _experiment_output_paths(run_id: str) -> tuple[Path, Path]:
    """Return safe output paths for a run without touching existing results."""
    if not run_id.replace("-", "").replace("_", "").isalnum():
        raise ValueError("run id may contain only letters, numbers, hyphens, and underscores")
    results_dir = ROOT / "experiments" / "results"
    config_dir = ROOT / "experiments" / "configurations"
    results_dir.mkdir(parents=True, exist_ok=True)
    config_dir.mkdir(parents=True, exist_ok=True)
    results_path = results_dir / f"{run_id}.json"
    config_path = config_dir / f"{run_id}.json"
    existing = [path for path in (results_path, config_path) if path.exists()]
    if existing:
        names = ", ".join(str(path.relative_to(ROOT)) for path in existing)
        raise FileExistsError(
            f"experiment run id {run_id!r} already has output file(s): {names}; "
            "choose a new --run-id to preserve prior results"
        )
    return results_path, config_path


def _write_experiment_files(
    results_path: Path, config_path: Path, experiment: dict[str, Any]
) -> None:
    """Write a new result/config pair without replacing existing files.

    Exclusive file creation is a second collision check in case another run
    claims the same ID after path validation. If writing either member fails,
    remove only files created by this call so a partial pair is not left behind.
    """
    existing = [path for path in (results_path, config_path) if path.exists()]
    if existing:
        raise FileExistsError(
            "experiment output already exists; choose a new --run-id: "
            + ", ".join(str(path) for path in existing)
        )
    payloads = (
        (results_path, json.dumps(experiment, indent=2) + "\n"),
        (config_path, json.dumps(experiment["configuration"], indent=2) + "\n"),
    )
    created: list[Path] = []
    try:
        for path, payload in payloads:
            with path.open("x", encoding="utf-8") as output:
                created.append(path)
                output.write(payload)
    except Exception:
        for path in created:
            path.unlink(missing_ok=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenarios", type=int, default=5, choices=range(1, 6))
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--p", type=int, default=1, choices=range(1, 4))
    parser.add_argument("--shots", type=int, default=128, choices=range(32, 1025))
    parser.add_argument("--optimizer", choices=("COBYLA", "Nelder-Mead", "Powell"), default="COBYLA")
    parser.add_argument("--max-iterations", type=int, default=15, choices=range(1, 101))
    parser.add_argument("--penalty-weight", type=float, default=10000.0)
    parser.add_argument("--critical-weight", type=float, default=10.0)
    parser.add_argument("--unmet-weight", type=float, default=5.0)
    parser.add_argument("--transport-cost-weight", type=float, default=1.0)
    parser.add_argument("--transport-time-weight", type=float, default=0.1)
    parser.add_argument("--secondary-penalty-weight", type=float, default=0.0)
    parser.add_argument("--max-exact-states", type=int, default=50_000, choices=range(1, 50_001))
    parser.add_argument("--run-id", help="optional safe filename suffix; defaults to UTC timestamp")
    args = parser.parse_args()
    run_id = args.run_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    try:
        results_path, config_path = _experiment_output_paths(run_id)
    except (ValueError, FileExistsError) as error:
        parser.error(str(error))

    experiment = run_experiments(count=args.scenarios, seed=args.seed, p=args.p,
                                 shots=args.shots, optimizer=args.optimizer,
                                 max_iterations=args.max_iterations,
                                 penalty_weight=args.penalty_weight,
                                 max_exact_states=args.max_exact_states,
                                 critical_weight=args.critical_weight,
                                 unmet_weight=args.unmet_weight,
                                 transport_cost_weight=args.transport_cost_weight,
                                 transport_time_weight=args.transport_time_weight,
                                 secondary_penalty_weight=args.secondary_penalty_weight)
    try:
        _write_experiment_files(results_path, config_path, experiment)
    except (OSError, FileExistsError) as error:
        parser.error(str(error))
    print(f"Wrote raw results: {results_path.relative_to(ROOT)}")
    print(f"Wrote configuration: {config_path.relative_to(ROOT)}")
    for row in experiment["results"]:
        print(f"{row['scenario_id']:<24} {row['method']:<7} {row['status']:<16} "
              f"objective={row.get('objective')} feasible={row.get('feasibility')} "
              f"runtime={row.get('runtime_seconds')}s")


if __name__ == "__main__":
    main()
