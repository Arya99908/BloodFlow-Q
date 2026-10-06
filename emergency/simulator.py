"""Event-driven emergency scenario simulation for synthetic logistics data.

Each event is applied to a copied :class:`Scenario`. The original scenario is
never mutated, and the configured optimizer must produce both the before and
after allocations; this module does not hard-code a response allocation.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Mapping, Protocol, Sequence

from optimization.models import AllocationDecision, BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig, ObjectiveResult
from optimization.greedy import GreedyAllocator


class EmergencyEventError(ValueError):
    """Raised when an event cannot be applied to the requested scenario."""


@dataclass(frozen=True)
class DemandSpike:
    """Set one synthetic hospital/group demand row to a new unit quantity."""

    hospital_id: str
    blood_group: str
    new_demand: int
    urgency: Urgency | None = None


@dataclass(frozen=True)
class InventoryReduction:
    """Remove a specified number of synthetic units from bank inventory."""

    bank_id: str
    blood_group: str
    units_to_remove: int


@dataclass(frozen=True)
class RouteDisruption:
    """Mark an existing synthetic bank-to-hospital route as blocked."""

    source: str
    destination: str


@dataclass(frozen=True)
class HospitalPriorityChange:
    """Replace one hospital/group's synthetic urgency label and weight."""

    hospital_id: str
    blood_group: str
    urgency: Urgency


EmergencyEvent = DemandSpike | InventoryReduction | RouteDisruption | HospitalPriorityChange


class EmergencySolver(Protocol):
    """The small common interface implemented by greedy and exact solvers."""

    name: str

    def solve(self, scenario: Scenario, objective_config: ObjectiveConfig,
              secondary_penalties: Mapping[str, float] | None = None): ...


@dataclass(frozen=True)
class EmergencyState:
    """Optimizer output and summary metrics for one scenario state."""

    allocation: tuple[AllocationDecision, ...]
    unmet_demand: Mapping[tuple[str, str], int]
    feasibility_report: Mapping[str, object]
    objective_breakdown: ObjectiveResult
    total_objective: float
    critical_satisfaction: Mapping[str, int | float | None]
    total_unmet_demand: int
    transport_cost: float
    average_transport_time: float | None


@dataclass(frozen=True)
class EmergencyComparison:
    """Signed after-minus-before changes, keyed by allocation or demand row."""

    allocation_quantity_changes: Mapping[tuple[str, str, str, str], int]
    unmet_demand_changes: Mapping[tuple[str, str], int]
    critical_satisfaction_change: float | None
    transport_cost_change: float


@dataclass(frozen=True)
class EmergencySimulationResult:
    """Original and modified synthetic scenarios with optimizer-produced states."""

    original_scenario: Scenario
    modified_scenario: Scenario
    events: tuple[EmergencyEvent, ...]
    before_state: EmergencyState
    after_state: EmergencyState
    comparison: EmergencyComparison
    optimizer_name: str


def apply_emergency_events(
    scenario: Scenario,
    events: Sequence[EmergencyEvent],
) -> Scenario:
    """Create a modified copy of ``scenario`` after applying events in order."""

    if not isinstance(scenario, Scenario):
        raise TypeError("scenario must be a validated Scenario")
    # Copy nested dictionaries before changes. Scenario is frozen, but its
    # Mapping fields may be ordinary mutable dictionaries.
    banks = [replace(bank, inventory=dict(bank.inventory)) for bank in scenario.blood_banks]
    hospitals = [
        replace(hospital, demand=dict(hospital.demand), urgency=dict(hospital.urgency))
        for hospital in scenario.hospitals
    ]
    routes = list(scenario.routes)

    def require_units(value: int, description: str) -> None:
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise EmergencyEventError(f"{description}: expected a non-negative whole number")

    for index, event in enumerate(events):
        prefix = f"events[{index}]"
        if isinstance(event, DemandSpike):
            require_units(event.new_demand, f"{prefix}.new_demand")
            hospital = next((row for row in hospitals if row.id == event.hospital_id), None)
            if hospital is None:
                raise EmergencyEventError(f"{prefix}: unknown hospital {event.hospital_id!r}")
            if event.blood_group not in scenario.blood_groups:
                raise EmergencyEventError(f"{prefix}: unsupported blood group {event.blood_group!r}")
            demand = dict(hospital.demand)
            urgency = dict(hospital.urgency)
            demand[event.blood_group] = event.new_demand
            if event.urgency is not None:
                if not isinstance(event.urgency, Urgency):
                    raise EmergencyEventError(f"{prefix}.urgency: expected an Urgency value")
                urgency[event.blood_group] = event.urgency
            hospitals[hospitals.index(hospital)] = replace(hospital, demand=demand, urgency=urgency)
        elif isinstance(event, HospitalPriorityChange):
            hospital = next((row for row in hospitals if row.id == event.hospital_id), None)
            if hospital is None:
                raise EmergencyEventError(f"{prefix}: unknown hospital {event.hospital_id!r}")
            if event.blood_group not in scenario.blood_groups:
                raise EmergencyEventError(f"{prefix}: unsupported blood group {event.blood_group!r}")
            if not isinstance(event.urgency, Urgency):
                raise EmergencyEventError(f"{prefix}.urgency: expected an Urgency value")
            urgency = dict(hospital.urgency)
            urgency[event.blood_group] = event.urgency
            hospitals[hospitals.index(hospital)] = replace(hospital, urgency=urgency)
        elif isinstance(event, InventoryReduction):
            require_units(event.units_to_remove, f"{prefix}.units_to_remove")
            bank = next((row for row in banks if row.id == event.bank_id), None)
            if bank is None:
                raise EmergencyEventError(f"{prefix}: unknown blood bank {event.bank_id!r}")
            if event.blood_group not in scenario.blood_groups:
                raise EmergencyEventError(f"{prefix}: unsupported blood group {event.blood_group!r}")
            current = bank.inventory[event.blood_group]
            if event.units_to_remove > current:
                raise EmergencyEventError(
                    f"{prefix}: cannot remove {event.units_to_remove} units; only {current} available"
                )
            inventory = dict(bank.inventory)
            inventory[event.blood_group] = current - event.units_to_remove
            banks[banks.index(bank)] = replace(bank, inventory=inventory)
        elif isinstance(event, RouteDisruption):
            route_index = next((i for i, route in enumerate(routes)
                                if (route.source, route.destination) ==
                                (event.source, event.destination)), None)
            if route_index is None:
                raise EmergencyEventError(
                    f"{prefix}: unknown route {event.source!r} -> {event.destination!r}"
                )
            routes[route_index] = replace(routes[route_index], status="blocked")
        else:
            raise EmergencyEventError(f"{prefix}: unsupported event type {type(event).__name__}")

    return Scenario(
        id=f"{scenario.id}_emergency",
        blood_groups=tuple(scenario.blood_groups),
        blood_banks=tuple(banks),
        hospitals=tuple(hospitals),
        routes=tuple(routes),
        compatibility=dict(scenario.compatibility),
        synthetic=scenario.synthetic,
    )


