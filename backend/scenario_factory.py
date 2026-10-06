"""Convert strictly loaded JSON scenario data into domain model objects."""

from __future__ import annotations

from typing import Any, Mapping

from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency


def scenario_from_loaded_data(data: Mapping[str, Any], scenario_id: str = "synthetic_default") -> Scenario:
    """Build the existing optimization model from ``backend.data_loader`` output."""

    banks_section = data["blood_banks"]
    hospitals_section = data["hospitals"]
    route_section = data["routes"]
    compatibility_section = data["compatibility"]
    banks = tuple(
        BloodBank(row["id"], row["name"], row["location_id"], dict(row["inventory"]))
        for row in banks_section["blood_banks"]
    )
    groups = tuple(banks_section["blood_groups"])
    hospitals = []
    for row in hospitals_section["hospitals"]:
        demand_rows = row["demand"]
        demand = {item["blood_group"]: item["units"] for item in demand_rows}
        urgency = {
            item["blood_group"]: Urgency(item["urgency"], item["priority_weight"])
            for item in demand_rows
        }
        hospitals.append(Hospital(
            row["id"], row["name"], row["location_id"], demand, urgency
        ))
    routes = tuple(Route(
        row["source"], row["destination"], row["travel_time_minutes"],
        row["distance_km"], row["transport_cost"], row["status"],
    ) for row in route_section["routes"])
    compatibility = {
        (row["donor_group"], row["recipient_group"]): row["allowed"]
        for row in compatibility_section["rules"]
    }
    return Scenario(
        id=scenario_id,
        blood_groups=groups,
        blood_banks=banks,
        hospitals=tuple(hospitals),
        routes=routes,
        compatibility=compatibility,
    )

