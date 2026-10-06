"""Tests for immutable event changes and optimizer-produced emergency states."""

from __future__ import annotations

import unittest

from emergency.simulator import (
    DemandSpike,
    EmergencyEventError,
    HospitalPriorityChange,
    InventoryReduction,
    RouteDisruption,
    apply_emergency_events,
    simulate_emergency,
)
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig


def scenario() -> Scenario:
    return Scenario(
        id="emergency_case",
        blood_groups=("O",),
        blood_banks=(BloodBank("bank", "Bank A", "B", {"O": 5}),),
        hospitals=(Hospital("hospital", "Hospital 1", "H", {"O": 4},
                            {"O": Urgency("high", 2)}),),
        routes=(Route("bank", "hospital", 10, 4, 2, "available"),),
        compatibility={("O", "O"): True},
    )


def objective_config() -> ObjectiveConfig:
    return ObjectiveConfig(10, 2, 1, 0.1, 0)


class EmergencySimulatorTests(unittest.TestCase):
    def test_demand_spike_optimizes_before_and_after_without_mutating_original(self) -> None:
        original = scenario()
        event = DemandSpike("hospital", "O", 20, Urgency("critical", 4))
        result = simulate_emergency(original, [event], objective_config())

        self.assertEqual(original.hospitals[0].demand["O"], 4)
        self.assertEqual(original.hospitals[0].urgency["O"].category, "high")
        self.assertEqual(result.modified_scenario.hospitals[0].demand["O"], 20)
        self.assertEqual(result.modified_scenario.hospitals[0].urgency["O"].category, "critical")
        # The Greedy optimizer generated these results from each scenario.
        self.assertEqual(result.before_state.allocation[0].quantity, 4)
        self.assertEqual(result.after_state.allocation[0].quantity, 5)
        self.assertEqual(result.before_state.total_unmet_demand, 0)
        self.assertEqual(result.after_state.total_unmet_demand, 15)
        self.assertEqual(result.after_state.critical_satisfaction["satisfied_units"], 5)
        self.assertEqual(result.after_state.critical_satisfaction["total_units"], 20)
        self.assertEqual(result.after_state.critical_satisfaction["rate"], 0.25)
        self.assertEqual(result.comparison.transport_cost_change, 2)
        self.assertIn(("hospital", "O"), result.comparison.unmet_demand_changes)
        self.assertEqual(result.optimizer_name, "greedy")

    def test_event_types_cover_inventory_route_and_priority_updates(self) -> None:
        changed = apply_emergency_events(scenario(), [
            InventoryReduction("bank", "O", 2),
            RouteDisruption("bank", "hospital"),
            HospitalPriorityChange("hospital", "O", Urgency("critical", 3)),
        ])
        self.assertEqual(changed.blood_banks[0].inventory["O"], 3)
        self.assertEqual(changed.routes[0].status, "blocked")
        self.assertEqual(changed.hospitals[0].urgency["O"].category, "critical")

    def test_invalid_event_does_not_change_original_or_silently_clamp(self) -> None:
        original = scenario()
        with self.assertRaisesRegex(EmergencyEventError, "only 5 available"):
            apply_emergency_events(original, [InventoryReduction("bank", "O", 6)])
        self.assertEqual(original.blood_banks[0].inventory["O"], 5)

    def test_route_disruption_runs_optimizer_on_modified_route(self) -> None:
        result = simulate_emergency(
            scenario(), [RouteDisruption("bank", "hospital")], objective_config()
        )
        self.assertEqual(result.modified_scenario.routes[0].status, "blocked")
        self.assertEqual(result.after_state.allocation, ())
        self.assertEqual(result.after_state.total_unmet_demand, 4)
        self.assertTrue(result.after_state.feasibility_report["feasible"])


if __name__ == "__main__":
    unittest.main()
