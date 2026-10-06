"""Complete before/event/after re-optimization workflow.

Classical methods use the existing solver implementations. QAOA receives a
freshly built ``QUBOResult`` for each state; the measured bitstring is decoded
and checked by the classical validator. If no real solver is supplied, the
request fails explicitly instead of inventing a result.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Protocol

from emergency.simulator import EmergencyEvent, apply_emergency_events
from optimization.exact import ExactSolver, ExactSolverConfig
from optimization.greedy import GreedyAllocator
from optimization.models import AllocationDecision, Scenario
from optimization.objective import ObjectiveConfig, ObjectiveResult
from quantum.qubo import QUBOPenaltyConfig, QUBOResult, build_qubo
from optimization.decoder import evaluate_quantum_solution


class ReoptimizationError(RuntimeError):
    """Base error with a safe, user-readable message for pipeline failures."""


class QAOAUnavailableError(ReoptimizationError):
    """Raised when QAOA is requested without a real QAOA solver adapter."""


class QAOASolver(Protocol):
    """Adapter interface: sample a given newly built QUBO and return a result."""

    def solve(self, qubo: QUBOResult): ...


@dataclass(frozen=True)
class ReoptimizationMetrics:
    feasibility: bool
    violations: tuple[dict[str, object], ...]
    objective_breakdown: ObjectiveResult
    total_objective: float
    critical_satisfaction: Mapping[str, int | float | None]
    total_unmet_demand: int
    transport_cost: float
    average_transport_time: float | None


@dataclass(frozen=True)
class ReoptimizationReport:
    """Complete normal-event-emergency result with unmodified allocations."""

    original_scenario: Scenario
    emergency_event: EmergencyEvent
    modified_scenario: Scenario
    before_allocation: tuple[AllocationDecision, ...]
    after_allocation: tuple[AllocationDecision, ...]
    before_metrics: ReoptimizationMetrics
    after_metrics: ReoptimizationMetrics
    allocation_changes: Mapping[tuple[str, str, str, str], int]
    feasibility_status: Mapping[str, bool]
    method: str
    before_qubo: QUBOResult | None = None
    after_qubo: QUBOResult | None = None
    before_qaoa_result: object | None = None
    after_qaoa_result: object | None = None


def _metrics(result, allocation, unmet, scenario: Scenario) -> ReoptimizationMetrics:
    breakdown = result.objective_breakdown
    critical_total = sum(
        hospital.demand[group]
        for hospital in scenario.hospitals
        for group in hospital.demand
        if hospital.urgency[group].category in {"high", "critical"}
    )
    critical_met = max(critical_total - breakdown.critical_unmet_units, 0)
    satisfaction = {
        "satisfied_units": critical_met,
        "total_units": critical_total,
        "rate": critical_met / critical_total if critical_total else None,
    }
    violations = tuple(result.violations) if hasattr(result, "violations") else tuple(
        result.feasibility_report.get("violations", ())
    )
    feasible = bool(result.feasibility if hasattr(result, "feasibility")
                    else result.feasibility_report.get("feasible", False))
    return ReoptimizationMetrics(
        feasibility=feasible,
        violations=violations,
        objective_breakdown=breakdown,
        total_objective=breakdown.total_objective,
        critical_satisfaction=dict(satisfaction),
        total_unmet_demand=sum(unmet.values()),
        transport_cost=breakdown.transportation_cost,
        average_transport_time=(
            breakdown.transportation_time / sum(row.quantity for row in allocation)
            if sum(row.quantity for row in allocation) else None
        ),
    )


def _qaoa_bitstring(solver_result) -> str | tuple[int, ...]:
    """Accept the explicit result field used by QAOA solvers, never synthesize it."""

    if isinstance(solver_result, str):
        return solver_result
    if isinstance(solver_result, Mapping):
        value = solver_result.get("best_bitstring")
    else:
        value = getattr(solver_result, "best_bitstring", None)
    if isinstance(value, (str, tuple, list)):
        return value
    raise ReoptimizationError(
        "QAOA solver result must provide a measured best_bitstring"
    )


def _run_method(
    scenario: Scenario,
    method: str,
    objective_config: ObjectiveConfig,
    *,
    exact_config: ExactSolverConfig | None,
    qaoa_solver: QAOASolver | None,
    penalty_config: QUBOPenaltyConfig | None,
    secondary_penalties: Mapping[str, float] | None,
):
    if method == "greedy":
        result = GreedyAllocator().solve(scenario, objective_config, secondary_penalties)
        return result, result.allocation, result.unmet_demand, None, None
    if method == "exact":
        result = ExactSolver(exact_config).solve(scenario, objective_config, secondary_penalties)
        return result, result.allocation, result.unmet_demand, None, None
    if method == "qaoa":
        if qaoa_solver is None:
            raise QAOAUnavailableError(
                "QAOA re-optimization is unavailable because no QAOA solver is implemented or supplied"
            )
        if penalty_config is None:
            raise ReoptimizationError(
                "QAOA re-optimization requires explicit inventory and demand penalty weights"
            )
        # This is intentionally rebuilt separately for the before and after
        # scenarios; an emergency can change variables, bounds, and penalties.
        qubo = build_qubo(
            scenario, objective_config, penalty_config,
            secondary_penalties=secondary_penalties,
        )
        sampled = qaoa_solver.solve(qubo)
        candidate = evaluate_quantum_solution(qubo, _qaoa_bitstring(sampled))
        return candidate, candidate.decoded_allocation, candidate.unmet_demand, qubo, sampled
    raise ReoptimizationError("method must be one of: greedy, exact, qaoa")


def run_emergency_reoptimization(
    scenario: Scenario,
    emergency_event: EmergencyEvent,
    objective_config: ObjectiveConfig,
    *,
    method: str = "greedy",
    exact_config: ExactSolverConfig | None = None,
    qaoa_solver: QAOASolver | None = None,
    penalty_config: QUBOPenaltyConfig | None = None,
    secondary_penalties: Mapping[str, float] | None = None,
) -> ReoptimizationReport:
    """Optimize normally, apply one event, and optimize the changed scenario.

    When ``method="qaoa"``, both scenarios get independent QUBOs and solver
    calls, and both samples are decoded and classically validated. An
    infeasible sample stays visible; no fallback or repair is attempted.
    """

    modified = apply_emergency_events(scenario, [emergency_event])
    before_result, before_allocation, before_unmet, before_qubo, before_qaoa_result = _run_method(
        scenario, method, objective_config, exact_config=exact_config,
        qaoa_solver=qaoa_solver, penalty_config=penalty_config,
        secondary_penalties=secondary_penalties,
    )
    after_result, after_allocation, after_unmet, after_qubo, after_qaoa_result = _run_method(
        modified, method, objective_config, exact_config=exact_config,
        qaoa_solver=qaoa_solver, penalty_config=penalty_config,
        secondary_penalties=secondary_penalties,
    )
    before_metrics = _metrics(before_result, before_allocation, before_unmet, scenario)
    after_metrics = _metrics(after_result, after_allocation, after_unmet, modified)
    before_quantities: dict[tuple[str, str, str, str], int] = {}
    after_quantities: dict[tuple[str, str, str, str], int] = {}
    for destination, aggregate in ((before_allocation, before_quantities),
                                   (after_allocation, after_quantities)):
        for row in destination:
            key = (row.source, row.destination, row.blood_group, row.recipient_group)
            aggregate[key] = aggregate.get(key, 0) + row.quantity
    keys = before_quantities.keys() | after_quantities.keys()
    changes = {
        key: after_quantities.get(key, 0) - before_quantities.get(key, 0)
        for key in keys
        if after_quantities.get(key, 0) != before_quantities.get(key, 0)
    }
    return ReoptimizationReport(
        original_scenario=scenario,
        emergency_event=emergency_event,
        modified_scenario=modified,
        before_allocation=tuple(before_allocation),
        after_allocation=tuple(after_allocation),
        before_metrics=before_metrics,
        after_metrics=after_metrics,
        allocation_changes=changes,
        feasibility_status={
            "before": before_metrics.feasibility,
            "after": after_metrics.feasibility,
            "both_feasible": before_metrics.feasibility and after_metrics.feasibility,
        },
        method=method,
        before_qubo=before_qubo,
        after_qubo=after_qubo,
        before_qaoa_result=before_qaoa_result,
        after_qaoa_result=after_qaoa_result,
    )
