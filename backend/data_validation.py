"""Cross-file validation rules for BloodFlow-Q's synthetic input data.

The JSON loader checks file-by-file structure. This module checks that the
records agree with one another: identifiers are unique, references point to
known records, and numeric/model labels use allowed values. Keeping these
checks in a separately callable function makes them easy to test and reuse.

This module validates data only. It does not make allocations, infer medical
rules, or implement an optimization method.
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any


ALLOWED_URGENCY_VALUES = frozenset({"low", "medium", "high", "critical"})
ALLOWED_ROUTE_STATUSES = frozenset({"available", "blocked"})


class DataValidationError(ValueError):
    """Raised when data is malformed or inconsistent with related records."""


def _error(path: str, message: str) -> None:
    """Use a field path in every error so the user can find the bad value."""

    raise DataValidationError(f"{path}: {message}")


def _object(value: Any, path: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        _error(path, "expected an object")
    return value


def _array(value: Any, path: str) -> list[Any]:
    if not isinstance(value, list):
        _error(path, "expected a list")
    return value


def _nonempty_text(value: Any, path: str) -> str:
    if not isinstance(value, str) or not value.strip():
        _error(path, "expected a non-empty string")
    return value


def _unique_ids(records: list[Any], collection_path: str, label: str) -> set[str]:
    identifiers: set[str] = set()
    for index, record_value in enumerate(records):
        record_path = f"{collection_path}[{index}]"
        record = _object(record_value, record_path)
        identifier = _nonempty_text(record.get("id"), f"{record_path}.id")
        if identifier in identifiers:
            _error(f"{record_path}.id", f"duplicate {label} id {identifier!r}")
        identifiers.add(identifier)
    return identifiers


def _nonnegative_integer(value: Any, path: str) -> None:
    # Reject bool explicitly: in Python, bool is also a subclass of int.
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        _error(path, "expected a non-negative whole number")


def _nonnegative_number(value: Any, path: str) -> None:
    # Finite-number checking prevents NaN from slipping through comparisons.
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < 0
    ):
        _error(path, "expected a finite non-negative number")


def _declared_group_set(value: Any, path: str) -> set[str]:
    groups = _array(value, path)
    if not groups:
        _error(path, "must declare at least one supported group")
    result: set[str] = set()
    for index, value in enumerate(groups):
        group = _nonempty_text(value, f"{path}[{index}]")
        if group in result:
            _error(path, f"duplicate blood group {group!r}")
        result.add(group)
    return result


def validate_data(data: Mapping[str, Any]) -> None:
    """Validate relationships and business rules across the four data files.

    ``data`` should have the same shape returned by
    :func:`backend.data_loader.load_data`, with top-level keys ``blood_banks``,
    ``hospitals``, ``routes``, and ``compatibility``. This function raises the
    first clear :class:`DataValidationError` it finds and otherwise returns
    ``None``. It does not modify or repair its input.

    Checks include unique bank/hospital ids, supported group labels,
    non-negative integer inventory and demand, allowed urgency values, valid
    route endpoints and non-negative route measures, and valid compatibility
    group references.
    """

    root = _object(data, "data")
    sections: dict[str, Mapping[str, Any]] = {}
    for section_name in ("blood_banks", "hospitals", "routes", "compatibility"):
        sections[section_name] = _object(root.get(section_name), section_name)

    # The blood-bank file declares the supported group labels used elsewhere.
    bank_section = sections["blood_banks"]
    supported_groups = _declared_group_set(
        bank_section.get("blood_groups"), "blood_banks.blood_groups"
    )

    banks = _array(bank_section.get("blood_banks"), "blood_banks.blood_banks")
    hospitals = _array(
        sections["hospitals"].get("hospitals"), "hospitals.hospitals"
    )
    bank_ids = _unique_ids(banks, "blood_banks.blood_banks", "blood bank")
    hospital_ids = _unique_ids(hospitals, "hospitals.hospitals", "hospital")

    # Catch mismatched group declarations before checking individual records.
    hospital_groups = _declared_group_set(
        sections["hospitals"].get("blood_groups"), "hospitals.blood_groups"
    )
    compatibility_groups = _declared_group_set(
        sections["compatibility"].get("blood_groups"), "compatibility.blood_groups"
    )
    if hospital_groups != supported_groups:
        _error("hospitals.blood_groups", "must match the supported groups in blood_banks")
    if compatibility_groups != supported_groups:
        _error(
            "compatibility.blood_groups",
            "must match the supported groups in blood_banks",
        )

    for bank_index, bank_value in enumerate(banks):
        bank_path = f"blood_banks.blood_banks[{bank_index}]"
        bank = _object(bank_value, bank_path)
        inventory = _object(bank.get("inventory"), f"{bank_path}.inventory")
        for group, units in inventory.items():
            if group not in supported_groups:
                _error(f"{bank_path}.inventory.{group}", f"unsupported blood group {group!r}")
            _nonnegative_integer(units, f"{bank_path}.inventory.{group}")
        missing_groups = supported_groups - set(inventory)
        if missing_groups:
            _error(
                f"{bank_path}.inventory",
                "missing supported blood group(s): " + ", ".join(sorted(missing_groups)),
            )

    for hospital_index, hospital_value in enumerate(hospitals):
        hospital_path = f"hospitals.hospitals[{hospital_index}]"
        hospital = _object(hospital_value, hospital_path)
        demand_rows = _array(hospital.get("demand"), f"{hospital_path}.demand")
        seen_demand_groups: set[str] = set()
        for demand_index, row_value in enumerate(demand_rows):
            row_path = f"{hospital_path}.demand[{demand_index}]"
            row = _object(row_value, row_path)
            group = _nonempty_text(row.get("blood_group"), f"{row_path}.blood_group")
            if group not in supported_groups:
                _error(f"{row_path}.blood_group", f"unsupported blood group {group!r}")
            if group in seen_demand_groups:
                _error(f"{row_path}.blood_group", f"duplicate demand row for group {group!r}")
            seen_demand_groups.add(group)
            _nonnegative_integer(row.get("units"), f"{row_path}.units")

            urgency = row.get("urgency")
            if not isinstance(urgency, str) or urgency not in ALLOWED_URGENCY_VALUES:
                choices = ", ".join(sorted(ALLOWED_URGENCY_VALUES))
                _error(f"{row_path}.urgency", f"must be one of: {choices}")

        missing_demand_groups = supported_groups - seen_demand_groups
        if missing_demand_groups:
            _error(
                f"{hospital_path}.demand",
                "missing demand row(s) for: " + ", ".join(sorted(missing_demand_groups)),
            )

    routes = _array(sections["routes"].get("routes"), "routes.routes")
    seen_routes: set[tuple[str, str]] = set()
    for route_index, route_value in enumerate(routes):
        route_path = f"routes.routes[{route_index}]"
        route = _object(route_value, route_path)
        source = _nonempty_text(route.get("source"), f"{route_path}.source")
        destination = _nonempty_text(route.get("destination"), f"{route_path}.destination")
        if source not in bank_ids:
            _error(f"{route_path}.source", f"unknown blood bank id {source!r}")
        if destination not in hospital_ids:
            _error(f"{route_path}.destination", f"unknown hospital id {destination!r}")
        route_key = (source, destination)
        if route_key in seen_routes:
            _error(route_path, f"duplicate route from {source!r} to {destination!r}")
        seen_routes.add(route_key)

        _nonnegative_number(
            route.get("travel_time_minutes"), f"{route_path}.travel_time_minutes"
        )
        _nonnegative_number(route.get("distance_km"), f"{route_path}.distance_km")
        _nonnegative_number(route.get("transport_cost"), f"{route_path}.transport_cost")
        status = route.get("status")
        if not isinstance(status, str) or status not in ALLOWED_ROUTE_STATUSES:
            choices = ", ".join(sorted(ALLOWED_ROUTE_STATUSES))
            _error(f"{route_path}.status", f"must be one of: {choices}")

    compatibility = sections["compatibility"]
    rules = _array(compatibility.get("rules"), "compatibility.rules")
    seen_compatibility_pairs: set[tuple[str, str]] = set()
    for rule_index, rule_value in enumerate(rules):
        rule_path = f"compatibility.rules[{rule_index}]"
        rule = _object(rule_value, rule_path)
        donor = _nonempty_text(rule.get("donor_group"), f"{rule_path}.donor_group")
        recipient = _nonempty_text(
            rule.get("recipient_group"), f"{rule_path}.recipient_group"
        )
        if donor not in supported_groups:
            _error(f"{rule_path}.donor_group", f"unsupported blood group {donor!r}")
        if recipient not in supported_groups:
            _error(f"{rule_path}.recipient_group", f"unsupported blood group {recipient!r}")
        pair = (donor, recipient)
        if pair in seen_compatibility_pairs:
            _error(rule_path, f"duplicate compatibility rule for {donor!r} -> {recipient!r}")
        seen_compatibility_pairs.add(pair)
        if not isinstance(rule.get("allowed"), bool):
            _error(f"{rule_path}.allowed", "expected true or false")

    expected_pairs = {
        (donor, recipient)
        for donor in supported_groups
        for recipient in supported_groups
    }
    missing_pairs = expected_pairs - seen_compatibility_pairs
    if missing_pairs:
        examples = ", ".join(
            f"{donor}->{recipient}" for donor, recipient in sorted(missing_pairs)
        )
        _error("compatibility.rules", f"missing donor/recipient rule(s): {examples}")
