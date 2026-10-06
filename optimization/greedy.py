"""Deterministic classical greedy allocator for synthetic scenarios.

The method is a transparent heuristic, not an exact optimizer. It fills
high-urgency demand rows first, then other rows, and chooses the cheapest
available compatible bank/group option under the configured route weights.
Every completed result is checked by the shared feasibility validator.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from optimization.constraints import validate_allocation
from optimization.models import AllocationDecision, Scenario
from optimization.objective import (
    ObjectiveConfig,
    ObjectiveResult,
    calculate_objective,
)


class GreedyInvariantError(RuntimeError):
    """Raised only if the allocator's own output unexpectedly fails validation."""


@dataclass(frozen=True)
class GreedyResult:
    """All observable outputs from one deterministic greedy run."""

    allocation: tuple[AllocationDecision, ...]
    unmet_demand: Mapping[tuple[str, str], int]
    objective_breakdown: ObjectiveResult
    feasibility_report: Mapping[str, object]


def allocate_greedily(
    scenario: Scenario,
    objective_config: ObjectiveConfig,
    secondary_penalties: Mapping[str, float] | None = None,
) -> GreedyResult:
    """Build a feasible allocation by repeatedly filling the next demand row.

    The procedure is deterministic: urgency, priority weight, ids, route cost,
    route time, and the declared group order provide stable tie breakers. It
    fills all demand it can from eligible available inventory; unmet quantities
    are returned explicitly for every hospital/group row.
    """

    bank_by_id = {bank.id: bank for bank in scenario.blood_banks}
    hospitals_by_id = {hospital.id: hospital for hospital in scenario.hospitals}
    route_by_pair = {(route.source, route.destination): route for route in scenario.routes}
    group_order = {group: index for index, group in enumerate(scenario.blood_groups)}
    urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}

    remaining_inventory = {
        (bank.id, group): quantity
        for bank in scenario.blood_banks
        for group, quantity in bank.inventory.items()
    }
    remaining_demand = {
        (hospital.id, group): quantity
        for hospital in scenario.hospitals
        for group, quantity in hospital.demand.items()
    }
    quantities: dict[tuple[str, str, str, str], int] = {}

    # Sorting once makes urgency priority and every tie break reproducible.
    demand_rows = [
        (hospital, group)
        for hospital in scenario.hospitals
        for group in scenario.blood_groups
    ]
    demand_rows.sort(
        key=lambda item: (
            urgency_order[item[0].urgency[item[1]].category],
            -item[0].urgency[item[1]].priority_weight,
            item[0].id,
            group_order[item[1]],
        )
    )

    for hospital, recipient_group in demand_rows:
        demand_key = (hospital.id, recipient_group)
        still_needed = remaining_demand[demand_key]
        if still_needed == 0:
            continue

        # Candidate sources are sorted by their weighted route burden. Group
        # order and ids settle ties without randomness.
        candidates: list[tuple[float, float, float, str, int, str]] = []
        for bank in scenario.blood_banks:
            route = route_by_pair[(bank.id, hospital.id)]
            if route.status != "available":
                continue
            for supplied_group in scenario.blood_groups:
                if remaining_inventory[(bank.id, supplied_group)] == 0:
                    continue
                if not scenario.compatibility[(supplied_group, recipient_group)]:
                    continue
                weighted_route_score = (
                    objective_config.transportation_cost_weight * route.transport_cost
                    + objective_config.transportation_time_weight * route.travel_time_minutes
                )
                candidates.append(
                    (
                        weighted_route_score,
                        route.travel_time_minutes,
                        route.transport_cost,
                        bank.id,
                        group_order[supplied_group],
                        supplied_group,
                    )
                )
        candidates.sort()

        for _, _, _, bank_id, _, supplied_group in candidates:
            if still_needed == 0:
                break
            stock_key = (bank_id, supplied_group)
            available = remaining_inventory[stock_key]
            assigned = min(available, still_needed)
            if assigned <= 0:
                continue
            variable_key = (bank_id, hospital.id, supplied_group, recipient_group)
            quantities[variable_key] = quantities.get(variable_key, 0) + assigned
            remaining_inventory[stock_key] -= assigned
            still_needed -= assigned
        remaining_demand[demand_key] = still_needed

    allocation = tuple(
        AllocationDecision(
            source=source,
            destination=destination,
            blood_group=supplied_group,
            recipient_group=recipient_group,
            quantity=quantity,
        )
        for (source, destination, supplied_group, recipient_group), quantity in sorted(
            quantities.items(),
            key=lambda item: (
                item[0][1],
                item[0][3],
                item[0][0],
                group_order[item[0][2]],
            ),
        )
        if quantity > 0
    )
    unmet_demand = dict(remaining_demand)
    feasibility_report = validate_allocation(scenario, allocation, unmet_demand)
    if not feasibility_report["feasible"]:
        # This signals a programming defect, not an infeasible user scenario:
        # the algorithm guards stock and demand before emitting each quantity.
        raise GreedyInvariantError(
            f"greedy allocator generated an infeasible result: {feasibility_report['violations']}"
        )

    objective = calculate_objective(
        scenario,
        allocation,
        objective_config,
        secondary_penalties=secondary_penalties,
    )
    return GreedyResult(
        allocation=allocation,
        unmet_demand=unmet_demand,
        objective_breakdown=objective,
        feasibility_report=feasibility_report,
    )


class GreedyAllocator:
    """Small solver-style wrapper suitable for the shared benchmark interface."""

    name = "greedy"

    def solve(
        self,
        scenario: Scenario,
        objective_config: ObjectiveConfig,
        secondary_penalties: Mapping[str, float] | None = None,
    ) -> GreedyResult:
        """Return the deterministic greedy allocation and its checks/score."""

        return allocate_greedily(scenario, objective_config, secondary_penalties)