def _measure_state(result, scenario: Scenario) -> EmergencyState:
    objective = result.objective_breakdown
    critical_total = sum(
        hospital.demand[group]
        for hospital in scenario.hospitals
        for group in hospital.demand
        if hospital.urgency[group].category in {"high", "critical"}
    )
    critical_unmet = objective.critical_unmet_units
    critical_met = critical_total - critical_unmet
    shipped_units = sum(item.quantity for item in result.allocation)
    average_time = objective.transportation_time / shipped_units if shipped_units else None
    return EmergencyState(
        allocation=tuple(result.allocation),
        unmet_demand=dict(result.unmet_demand),
        feasibility_report=result.feasibility_report,
        objective_breakdown=objective,
        total_objective=objective.total_objective,
        critical_satisfaction={
            "satisfied_units": critical_met,
            "total_units": critical_total,
            "rate": critical_met / critical_total if critical_total else None,
        },
        total_unmet_demand=objective.total_unmet_units,
        transport_cost=objective.transportation_cost,
        average_transport_time=average_time,
    )


def _allocation_quantities(state: EmergencyState) -> dict[tuple[str, str, str, str], int]:
    totals: dict[tuple[str, str, str, str], int] = {}
    for decision in state.allocation:
        key = (decision.source, decision.destination, decision.blood_group, decision.recipient_group)
        totals[key] = totals.get(key, 0) + decision.quantity
    return totals


def simulate_emergency(
    scenario: Scenario,
    events: Sequence[EmergencyEvent],
    objective_config: ObjectiveConfig,
    solver: EmergencySolver | None = None,
    secondary_penalties: Mapping[str, float] | None = None,
) -> EmergencySimulationResult:
    """Optimize before and after event changes and compare the two outputs."""

    optimizer = solver or GreedyAllocator()
    modified = apply_emergency_events(scenario, events)
    before_result = optimizer.solve(scenario, objective_config, secondary_penalties)
    after_result = optimizer.solve(modified, objective_config, secondary_penalties)
    before = _measure_state(before_result, scenario)
    after = _measure_state(after_result, modified)

    before_alloc = _allocation_quantities(before)
    after_alloc = _allocation_quantities(after)
    allocation_keys = before_alloc.keys() | after_alloc.keys()
    allocation_changes = {
        key: after_alloc.get(key, 0) - before_alloc.get(key, 0)
        for key in allocation_keys
        if after_alloc.get(key, 0) != before_alloc.get(key, 0)
    }
    unmet_keys = before.unmet_demand.keys() | after.unmet_demand.keys()
    unmet_changes = {
        key: after.unmet_demand.get(key, 0) - before.unmet_demand.get(key, 0)
        for key in unmet_keys
        if after.unmet_demand.get(key, 0) != before.unmet_demand.get(key, 0)
    }
    before_rate = before.critical_satisfaction["rate"]
    after_rate = after.critical_satisfaction["rate"]
    satisfaction_delta = (
        float(after_rate) - float(before_rate)
        if before_rate is not None and after_rate is not None
        else None
    )
    return EmergencySimulationResult(
        original_scenario=scenario,
        modified_scenario=modified,
        events=tuple(events),
        before_state=before,
        after_state=after,
        comparison=EmergencyComparison(
            allocation_quantity_changes=allocation_changes,
            unmet_demand_changes=unmet_changes,
            critical_satisfaction_change=satisfaction_delta,
            transport_cost_change=after.transport_cost - before.transport_cost,
        ),
        optimizer_name=getattr(optimizer, "name", type(optimizer).__name__),
    )
