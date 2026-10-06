"""Classical objective calculation for a candidate BloodFlow-Q allocation.

This module scores a supplied allocation. It does not search for, improve, or
select an allocation, and it contains no QUBO or quantum-computing code.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Mapping, Sequence

from optimization.models import AllocationDecision, Scenario


class ObjectiveInputError(ValueError):
    """Raised when an objective configuration or candidate allocation is invalid."""


def _require_weight(name: str, value: float) -> None:
    """Weights must be explicit, finite, and non-negative to keep costs defined."""

    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < 0
    ):
        raise ObjectiveInputError(f"weights.{name}: expected a finite non-negative number")


@dataclass(frozen=True)
class ObjectiveConfig:
    """Explicit weights that convert each modeled measure into objective cost.

    There are no default weights: a run must state its trade-offs. Set a
    component's weight to zero to report that component without allowing it to
    affect the total. ``secondary_penalty_weight`` is applied to the sum of
    optional caller-supplied secondary penalty amounts.
    """

    critical_unmet_weight: float
    total_unmet_weight: float
    transportation_cost_weight: float
    transportation_time_weight: float
    secondary_penalty_weight: float

    def __post_init__(self) -> None:
        for field_name in (
            "critical_unmet_weight",
            "total_unmet_weight",
            "transportation_cost_weight",
            "transportation_time_weight",
            "secondary_penalty_weight",
        ):
            _require_weight(field_name, getattr(self, field_name))


@dataclass(frozen=True)
class ObjectiveResult:
    """Raw measures and weighted costs returned by :func:`calculate_objective`.

    ``critical_unmet_units`` counts shortage at rows labeled ``high`` or
    ``critical``.
    ``priority_weighted_critical_unmet`` applies each such row's synthetic
    priority weight. ``total_unmet_units`` includes all urgency categories,
    including the high rows counted separately above.
    """

    critical_unmet_units: int
    priority_weighted_critical_unmet: float
    total_unmet_units: int
    unmet_by_hospital_and_group: Mapping[tuple[str, str], int]
    transportation_cost: float
    transportation_time: float
    secondary_penalties: Mapping[str, float]
    secondary_penalty_total: float
    critical_unmet_penalty: float
    total_unmet_penalty: float
    transportation_cost_penalty: float
    transportation_time_penalty: float
    secondary_penalty_cost: float
    total_objective: float


def _validate_secondary_penalties(
    penalties: Mapping[str, float] | None,
) -> dict[str, float]:
    """Copy named penalty amounts after checking them; do not mutate caller data."""

    if penalties is None:
        return {}
    if not isinstance(penalties, Mapping):
        raise ObjectiveInputError("secondary_penalties: expected a mapping of names to amounts")

    validated: dict[str, float] = {}
    for name, amount in penalties.items():
        if not isinstance(name, str) or not name.strip():
            raise ObjectiveInputError("secondary_penalties: every penalty needs a non-empty name")
        if (
            isinstance(amount, bool)
            or not isinstance(amount, (int, float))
            or not math.isfinite(amount)
            or amount < 0
        ):
            raise ObjectiveInputError(
                f"secondary_penalties.{name}: expected a finite non-negative amount"
            )
        validated[name] = float(amount)
    return validated


def calculate_objective(
    scenario: Scenario,
    allocation: Sequence[AllocationDecision],
    config: ObjectiveConfig,
    secondary_penalties: Mapping[str, float] | None = None,
) -> ObjectiveResult:
    """Calculate separate shortage and transport scores for one allocation.

    Args:
        scenario: Validated synthetic scenario describing inventory, demand,
            urgency, compatibility, and routes.
        allocation: Candidate shipment records. Repeated matching records are
            combined when calculating use and cost.
        config: Explicit, non-negative weights for all objective components.
        secondary_penalties: Optional named non-negative amounts already
            calculated by a caller. Their sum is multiplied by the configured
            ``secondary_penalty_weight``. This interface lets later features
            add documented penalties without hiding constants in this module.

    Returns:
        An :class:`ObjectiveResult` containing each raw measure, each weighted
        penalty, unmet quantities by demand row, and the total objective.

    Raises:
        ObjectiveInputError: If a shipment refers to unknown entities, an
            unavailable/incompatible route, exceeds inventory/demand, or if
            weights or secondary amounts are invalid.

    Notes:
        A ``high`` or ``critical`` urgency row is counted as critical for this
        prototype. Those labels describe synthetic operational priority only.
        Its unmet quantity is included in both critical and total shortage
        components. Route time and cost are multiplied by shipment quantity,
        so they represent per-unit logistics burden. The scenario values and
        urgency weights are synthetic assumptions, not clinical guidance.
    """

    if not isinstance(scenario, Scenario):
        raise ObjectiveInputError("scenario: expected a validated Scenario")
    if not isinstance(config, ObjectiveConfig):
        raise ObjectiveInputError("config: expected an ObjectiveConfig")
    if not isinstance(allocation, Sequence) or isinstance(allocation, (str, bytes)):
        raise ObjectiveInputError("allocation: expected a sequence of AllocationDecision values")

    banks = {bank.id: bank for bank in scenario.blood_banks}
    hospitals = {hospital.id: hospital for hospital in scenario.hospitals}
    routes = {(route.source, route.destination): route for route in scenario.routes}
    inventory_used: dict[tuple[str, str], int] = {}
    demand_served: dict[tuple[str, str], int] = {}
    transportation_cost = 0.0
    transportation_time = 0.0

    for index, decision in enumerate(allocation):
        path = f"allocation[{index}]"
        if not isinstance(decision, AllocationDecision):
            raise ObjectiveInputError(f"{path}: expected an AllocationDecision")
        bank = banks.get(decision.source)
        if bank is None:
            raise ObjectiveInputError(f"{path}.source: unknown blood bank id {decision.source!r}")
        hospital = hospitals.get(decision.destination)
        if hospital is None:
            raise ObjectiveInputError(
                f"{path}.destination: unknown hospital id {decision.destination!r}"
            )
        if decision.blood_group not in scenario.blood_groups:
            raise ObjectiveInputError(
                f"{path}.blood_group: unsupported blood group {decision.blood_group!r}"
            )
        if decision.recipient_group not in scenario.blood_groups:
            raise ObjectiveInputError(
                f"{path}.recipient_group: unsupported blood group {decision.recipient_group!r}"
            )
        route = routes.get((decision.source, decision.destination))
        if route is None or route.status != "available":
            raise ObjectiveInputError(
                f"{path}: route {decision.source!r} -> {decision.destination!r} is unavailable"
            )
        if not scenario.compatibility[(decision.blood_group, decision.recipient_group)]:
            raise ObjectiveInputError(
                f"{path}: incompatible group pair {decision.blood_group!r} -> {decision.recipient_group!r}"
            )

        inventory_key = (decision.source, decision.blood_group)
        inventory_used[inventory_key] = inventory_used.get(inventory_key, 0) + decision.quantity
        demand_key = (decision.destination, decision.recipient_group)
        demand_served[demand_key] = demand_served.get(demand_key, 0) + decision.quantity
        transportation_cost += decision.quantity * route.transport_cost
        transportation_time += decision.quantity * route.travel_time_minutes

    # Enforce hard inventory and demand bounds before assigning a finite score.
    for (bank_id, group), quantity in inventory_used.items():
        available = banks[bank_id].inventory[group]
        if quantity > available:
            raise ObjectiveInputError(
                f"allocation: bank {bank_id!r} uses {quantity} units of {group}, "
                f"but only {available} are available"
            )
    for (hospital_id, group), quantity in demand_served.items():
        requested = hospitals[hospital_id].demand[group]
        if quantity > requested:
            raise ObjectiveInputError(
                f"allocation: hospital {hospital_id!r} receives {quantity} units for "
                f"{group} demand, but demand is {requested}"
            )

    unmet_by_row: dict[tuple[str, str], int] = {}
    critical_unmet_units = 0
    priority_weighted_critical_unmet = 0.0
    total_unmet_units = 0
    for hospital in scenario.hospitals:
        for group, requested in hospital.demand.items():
            unmet = requested - demand_served.get((hospital.id, group), 0)
            unmet_by_row[(hospital.id, group)] = unmet
            total_unmet_units += unmet
            if hospital.urgency[group].category in {"high", "critical"}:
                critical_unmet_units += unmet
                priority_weighted_critical_unmet += (
                    unmet * hospital.urgency[group].priority_weight
                )

    named_secondary_penalties = _validate_secondary_penalties(secondary_penalties)
    secondary_penalty_total = sum(named_secondary_penalties.values())

    critical_unmet_penalty = (
        config.critical_unmet_weight * priority_weighted_critical_unmet
    )
    total_unmet_penalty = config.total_unmet_weight * total_unmet_units
    transportation_cost_penalty = (
        config.transportation_cost_weight * transportation_cost
    )
    transportation_time_penalty = (
        config.transportation_time_weight * transportation_time
    )
    secondary_penalty_cost = (
        config.secondary_penalty_weight * secondary_penalty_total
    )
    total_objective = (
        critical_unmet_penalty
        + total_unmet_penalty
        + transportation_cost_penalty
        + transportation_time_penalty
        + secondary_penalty_cost
    )

    return ObjectiveResult(
        critical_unmet_units=critical_unmet_units,
        priority_weighted_critical_unmet=priority_weighted_critical_unmet,
        total_unmet_units=total_unmet_units,
        unmet_by_hospital_and_group=unmet_by_row,
        transportation_cost=transportation_cost,
        transportation_time=transportation_time,
        secondary_penalties=named_secondary_penalties,
        secondary_penalty_total=secondary_penalty_total,
        critical_unmet_penalty=critical_unmet_penalty,
        total_unmet_penalty=total_unmet_penalty,
        transportation_cost_penalty=transportation_cost_penalty,
        transportation_time_penalty=transportation_time_penalty,
        secondary_penalty_cost=secondary_penalty_cost,
        total_objective=total_objective,
    )
