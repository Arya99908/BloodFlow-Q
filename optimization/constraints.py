"""Explicit feasibility checks for a candidate BloodFlow-Q allocation.

The validator reports all detected violations instead of raising for ordinary
infeasibility or returning a bare boolean. It is shared by the greedy and
exact classical baselines so both use the same hard-constraint definitions.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from optimization.models import AllocationDecision, Scenario


def _violation(
    check: str,
    location: str,
    message: str,
    expected: Any,
    actual: Any,
) -> dict[str, Any]:
    """Build one uniform report item with enough context to locate a failure."""

    return {
        "check": check,
        "message": message,
        "location": location,
        "expected": expected,
        "actual": actual,
    }


def validate_allocation(
    scenario: Scenario,
    allocation: Sequence[AllocationDecision],
    unmet_demand: Mapping[tuple[str, str], int] | None = None,
) -> dict[str, Any]:
    """Check an allocation and return a detailed, JSON-friendly report.

    Args:
        scenario: Validated scenario with inventory, demand, routes, and
            compatibility rules.
        allocation: Candidate shipment records. ``AllocationDecision`` itself
            rejects negative quantities at construction; the validator checks
            quantities again because data can come from external decoders.
        unmet_demand: Optional explicit quantities keyed by
            ``(hospital_id, recipient_group)``. If omitted, unmet demand is
            calculated as the remaining demand after valid shipments. If
            supplied, every demand row must be present and served plus unmet
            must exactly equal demand.

    Returns:
        A dictionary with ``feasible``, ``violations``, and ``checks`` keys.
        Each violation includes what failed, where it failed, the expected
        value, and the actual value. A report is feasible only when no
        violations were found.
    """

    if not isinstance(scenario, Scenario):
        raise TypeError("scenario must be a validated Scenario")
    if not isinstance(allocation, Sequence) or isinstance(allocation, (str, bytes)):
        raise TypeError("allocation must be a sequence of AllocationDecision records")

    check_names = (
        "inventory_constraints",
        "demand_accounting",
        "compatibility",
        "route_availability",
        "non_negative_allocations",
        "valid_source_ids",
        "valid_hospital_ids",
        "valid_blood_groups",
    )
    violations: list[dict[str, Any]] = []
    failed_checks: set[str] = set()

    def record(check: str, location: str, message: str, expected: Any, actual: Any) -> None:
        violations.append(_violation(check, location, message, expected, actual))
        failed_checks.add(check)

    banks = {bank.id: bank for bank in scenario.blood_banks}
    hospitals = {hospital.id: hospital for hospital in scenario.hospitals}
    routes = {(route.source, route.destination): route for route in scenario.routes}
    supported_groups = set(scenario.blood_groups)
    inventory_used: dict[tuple[str, str], int] = {}
    demand_served: dict[tuple[str, str], int] = {}

    for index, decision in enumerate(allocation):
        location = f"allocation[{index}]"
        if not isinstance(decision, AllocationDecision):
            record(
                "non_negative_allocations",
                location,
                "allocation entry must be an AllocationDecision",
                "AllocationDecision",
                type(decision).__name__,
            )
            continue

        quantity = decision.quantity
        quantity_valid = (
            isinstance(quantity, int) and not isinstance(quantity, bool) and quantity >= 0
        )
        if not quantity_valid:
            record(
                "non_negative_allocations",
                f"{location}.quantity",
                "allocation quantity must be a non-negative whole number",
                "integer >= 0",
                quantity,
            )

        source_valid = decision.source in banks
        destination_valid = decision.destination in hospitals
        supplied_group_valid = decision.blood_group in supported_groups
        recipient_group_valid = decision.recipient_group in supported_groups

        if not source_valid:
            record(
                "valid_source_ids",
                f"{location}.source",
                "source does not identify a blood bank in the scenario",
                sorted(banks),
                decision.source,
            )
        if not destination_valid:
            record(
                "valid_hospital_ids",
                f"{location}.destination",
                "destination does not identify a hospital in the scenario",
                sorted(hospitals),
                decision.destination,
            )
        if not supplied_group_valid or not recipient_group_valid:
            invalid_groups = []
            if not supplied_group_valid:
                invalid_groups.append({"field": "blood_group", "actual": decision.blood_group})
            if not recipient_group_valid:
                invalid_groups.append(
                    {"field": "recipient_group", "actual": decision.recipient_group}
                )
            record(
                "valid_blood_groups",
                location,
                "allocation contains an unsupported blood group",
                sorted(supported_groups),
                invalid_groups,
            )

        # Invalid quantities are reported and excluded from arithmetic to
        # prevent negative or fractional values from hiding another violation.
        if not quantity_valid:
            continue

        # Keep independently checkable supply and demand totals where the
        # corresponding identifiers/groups are known, even if another rule
        # (such as route availability) failed for this same shipment.
        if source_valid and supplied_group_valid:
            inventory_key = (decision.source, decision.blood_group)
            inventory_used[inventory_key] = inventory_used.get(inventory_key, 0) + quantity
        if destination_valid and recipient_group_valid:
            demand_key = (decision.destination, decision.recipient_group)
            demand_served[demand_key] = demand_served.get(demand_key, 0) + quantity

        route = routes.get((decision.source, decision.destination))
        if route is None or route.status != "available":
            record(
                "route_availability",
                f"{location}.route",
                "shipment requires an available route from source to destination",
                "available route",
                "missing" if route is None else route.status,
            )
        if supplied_group_valid and recipient_group_valid:
            allowed = scenario.compatibility[(decision.blood_group, decision.recipient_group)]
            if not allowed:
                record(
                    "compatibility",
                    f"{location}.blood_group->{location}.recipient_group",
                    "scenario compatibility table does not allow this group pair",
                    True,
                    False,
                )

    for (bank_id, group), used in sorted(inventory_used.items()):
        available = banks[bank_id].inventory[group]
        if used > available:
            record(
                "inventory_constraints",
                f"blood_banks[{bank_id}].inventory[{group}]",
                "allocated quantity exceeds available inventory",
                f"<= {available}",
                used,
            )

    expected_demand_keys = {
        (hospital.id, group)
        for hospital in scenario.hospitals
        for group in hospital.demand
    }
    supplied_unmet: dict[tuple[str, str], int] = {}
    if unmet_demand is not None:
        if not isinstance(unmet_demand, Mapping):
            record(
                "demand_accounting",
                "unmet_demand",
                "unmet demand must be a mapping keyed by hospital and blood group",
                "mapping[(hospital_id, group), non-negative whole units]",
                type(unmet_demand).__name__,
            )
        else:
            for key, units in unmet_demand.items():
                if not isinstance(key, tuple) or len(key) != 2:
                    record(
                        "demand_accounting",
                        f"unmet_demand[{key!r}]",
                        "unmet-demand key must be (hospital_id, recipient_group)",
                        "two-item tuple",
                        key,
                    )
                    continue
                hospital_id, group = key
                if hospital_id not in hospitals or group not in supported_groups:
                    record(
                        "demand_accounting",
                        f"unmet_demand[{key!r}]",
                        "unmet-demand key references an unknown hospital or blood group",
                        {"hospital_ids": sorted(hospitals), "blood_groups": sorted(supported_groups)},
                        key,
                    )
                    continue
                if isinstance(units, bool) or not isinstance(units, int) or units < 0:
                    record(
                        "demand_accounting",
                        f"unmet_demand[{hospital_id},{group}]",
                        "unmet quantity must be a non-negative whole number",
                        "integer >= 0",
                        units,
                    )
                    continue
                supplied_unmet[(hospital_id, group)] = units

    for key in sorted(expected_demand_keys):
        hospital_id, group = key
        requested = hospitals[hospital_id].demand[group]
        served = demand_served.get(key, 0)
        if served > requested:
            record(
                "demand_accounting",
                f"hospitals[{hospital_id}].demand[{group}]",
                "allocated quantity exceeds demand",
                f"<= {requested}",
                served,
            )
        if unmet_demand is None:
            unmet = max(requested - served, 0)
        else:
            if key not in supplied_unmet:
                record(
                    "demand_accounting",
                    f"unmet_demand[{hospital_id},{group}]",
                    "explicit unmet demand is missing this hospital/group row",
                    requested - served,
                    "missing",
                )
                continue
            unmet = supplied_unmet[key]
        accounted = served + unmet
        if accounted != requested:
            record(
                "demand_accounting",
                f"hospitals[{hospital_id}].demand[{group}]",
                "served plus unmet quantity does not equal demand",
                requested,
                accounted,
            )

    checks = {name: name not in failed_checks for name in check_names}
    return {
        "feasible": not violations,
        "violations": violations,
        "checks": checks,
    }

