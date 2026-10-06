"""Backend-owned deterministic scenarios for the controlled demo.

The UI receives only these identifiers. All numerical inputs are derived from
the bundled fictional data and fixed event values below; callers cannot upload
or modify scenario data through the demo endpoint.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Any

from emergency.simulator import DemandSpike, RouteDisruption
from optimization.models import Scenario, Urgency


DEMO_CATALOG: tuple[dict[str, str], ...] = (
    {"id": "normal", "name": "NORMAL", "description": "Bundled synthetic Bank A to Hospital 1 O-group allocation."},
    {"id": "emergency_demand_spike", "name": "EMERGENCY DEMAND SPIKE", "description": "Raises the same synthetic demand from 4 to 16 units and changes its logistics urgency to critical."},
    {"id": "transport_disruption", "name": "TRANSPORT DISRUPTION", "description": "Blocks the only route in the same small synthetic scenario."},
)


def build_demo_case(base: Scenario, scenario_id: str) -> tuple[Scenario, DemandSpike | RouteDisruption | None]:
    """Return a compact deterministic scenario and its optional fixed event."""

    if scenario_id not in {item["id"] for item in DEMO_CATALOG}:
        raise ValueError(f"unknown demo scenario: {scenario_id}")

    # Restricting the case to one bank, one hospital, and one blood group keeps
    # the educational QUBO under the configured local-simulator qubit limit.
    bank = next((item for item in base.blood_banks if item.id == "bank_a"), base.blood_banks[0])
    hospital = next((item for item in base.hospitals if item.id == "hospital_1"), base.hospitals[0])
    route = next((item for item in base.routes if item.source == bank.id and item.destination == hospital.id), None)
    if route is None:
        raise ValueError("bundled demo source has no Bank A to Hospital 1 route")

    group = "O" if "O" in base.blood_groups else base.blood_groups[0]
    selected_bank = replace(bank, inventory={group: int(bank.inventory[group])})
    selected_urgency = hospital.urgency[group]
    selected_hospital = replace(
        hospital,
        demand={group: int(hospital.demand[group])},
        urgency={group: selected_urgency},
    )
    scenario = Scenario(
        id=f"demo_{scenario_id}",
        blood_groups=(group,),
        blood_banks=(selected_bank,),
        hospitals=(selected_hospital,),
        routes=(route,),
        compatibility={(group, group): bool(base.compatibility.get((group, group), False))},
        synthetic=True,
    )
    if scenario_id == "emergency_demand_spike":
        event = DemandSpike(hospital.id, group, 16, Urgency("critical", selected_urgency.priority_weight))
    elif scenario_id == "transport_disruption":
        event = RouteDisruption(bank.id, hospital.id)
    else:
        event = None
    return scenario, event


def demo_catalog_payload() -> dict[str, Any]:
    """Return the fixed scenario descriptions without scenario measurements."""

    return {"synthetic_only": True, "scenarios": [dict(item) for item in DEMO_CATALOG]}
