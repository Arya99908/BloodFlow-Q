"""Exhaustive exact solver for very small synthetic BloodFlow-Q scenarios.

This is a reference method for correctness checks and benchmarking, not a
scalable solver. It enumerates every bounded shipment-variable combination
until a configurable candidate-state limit is reached.
"""

from __future__ import annotations

from dataclasses import dataclass
from itertools import product
from math import prod
from typing import Mapping

from optimization.constraints import validate_allocation
from optimization.models import AllocationDecision, AllocationVariable, Scenario
from optimization.objective import (
    ObjectiveConfig,
    ObjectiveResult,
    calculate_objective,
)


# A named, documented cap keeps an accidental large enumeration from running
# without bound. Tiny synthetic tests can choose a smaller cap explicitly.
DEFAULT_MAX_CANDIDATE_STATES = 50_000


class ExactSolverLimitError(ValueError):
    """Raised before search when the estimated state count exceeds the cap."""


@dataclass(frozen=True)
class ExactSolverConfig:
    """Safety limit for exhaustive search.

    ``max_candidate_states`` counts the cartesian product of every shipment
    variable's integer range. The count includes combinations that later fail
    inventory or demand constraints. The default 50,000 is a deliberate guard
    for a teaching/benchmark prototype; exact search should remain limited to
    tiny synthetic scenarios.
    """

    max_candidate_states: int = DEFAULT_MAX_CANDIDATE_STATES

    def __post_init__(self) -> None:
        if (
            isinstance(self.max_candidate_states, bool)
            or not isinstance(self.max_candidate_states, int)
            or self.max_candidate_states < 1
        ):
            raise ValueError("max_candidate_states must be a positive whole number")


@dataclass(frozen=True)
class ExactResult:
    """Optimal feasible candidate and reproducibility counts for an exact run."""

    allocation: tuple[AllocationDecision, ...]
    unmet_demand: Mapping[tuple[str, str], int]
    objective_breakdown: ObjectiveResult
    objective_value: float
    feasibility_report: Mapping[str, object]
    examined_candidate_count: int
    feasible_candidate_count: int


def _state_count(variables: tuple[AllocationVariable, ...]) -> int:
    """Return the full bounded integer search-space size without enumeration."""

    return prod(variable.upper_bound + 1 for variable in variables)


def solve_exact(
    scenario: Scenario,
    objective_config: ObjectiveConfig,
    solver_config: ExactSolverConfig | None = None,
    secondary_penalties: Mapping[str, float] | None = None,
) -> ExactResult:
    """Find a globally minimum-score feasible allocation by enumeration.

    This solver is intended only for tiny scenarios. It stops before search
    when the estimated bounded-variable state count exceeds its configured
    limit. Every candidate that survives shared feasibility checks is scored
    by the same objective function used by the greedy baseline.
    """

    if solver_config is None:
        solver_config = ExactSolverConfig()
    if not isinstance(solver_config, ExactSolverConfig):
        raise TypeError("solver_config must be an ExactSolverConfig")

    variables = scenario.allocation_variables()
    estimated_states = _state_count(variables)
    if estimated_states > solver_config.max_candidate_states:
        raise ExactSolverLimitError(
            "exact search refused: estimated candidate state count "
            f"{estimated_states:,} exceeds configured limit "
            f"{solver_config.max_candidate_states:,}; use this solver only on tiny scenarios"
        )

    best_allocation: tuple[AllocationDecision, ...] | None = None
    best_unmet: dict[tuple[str, str], int] | None = None
    best_objective: ObjectiveResult | None = None
    best_report: Mapping[str, object] | None = None
    examined = 0
    feasible_count = 0
    ranges = (range(variable.upper_bound + 1) for variable in variables)

    for candidate_quantities in product(*ranges):
        examined += 1
        candidate = tuple(
            AllocationDecision(
                source=variable.source,
                destination=variable.destination,
                blood_group=variable.blood_group,
                recipient_group=variable.recipient_group,
                quantity=quantity,
            )
            for variable, quantity in zip(variables, candidate_quantities)
            if quantity > 0
        )

        served: dict[tuple[str, str], int] = {}
        for decision in candidate:
            key = (decision.destination, decision.recipient_group)
            served[key] = served.get(key, 0) + decision.quantity
        unmet = {
            (hospital.id, group): max(quantity - served.get((hospital.id, group), 0), 0)
            for hospital in scenario.hospitals
            for group, quantity in hospital.demand.items()
        }

        report = validate_allocation(scenario, candidate, unmet)
        if not report["feasible"]:
            continue
        feasible_count += 1
        objective = calculate_objective(
            scenario,
            candidate,
            objective_config,
            secondary_penalties=secondary_penalties,
        )
        if best_objective is None or objective.total_objective < best_objective.total_objective:
            best_allocation = candidate
            best_unmet = unmet
            best_objective = objective
            best_report = report

    # The zero-shipment candidate is always feasible for a validated scenario,
    # so reaching this branch would indicate a defect in validation/enumeration.
    if best_allocation is None or best_unmet is None or best_objective is None or best_report is None:
        raise RuntimeError("exact enumeration did not find even the zero-shipment feasible candidate")

    return ExactResult(
        allocation=best_allocation,
        unmet_demand=best_unmet,
        objective_breakdown=best_objective,
        objective_value=best_objective.total_objective,
        feasibility_report=best_report,
        examined_candidate_count=examined,
        feasible_candidate_count=feasible_count,
    )


class ExactSolver:
    """Solver-style wrapper that can be called by the shared benchmark runner."""

    name = "exact"

    def __init__(self, config: ExactSolverConfig | None = None) -> None:
        self.config = config or ExactSolverConfig()

    def solve(
        self,
        scenario: Scenario,
        objective_config: ObjectiveConfig,
        secondary_penalties: Mapping[str, float] | None = None,
    ) -> ExactResult:
        """Return the exact result, subject to the configured safety cap."""

        return solve_exact(
            scenario,
            objective_config,
            solver_config=self.config,
            secondary_penalties=secondary_penalties,
        )
