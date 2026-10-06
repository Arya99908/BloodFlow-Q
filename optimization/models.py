"""Beginner-friendly data model for BloodFlow-Q's allocation problem.

This module defines scenario inputs and bounded integer-variable descriptions.
It deliberately contains no solver: constructing a :class:`Scenario` or
enumerating its possible variables never chooses an allocation.

Only synthetic, aggregate logistics data belongs in these classes. The
compatibility table is supplied as an explicit prototype assumption; these
classes do not infer or validate clinical transfusion rules.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal, Mapping


RouteStatus = Literal["available", "blocked"]
"""Allowed route states in the synthetic scenario."""


class ModelValidationError(ValueError):
    """Raised when a scenario cannot describe a consistent allocation model."""


def _require_text(value: str, path: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ModelValidationError(f"{path}: expected a non-empty string")


def _require_nonnegative_integer(value: int, path: str) -> None:
    # bool behaves like int in Python, but True must never mean one blood unit.
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ModelValidationError(f"{path}: expected a non-negative whole number")


def _require_nonnegative_number(value: float, path: str) -> None:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < 0
    ):
        raise ModelValidationError(f"{path}: expected a finite non-negative number")


@dataclass(frozen=True)
class Urgency:
    """Synthetic urgency label and its mathematical priority weight.

    ``category`` is currently one of ``low``, ``medium``, ``high``, or
    ``critical``. These are synthetic logistics priority labels, not clinical
    triage categories.
    ``priority_weight`` is a scenario assumption: a larger value means the
    future objective would penalize unmet demand for this row more strongly.
    It is not a clinical triage score.
    """

    category: str
    priority_weight: float

    def __post_init__(self) -> None:
        if not isinstance(self.category, str) or self.category not in {"low", "medium", "high", "critical"}:
            raise ModelValidationError(
                "urgency.category: must be one of low, medium, high, or critical"
            )
        if (
            isinstance(self.priority_weight, bool)
            or not isinstance(self.priority_weight, (int, float))
            or not math.isfinite(self.priority_weight)
            or self.priority_weight <= 0
        ):
            raise ModelValidationError(
                "urgency.priority_weight: expected a finite number greater than zero"
            )


@dataclass(frozen=True)
class BloodBank:
    """A synthetic source and its available whole-unit inventory.

    ``inventory`` maps each supported supplied blood-group label to the
    number of modeled units at this bank.
    """

    id: str
    name: str
    location_id: str
    inventory: Mapping[str, int]


@dataclass(frozen=True)
class Hospital:
    """A synthetic destination with aggregate demand and urgency inputs.

    ``demand`` maps a recipient-group label to requested modeled units.
    ``urgency`` uses the same keys and gives each row's synthetic category and
    objective weight. There are no patient-level records in this model.
    """

    id: str
    name: str
    location_id: str
    demand: Mapping[str, int]
    urgency: Mapping[str, Urgency]


@dataclass(frozen=True)
class Route:
    """Synthetic transport information for one bank-to-hospital pair.

    A blocked route stays in the scenario for explanation but cannot create
    allocation variables. Time, distance, and cost are scenario estimates,
    not measured delivery guarantees.
    """

    source: str
    destination: str
    travel_time_minutes: float
    distance_km: float
    transport_cost: float
    status: RouteStatus


@dataclass(frozen=True)
class AllocationDecision:
    """A concrete candidate shipment quantity for one bank/hospital/group pair.

    ``blood_group`` is the supplied inventory group. ``recipient_group`` is
    the hospital demand row this shipment would satisfy. Both are needed
    because compatibility can permit one supplied group to count toward a
    different recipient-group demand. This record describes a candidate value;
    it does not mean an optimizer has selected it.
    """

    source: str
    destination: str
    blood_group: str
    recipient_group: str
    quantity: int

    def __post_init__(self) -> None:
        for field_name in ("source", "destination", "blood_group", "recipient_group"):
            _require_text(getattr(self, field_name), f"allocation.{field_name}")
        _require_nonnegative_integer(self.quantity, "allocation.quantity")


@dataclass(frozen=True)
class AllocationVariable:
    """Description and upper bound for a possible integer shipment variable.

    The associated mathematical variable is
    ``x[source,destination,blood_group,recipient_group]`` in the inclusive
    integer range from zero to ``upper_bound``.
    """

    source: str
    destination: str
    blood_group: str
    recipient_group: str
    upper_bound: int


@dataclass(frozen=True)
class UnmetDemandVariable:
    """Description and upper bound for one non-negative unmet-demand variable.

    Its value ``u[hospital_id, recipient_group]`` will range from zero through
    that row's demand. It represents demand left unassigned, not a patient
    outcome.
    """

    hospital_id: str
    recipient_group: str
    upper_bound: int


@dataclass(frozen=True)
class Scenario:
    """All synthetic inputs that define one bounded allocation problem.

    ``compatibility`` maps ``(supplied_group, recipient_group)`` to an explicit
    boolean assumption. Every pair must be present. Routes and compatibility
    jointly determine which shipment variables exist. Scenario validation is
    structural; it does not solve or optimize the allocation.
    """

    id: str
    blood_groups: tuple[str, ...]
    blood_banks: tuple[BloodBank, ...]
    hospitals: tuple[Hospital, ...]
    routes: tuple[Route, ...]
    compatibility: Mapping[tuple[str, str], bool]
    synthetic: bool = True

    def __post_init__(self) -> None:
        _require_text(self.id, "scenario.id")
        if self.synthetic is not True:
            raise ModelValidationError("scenario.synthetic: must be true")
        if not self.blood_groups:
            raise ModelValidationError("scenario.blood_groups: must not be empty")
        for index, group in enumerate(self.blood_groups):
            _require_text(group, f"scenario.blood_groups[{index}]")
        if len(set(self.blood_groups)) != len(self.blood_groups):
            raise ModelValidationError("scenario.blood_groups: labels must be unique")
        supported_groups = set(self.blood_groups)

        if not self.blood_banks:
            raise ModelValidationError("scenario.blood_banks: must not be empty")
        if not self.hospitals:
            raise ModelValidationError("scenario.hospitals: must not be empty")

        bank_ids: set[str] = set()
        for index, bank in enumerate(self.blood_banks):
            path = f"scenario.blood_banks[{index}]"
            if not isinstance(bank, BloodBank):
                raise ModelValidationError(f"{path}: expected a BloodBank")
            _require_text(bank.id, f"{path}.id")
            _require_text(bank.name, f"{path}.name")
            _require_text(bank.location_id, f"{path}.location_id")
            if bank.id in bank_ids:
                raise ModelValidationError(f"{path}.id: duplicate blood bank id {bank.id!r}")
            bank_ids.add(bank.id)
            self._validate_group_quantities(bank.inventory, supported_groups, f"{path}.inventory")

        hospital_ids: set[str] = set()
        for index, hospital in enumerate(self.hospitals):
            path = f"scenario.hospitals[{index}]"
            if not isinstance(hospital, Hospital):
                raise ModelValidationError(f"{path}: expected a Hospital")
            _require_text(hospital.id, f"{path}.id")
            _require_text(hospital.name, f"{path}.name")
            _require_text(hospital.location_id, f"{path}.location_id")
            if hospital.id in hospital_ids:
                raise ModelValidationError(
                    f"{path}.id: duplicate hospital id {hospital.id!r}"
                )
            hospital_ids.add(hospital.id)
            self._validate_group_quantities(hospital.demand, supported_groups, f"{path}.demand")
            if not isinstance(hospital.urgency, Mapping):
                raise ModelValidationError(f"{path}.urgency: expected a mapping by blood group")
            if set(hospital.urgency) != supported_groups:
                raise ModelValidationError(
                    f"{path}.urgency: must contain one entry for each supported blood group"
                )
            for group, urgency in hospital.urgency.items():
                if group not in supported_groups:
                    raise ModelValidationError(
                        f"{path}.urgency.{group}: unsupported blood group {group!r}"
                    )
                if not isinstance(urgency, Urgency):
                    raise ModelValidationError(
                        f"{path}.urgency.{group}: expected an Urgency value"
                    )

        route_pairs: set[tuple[str, str]] = set()
        for index, route in enumerate(self.routes):
            path = f"scenario.routes[{index}]"
            if not isinstance(route, Route):
                raise ModelValidationError(f"{path}: expected a Route")
            _require_text(route.source, f"{path}.source")
            _require_text(route.destination, f"{path}.destination")
            if route.source not in bank_ids:
                raise ModelValidationError(
                    f"{path}.source: unknown blood bank id {route.source!r}"
                )
            if route.destination not in hospital_ids:
                raise ModelValidationError(
                    f"{path}.destination: unknown hospital id {route.destination!r}"
                )
            pair = (route.source, route.destination)
            if pair in route_pairs:
                raise ModelValidationError(f"{path}: duplicate route {pair!r}")
            route_pairs.add(pair)
            for field_name in ("travel_time_minutes", "distance_km", "transport_cost"):
                _require_nonnegative_number(
                    getattr(route, field_name), f"{path}.{field_name}"
                )
            if not isinstance(route.status, str) or route.status not in {"available", "blocked"}:
                raise ModelValidationError(
                    f"{path}.status: must be either 'available' or 'blocked'"
                )

        expected_route_pairs = {
            (bank_id, hospital_id)
            for bank_id in bank_ids
            for hospital_id in hospital_ids
        }
        missing_routes = expected_route_pairs - route_pairs
        if missing_routes:
            pair_text = ", ".join(f"{source}->{destination}" for source, destination in sorted(missing_routes))
            raise ModelValidationError(f"scenario.routes: missing route(s): {pair_text}")

        expected_compatibility_pairs = {
            (supplied, recipient)
            for supplied in supported_groups
            for recipient in supported_groups
        }
        if not isinstance(self.compatibility, Mapping):
            raise ModelValidationError("scenario.compatibility: expected a mapping of group pairs")
        for pair in self.compatibility:
            if not isinstance(pair, tuple) or len(pair) != 2:
                raise ModelValidationError(
                    f"scenario.compatibility[{pair!r}]: key must be a (supplied_group, recipient_group) pair"
                )
            supplied_group, recipient_group = pair
            if supplied_group not in supported_groups or recipient_group not in supported_groups:
                raise ModelValidationError(
                    f"scenario.compatibility[{pair!r}]: contains an unsupported blood group"
                )
        actual_compatibility_pairs = set(self.compatibility)
        if actual_compatibility_pairs != expected_compatibility_pairs:
            missing = expected_compatibility_pairs - actual_compatibility_pairs
            extra = actual_compatibility_pairs - expected_compatibility_pairs
            details = []
            if missing:
                details.append(f"missing pair(s): {sorted(missing)!r}")
            if extra:
                details.append(f"unsupported pair(s): {sorted(extra)!r}")
            raise ModelValidationError("scenario.compatibility: " + "; ".join(details))
        for pair, allowed in self.compatibility.items():
            if not isinstance(allowed, bool):
                raise ModelValidationError(
                    f"scenario.compatibility[{pair!r}]: expected true or false"
                )

    @staticmethod
    def _validate_group_quantities(
        values: Mapping[str, int], supported_groups: set[str], path: str
    ) -> None:
        if not isinstance(values, Mapping):
            raise ModelValidationError(f"{path}: expected a mapping by blood group")
        if set(values) != supported_groups:
            unsupported = set(values) - supported_groups
            missing = supported_groups - set(values)
            details = []
            if unsupported:
                details.append(f"unsupported group(s): {sorted(unsupported)!r}")
            if missing:
                details.append(f"missing group(s): {sorted(missing)!r}")
            raise ModelValidationError(f"{path}: " + "; ".join(details))
        for group, quantity in values.items():
            _require_nonnegative_integer(quantity, f"{path}.{group}")

    def allocation_variables(self) -> tuple[AllocationVariable, ...]:
        """Describe every eligible shipment variable and its finite upper bound.

        Only available routes and compatibility pairs marked ``True`` produce
        variables. The upper bound is the smaller of source inventory and
        destination demand for the related groups. A zero bound needs no
        variable because the quantity could only be zero.
        """

        banks_by_id = {bank.id: bank for bank in self.blood_banks}
        hospitals_by_id = {hospital.id: hospital for hospital in self.hospitals}
        variables: list[AllocationVariable] = []
        for route in self.routes:
            if route.status != "available":
                continue
            bank = banks_by_id[route.source]
            hospital = hospitals_by_id[route.destination]
            for supplied_group in self.blood_groups:
                for recipient_group in self.blood_groups:
                    if not self.compatibility[(supplied_group, recipient_group)]:
                        continue
                    upper_bound = min(
                        bank.inventory[supplied_group], hospital.demand[recipient_group]
                    )
                    if upper_bound == 0:
                        continue
                    variables.append(
                        AllocationVariable(
                            source=route.source,
                            destination=route.destination,
                            blood_group=supplied_group,
                            recipient_group=recipient_group,
                            upper_bound=upper_bound,
                        )
                    )
        return tuple(variables)

    def unmet_demand_variables(self) -> tuple[UnmetDemandVariable, ...]:
        """Describe one bounded unmet-demand variable for each positive demand.

        The bound equals the demand row: unmet demand cannot exceed the amount
        requested. Zero-demand rows are omitted because their variable is
        fixed at zero.
        """

        return tuple(
            UnmetDemandVariable(
                hospital_id=hospital.id,
                recipient_group=group,
                upper_bound=quantity,
            )
            for hospital in self.hospitals
            for group, quantity in hospital.demand.items()
            if quantity > 0
        )
