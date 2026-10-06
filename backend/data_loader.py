"""Load and strictly validate BloodFlow-Q's small synthetic JSON dataset.

This module deliberately uses only Python's standard library, so a beginner
can run it without installing a data-validation package. Validation is strict:
missing fields, extra fields, duplicate identifiers, invalid references, and
inconsistent group lists all raise :class:`DataValidationError` with the file
and record involved. Nothing is silently skipped or repaired.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from backend.data_validation import DataValidationError, validate_data


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATA_FILES = (
    "blood_banks.json",
    "hospitals.json",
    "routes.json",
    "compatibility.json",
)


def _fail(file_name: str, location: str, message: str) -> None:
    """Raise one consistently formatted, beginner-readable validation error."""

    raise DataValidationError(f"{file_name}: {location}: {message}")


def _expect_object(value: Any, file_name: str, location: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(file_name, location, "expected a JSON object")
    return value


def _expect_exact_keys(
    value: dict[str, Any], expected: set[str], file_name: str, location: str
) -> None:
    """Reject both missing and unexpected keys to catch typos early."""

    missing = sorted(expected - value.keys())
    extra = sorted(value.keys() - expected)
    if missing or extra:
        details = []
        if missing:
            details.append("missing required field(s): " + ", ".join(missing))
        if extra:
            details.append("unexpected field(s): " + ", ".join(extra))
        _fail(file_name, location, "; ".join(details))


def _expect_list(value: Any, file_name: str, location: str) -> list[Any]:
    if not isinstance(value, list):
        _fail(file_name, location, "expected a JSON array")
    return value


def _expect_text(value: Any, file_name: str, location: str) -> str:
    if not isinstance(value, str) or not value.strip():
        _fail(file_name, location, "expected a non-empty string")
    return value


def _expect_nonnegative_integer(value: Any, file_name: str, location: str) -> int:
    # bool is a subclass of int in Python; reject it so true cannot mean 1 unit.
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        _fail(file_name, location, "expected a non-negative whole number")
    return value


def _expect_positive_number(value: Any, file_name: str, location: str) -> float:
    # Reject bool and NaN/infinity; neither is a meaningful scenario quantity.
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value <= 0
    ):
        _fail(file_name, location, "expected a finite number greater than zero")
    return float(value)


def _expect_nonnegative_number(value: Any, file_name: str, location: str) -> float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < 0
    ):
        _fail(file_name, location, "expected a finite number greater than or equal to zero")
    return float(value)


def _expect_synthetic_header(
    value: Any, expected: set[str], file_name: str
) -> dict[str, Any]:
    obj = _expect_object(value, file_name, "root")
    _expect_exact_keys(obj, expected, file_name, "root")
    if obj.get("schema_version") != 1 or isinstance(obj.get("schema_version"), bool):
        _fail(file_name, "schema_version", "expected supported schema version 1")
    if obj.get("synthetic") is not True:
        _fail(file_name, "synthetic", "must be true; only synthetic examples are accepted")
    return obj


def _validate_groups(value: Any, file_name: str, location: str) -> list[str]:
    groups = _expect_list(value, file_name, location)
    if not groups:
        _fail(file_name, location, "must contain at least one blood group")
    clean_groups = [_expect_text(group, file_name, f"{location}[{i}]") for i, group in enumerate(groups)]
    if len(set(clean_groups)) != len(clean_groups):
        _fail(file_name, location, "blood group labels must be unique")
    return clean_groups


def _read_json(data_dir: Path, file_name: str) -> Any:
    path = data_dir / file_name
    try:
        with path.open("r", encoding="utf-8") as json_file:
            # Python accepts NaN/Infinity by default although they are not
            # standard JSON. Reject them here rather than let them leak through.
            return json.load(
                json_file,
                parse_constant=lambda token: (_ for _ in ()).throw(
                    ValueError(f"non-standard numeric value {token}")
                ),
            )
    except FileNotFoundError as error:
        raise DataValidationError(f"{path}: file does not exist") from error
    except json.JSONDecodeError as error:
        raise DataValidationError(
            f"{path}: invalid JSON at line {error.lineno}, column {error.colno}: {error.msg}"
        ) from error
    except (OSError, UnicodeError) as error:
        raise DataValidationError(f"{path}: could not read file: {error}") from error
    except ValueError as error:
        raise DataValidationError(f"{path}: invalid JSON value: {error}") from error


def _validate_blood_banks(raw: Any) -> tuple[dict[str, Any], list[str]]:
    file_name = "blood_banks.json"
    data = _expect_synthetic_header(
        raw, {"schema_version", "synthetic", "blood_groups", "blood_banks"}, file_name
    )
    groups = _validate_groups(data["blood_groups"], file_name, "blood_groups")
    banks = _expect_list(data["blood_banks"], file_name, "blood_banks")
    if not banks:
        _fail(file_name, "blood_banks", "must contain at least one bank")

    seen_ids: set[str] = set()
    for index, raw_bank in enumerate(banks):
        location = f"blood_banks[{index}]"
        bank = _expect_object(raw_bank, file_name, location)
        _expect_exact_keys(
            bank, {"id", "name", "location_id", "inventory"}, file_name, location
        )
        bank_id = _expect_text(bank["id"], file_name, f"{location}.id")
        _expect_text(bank["name"], file_name, f"{location}.name")
        _expect_text(bank["location_id"], file_name, f"{location}.location_id")
        if bank_id in seen_ids:
            _fail(file_name, f"{location}.id", f"duplicate bank id {bank_id!r}")
        seen_ids.add(bank_id)

        inventory = _expect_object(bank["inventory"], file_name, f"{location}.inventory")
        if set(inventory) != set(groups):
            _fail(
                file_name,
                f"{location}.inventory",
                "must contain exactly these groups: " + ", ".join(groups),
            )
        for group in groups:
            _expect_nonnegative_integer(
                inventory[group], file_name, f"{location}.inventory.{group}"
            )
    return data, groups


def _validate_hospitals(raw: Any) -> tuple[dict[str, Any], list[str]]:
    file_name = "hospitals.json"
    data = _expect_synthetic_header(
        raw, {"schema_version", "synthetic", "blood_groups", "hospitals"}, file_name
    )
    groups = _validate_groups(data["blood_groups"], file_name, "blood_groups")
    hospitals = _expect_list(data["hospitals"], file_name, "hospitals")
    if not hospitals:
        _fail(file_name, "hospitals", "must contain at least one hospital")

    seen_ids: set[str] = set()
    for index, raw_hospital in enumerate(hospitals):
        location = f"hospitals[{index}]"
        hospital = _expect_object(raw_hospital, file_name, location)
        _expect_exact_keys(
            hospital,
            {"id", "name", "location_id", "demand"},
            file_name,
            location,
        )
        hospital_id = _expect_text(hospital["id"], file_name, f"{location}.id")
        _expect_text(hospital["name"], file_name, f"{location}.name")
        _expect_text(hospital["location_id"], file_name, f"{location}.location_id")
        if hospital_id in seen_ids:
            _fail(file_name, f"{location}.id", f"duplicate hospital id {hospital_id!r}")
        seen_ids.add(hospital_id)

        demand_rows = _expect_list(hospital["demand"], file_name, f"{location}.demand")
        demand_groups: set[str] = set()
        if len(demand_rows) != len(groups):
            _fail(
                file_name,
                f"{location}.demand",
                f"must contain exactly one row for each of the {len(groups)} supported groups",
            )
        for demand_index, raw_row in enumerate(demand_rows):
            row_location = f"{location}.demand[{demand_index}]"
            row = _expect_object(raw_row, file_name, row_location)
            _expect_exact_keys(
                row,
                {"blood_group", "units", "urgency", "priority_weight"},
                file_name,
                row_location,
            )
            group = _expect_text(row["blood_group"], file_name, f"{row_location}.blood_group")
            if group not in groups:
                _fail(file_name, f"{row_location}.blood_group", f"unknown group {group!r}")
            if group in demand_groups:
                _fail(file_name, f"{location}.demand", f"duplicate demand for group {group!r}")
            demand_groups.add(group)
            _expect_nonnegative_integer(row["units"], file_name, f"{row_location}.units")
            urgency = _expect_text(row["urgency"], file_name, f"{row_location}.urgency")
            if urgency not in {"low", "medium", "high", "critical"}:
                _fail(
                    file_name,
                    f"{row_location}.urgency",
                    "must be one of: low, medium, high, critical",
                )
            _expect_positive_number(
                row["priority_weight"], file_name, f"{row_location}.priority_weight"
            )
        if demand_groups != set(groups):
            _fail(file_name, f"{location}.demand", "demand is missing one or more supported groups")
    return data, groups


def _validate_routes(raw: Any, bank_ids: set[str], hospital_ids: set[str]) -> dict[str, Any]:
    file_name = "routes.json"
    data = _expect_synthetic_header(
        raw,
        {"schema_version", "synthetic", "transport_cost_unit", "routes"},
        file_name,
    )
    _expect_text(data["transport_cost_unit"], file_name, "transport_cost_unit")
    routes = _expect_list(data["routes"], file_name, "routes")
    if not routes:
        _fail(file_name, "routes", "must contain at least one route")

    seen_pairs: set[tuple[str, str]] = set()
    for index, raw_route in enumerate(routes):
        location = f"routes[{index}]"
        route = _expect_object(raw_route, file_name, location)
        _expect_exact_keys(
            route,
            {
                "source",
                "destination",
                "travel_time_minutes",
                "distance_km",
                "transport_cost",
                "status",
            },
            file_name,
            location,
        )
        source = _expect_text(route["source"], file_name, f"{location}.source")
        destination = _expect_text(route["destination"], file_name, f"{location}.destination")
        if source not in bank_ids:
            _fail(file_name, f"{location}.source", f"unknown blood bank id {source!r}")
        if destination not in hospital_ids:
            _fail(file_name, f"{location}.destination", f"unknown hospital id {destination!r}")
        pair = (source, destination)
        if pair in seen_pairs:
            _fail(file_name, location, f"duplicate route from {source!r} to {destination!r}")
        seen_pairs.add(pair)
        _expect_nonnegative_number(
            route["travel_time_minutes"], file_name, f"{location}.travel_time_minutes"
        )
        _expect_nonnegative_number(route["distance_km"], file_name, f"{location}.distance_km")
        _expect_nonnegative_number(
            route["transport_cost"], file_name, f"{location}.transport_cost"
        )
        status = _expect_text(route["status"], file_name, f"{location}.status")
        if status not in {"available", "blocked"}:
            _fail(file_name, f"{location}.status", "must be either 'available' or 'blocked'")

    expected_pairs = {(bank_id, hospital_id) for bank_id in bank_ids for hospital_id in hospital_ids}
    missing_pairs = expected_pairs - seen_pairs
    if missing_pairs:
        examples = ", ".join(f"{source}->{destination}" for source, destination in sorted(missing_pairs))
        _fail(file_name, "routes", f"missing route record(s): {examples}")
    return data


def _validate_compatibility(raw: Any, groups: list[str]) -> dict[str, Any]:
    file_name = "compatibility.json"
    data = _expect_synthetic_header(
        raw,
        {
            "schema_version",
            "synthetic",
            "component_model",
            "compatibility_scope",
            "notice",
            "blood_groups",
            "rules",
        },
        file_name,
    )
    for field in ("component_model", "compatibility_scope", "notice"):
        _expect_text(data[field], file_name, field)
    if data["component_model"] != "red_blood_cells":
        _fail(file_name, "component_model", "this prototype loader expects 'red_blood_cells'")
    if data["compatibility_scope"] != "simplified_abo_only_assumption":
        _fail(
            file_name,
            "compatibility_scope",
            "must identify the simplified ABO-only prototype assumption",
        )
    compatibility_groups = _validate_groups(data["blood_groups"], file_name, "blood_groups")
    if compatibility_groups != groups:
        _fail(file_name, "blood_groups", "must match the groups declared in the other data files")

    rules = _expect_list(data["rules"], file_name, "rules")
    expected_pairs = {(donor, recipient) for donor in groups for recipient in groups}
    seen_pairs: set[tuple[str, str]] = set()
    for index, raw_rule in enumerate(rules):
        location = f"rules[{index}]"
        rule = _expect_object(raw_rule, file_name, location)
        _expect_exact_keys(
            rule, {"donor_group", "recipient_group", "allowed"}, file_name, location
        )
        donor = _expect_text(rule["donor_group"], file_name, f"{location}.donor_group")
        recipient = _expect_text(
            rule["recipient_group"], file_name, f"{location}.recipient_group"
        )
        if donor not in groups or recipient not in groups:
            _fail(file_name, location, "donor_group and recipient_group must be declared groups")
        pair = (donor, recipient)
        if pair in seen_pairs:
            _fail(file_name, location, f"duplicate compatibility rule for {donor!r} -> {recipient!r}")
        seen_pairs.add(pair)
        if not isinstance(rule["allowed"], bool):
            _fail(file_name, f"{location}.allowed", "expected true or false")

    missing_pairs = expected_pairs - seen_pairs
    if missing_pairs:
        examples = ", ".join(f"{donor}->{recipient}" for donor, recipient in sorted(missing_pairs))
        _fail(file_name, "rules", f"missing donor/recipient rule(s): {examples}")
    return data


def load_data(data_dir: str | Path | None = None) -> dict[str, Any]:
    """Load and cross-validate the four synthetic dataset files.

    Args:
        data_dir: Directory containing all four JSON files. When omitted, the
            repository's ``data/`` directory is used regardless of the
            process's current working directory.

    Returns:
        A dictionary with ``blood_banks``, ``hospitals``, ``routes``, and
        ``compatibility`` values. Each value is the validated JSON object as
        written, which keeps the original readable structure available.

    Raises:
        DataValidationError: If a file is missing, malformed, or inconsistent
            with its documented schema or the other data files.
    """

    directory = Path(data_dir) if data_dir is not None else DEFAULT_DATA_DIR
    raw_files = {name: _read_json(directory, name) for name in DATA_FILES}

    banks, bank_groups = _validate_blood_banks(raw_files["blood_banks.json"])
    hospitals, hospital_groups = _validate_hospitals(raw_files["hospitals.json"])
    if hospital_groups != bank_groups:
        _fail(
            "hospitals.json",
            "blood_groups",
            "must match the groups declared in blood_banks.json",
        )

    bank_ids = {bank["id"] for bank in banks["blood_banks"]}
    hospital_ids = {hospital["id"] for hospital in hospitals["hospitals"]}
    routes = _validate_routes(raw_files["routes.json"], bank_ids, hospital_ids)
    compatibility = _validate_compatibility(raw_files["compatibility.json"], bank_groups)

    loaded_data = {
        "blood_banks": banks,
        "hospitals": hospitals,
        "routes": routes,
        "compatibility": compatibility,
    }
    # Apply the reusable cross-file checks too. Keeping schema checks in the
    # loader and relationship checks in data_validation.py makes each job
    # easier to understand and test on its own.
    validate_data(loaded_data)
    return loaded_data


if __name__ == "__main__":
    # Handy beginner check: run `python -m backend.data_loader` from the repo.
    loaded = load_data()
    print(
        "Loaded synthetic data: "
        f"{len(loaded['blood_banks']['blood_banks'])} banks, "
        f"{len(loaded['hospitals']['hospitals'])} hospitals, "
        f"{len(loaded['compatibility']['rules'])} compatibility rules."
    )
