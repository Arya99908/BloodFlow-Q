"""Benchmark Greedy and Exact, optionally with a real QAOA solver adapter.

This module records only methods that actually ran. QAOA is represented with
status ``not_requested`` and null metrics when no solver is supplied; a real
solver adapter is required to generate QAOA measurements. The benchmark never
fabricates scores or timings.
"""

from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass, replace
from pathlib import Path
from time import perf_counter
from typing import Mapping, Protocol, Sequence

from optimization.exact import ExactSolver, ExactSolverConfig, ExactSolverLimitError
from optimization.greedy import GreedyAllocator
from optimization.models import AllocationDecision, Scenario
from optimization.objective import ObjectiveConfig, ObjectiveResult


@dataclass(frozen=True)
class BenchmarkRecord:
    """Comparable measurements for one method and one scenario.

    Fields are ``None`` when the method did not run, such as the current QAOA
    placeholder or an exact run rejected by its size cap. A missing measurement
    is never encoded as zero.
    """

    scenario_id: str
    method: str
    status: str
    objective_value: float | None
    critical_unmet_demand: int | None
    total_unmet_demand: int | None
    transport_cost: float | None
    average_transport_time: float | None
    feasibility: bool | None
    runtime_seconds: float | None
    approximation_gap: float | None = None
    approximation_gap_status: str | None = None
    allocation: tuple[AllocationDecision, ...] = ()
    detail: str | None = None
    raw_bitstring: str | None = None
    classical_repair_applied: bool = False

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly record, including allocation details."""

        result = asdict(self)
        # asdict recursively turns AllocationDecision dataclasses into objects.
        return result


class BenchmarkableResult(Protocol):
    """Minimum result contract required by the benchmark runner."""

    allocation: Sequence[AllocationDecision]
    unmet_demand: Mapping[tuple[str, str], int]
    objective_breakdown: ObjectiveResult
    feasibility_report: Mapping[str, object]


class BenchmarkableSolver(Protocol):
    """Interface a classical or future solver can implement."""

    name: str

    def solve(
        self,
        scenario: Scenario,
        objective_config: ObjectiveConfig,
        secondary_penalties: Mapping[str, float] | None = None,
    ) -> BenchmarkableResult:
        """Return an allocation, score breakdown, and feasibility report."""


def _record_from_run(
    scenario: Scenario,
    method: str,
    result: BenchmarkableResult,
    runtime_seconds: float,
) -> BenchmarkRecord:
    objective = result.objective_breakdown
    total_units = sum(decision.quantity for decision in result.allocation)
    average_time = objective.transportation_time / total_units if total_units else None
    feasible = bool(result.feasibility_report.get("feasible", False))
    raw_bits = getattr(result, "raw_bitstring", None)
    if raw_bits is None and hasattr(result, "decoded_candidate"):
        decoded_cand = getattr(result, "decoded_candidate")
        bits_tuple = getattr(decoded_cand, "bits_in_mapping_order", ())
        if bits_tuple:
            raw_bits = "".join(str(b) for b in bits_tuple)
    repair_applied = bool(getattr(result, "classical_repair_applied", False))
    return BenchmarkRecord(
        scenario_id=scenario.id,
        method=method,
        status="completed" if feasible else "infeasible",
        objective_value=objective.total_objective,
        critical_unmet_demand=objective.critical_unmet_units,
        total_unmet_demand=objective.total_unmet_units,
        transport_cost=objective.transportation_cost,
        average_transport_time=average_time,
        feasibility=feasible,
        runtime_seconds=runtime_seconds,
        allocation=tuple(result.allocation),
        raw_bitstring=raw_bits,
        classical_repair_applied=repair_applied,
    )


def _with_qaoa_approximation_gap(
    records: Sequence[BenchmarkRecord],
) -> tuple[BenchmarkRecord, ...]:
    """Compare a measured feasible QAOA result with exact or MILP, when available."""

    exact = next(
        (r for r in records if r.method in {"exact", "milp"} and r.status == "completed" and r.objective_value is not None),
        None,
    )
    qaoa = next((r for r in records if r.method == "qaoa"), None)
    if qaoa is None:
        return tuple(records)
    if qaoa.status != "completed" or qaoa.feasibility is not True or qaoa.objective_value is None:
        replacement = replace(qaoa, approximation_gap=None,
                              approximation_gap_status="unavailable: no completed feasible QAOA result")
    elif exact is None or exact.objective_value is None:
        replacement = replace(qaoa, approximation_gap=None,
                              approximation_gap_status="unavailable: exact result was not available")
    elif exact.objective_value == 0:
        if qaoa.objective_value == 0:
            replacement = replace(qaoa, approximation_gap=0.0,
                                  approximation_gap_status="defined: both objectives are zero")
        else:
            replacement = replace(qaoa, approximation_gap=None,
                                  approximation_gap_status="undefined: exact objective is zero")
    else:
        gap = (qaoa.objective_value - exact.objective_value) / abs(exact.objective_value)
        replacement = replace(qaoa, approximation_gap=gap,
                              approximation_gap_status="defined")
    return tuple(replacement if record is qaoa else record for record in records)


def benchmark_solvers(
    scenario: Scenario,
    objective_config: ObjectiveConfig,
    solvers: Sequence[BenchmarkableSolver],
    secondary_penalties: Mapping[str, float] | None = None,
) -> tuple[BenchmarkRecord, ...]:
    """Time supplied solvers using the same scenario and objective config."""

    records: list[BenchmarkRecord] = []
    names: set[str] = set()
    for solver in solvers:
        method = getattr(solver, "name", None)
        if method not in {"greedy", "exact", "milp", "qaoa"}:
            raise ValueError("solver.name must be one of: greedy, exact, milp, qaoa")
        if method in names:
            raise ValueError(f"duplicate benchmark method name {method!r}")
        names.add(method)
        start = perf_counter()
        result = solver.solve(
            scenario,
            objective_config,
            secondary_penalties=secondary_penalties,
        )
        runtime_seconds = perf_counter() - start
        records.append(_record_from_run(scenario, method, result, runtime_seconds))
    return _with_qaoa_approximation_gap(records)


def run_baseline_benchmark(
    scenario: Scenario,
    objective_config: ObjectiveConfig,
    exact_config: ExactSolverConfig | None = None,
    secondary_penalties: Mapping[str, float] | None = None,
    include_qaoa_placeholder: bool = True,
    qaoa_solver: BenchmarkableSolver | None = None,
    include_milp: bool = False,
) -> tuple[BenchmarkRecord, ...]:
    """Run Greedy, bounded Exact, and QAOA when a real solver is supplied.

    An exact state-limit refusal is recorded with status ``skipped_too_large``
    and null scores. Without a QAOA adapter, the result is marked
    ``not_requested`` and its metric fields remain null. When requested,
    MILP provides an exact mathematical programming baseline. No QAOA data is
    fabricated.
    """

    records: list[BenchmarkRecord] = []
    greedy = GreedyAllocator()
    start = perf_counter()
    greedy_result = greedy.solve(
        scenario, objective_config, secondary_penalties=secondary_penalties
    )
    records.append(_record_from_run(scenario, greedy.name, greedy_result, perf_counter() - start))

    if include_milp:
        from optimization.milp import MILPSolver
        milp = MILPSolver()
        start = perf_counter()
        milp_result = milp.solve(
            scenario, objective_config, secondary_penalties=secondary_penalties
        )
        records.append(_record_from_run(scenario, milp.name, milp_result, perf_counter() - start))

    exact = ExactSolver(exact_config)
    start = perf_counter()
    try:
        exact_result = exact.solve(
            scenario, objective_config, secondary_penalties=secondary_penalties
        )
    except ExactSolverLimitError as error:
        records.append(
            BenchmarkRecord(
                scenario_id=scenario.id,
                method="exact",
                status="skipped_too_large",
                objective_value=None,
                critical_unmet_demand=None,
                total_unmet_demand=None,
                transport_cost=None,
                average_transport_time=None,
                feasibility=None,
                runtime_seconds=perf_counter() - start,
                detail=str(error),
            )
        )
    else:
        records.append(_record_from_run(scenario, exact.name, exact_result, perf_counter() - start))

    if qaoa_solver is not None:
        if getattr(qaoa_solver, "name", None) != "qaoa":
            raise ValueError("qaoa_solver.name must be 'qaoa'")
        start = perf_counter()
        quantum_result = qaoa_solver.solve(
            scenario, objective_config, secondary_penalties=secondary_penalties
        )
        records.append(_record_from_run(
            scenario, "qaoa", quantum_result, perf_counter() - start
        ))
    elif include_qaoa_placeholder:
        records.append(
            BenchmarkRecord(
                scenario_id=scenario.id,
                method="qaoa",
                status="not_requested",
                objective_value=None,
                critical_unmet_demand=None,
                total_unmet_demand=None,
                transport_cost=None,
                average_transport_time=None,
                feasibility=None,
                runtime_seconds=None,
                approximation_gap=None,
                approximation_gap_status="unavailable: QAOA was not requested",
                detail="No QAOA solver was supplied for this benchmark; no result was generated.",
            )
        )
    return _with_qaoa_approximation_gap(records)


def run_benchmark_suite(
    scenarios: Sequence[Scenario],
    objective_config: ObjectiveConfig,
    exact_config: ExactSolverConfig | None = None,
    secondary_penalties: Mapping[str, float] | None = None,
    qaoa_solver: BenchmarkableSolver | None = None,
    include_milp: bool = False,
) -> tuple[BenchmarkRecord, ...]:
    """Run the common Greedy/Exact/QAOA comparison for every supplied scenario."""

    results: list[BenchmarkRecord] = []
    for scenario in scenarios:
        results.extend(run_baseline_benchmark(
            scenario,
            objective_config,
            exact_config=exact_config,
            secondary_penalties=secondary_penalties,
            qaoa_solver=qaoa_solver,
            include_milp=include_milp,
        ))
    return tuple(results)


def export_benchmark_results(
    records: Sequence[BenchmarkRecord],
    *,
    json_path: str | Path | None = None,
    csv_path: str | Path | None = None,
    experiment_configuration: Mapping[str, object] | None = None,
) -> None:
    """Export records to JSON and/or CSV, creating parent folders if needed.

    The CSV stores the requested comparison metrics. Allocation details remain
    available in the JSON export. Pass at least one path.
    """

    if json_path is None and csv_path is None:
        raise ValueError("provide json_path, csv_path, or both")

    if json_path is not None:
        target = Path(json_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", encoding="utf-8", newline="") as output:
            payload: dict[str, object] = {"results": [record.to_dict() for record in records]}
            if experiment_configuration is not None:
                payload["experiment_configuration"] = dict(experiment_configuration)
            json.dump(payload, output, indent=2)
            output.write("\n")

    if csv_path is not None:
        target = Path(csv_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        fields = (
            "scenario_id",
            "method",
            "status",
            "objective_value",
            "critical_unmet_demand",
            "total_unmet_demand",
            "transport_cost",
            "average_transport_time",
            "feasibility",
            "runtime_seconds",
            "approximation_gap",
            "approximation_gap_status",
            "raw_bitstring",
            "classical_repair_applied",
            "detail",
        )
        with target.open("w", encoding="utf-8", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=fields)
            writer.writeheader()
            for record in records:
                writer.writerow({field: getattr(record, field) for field in fields})
