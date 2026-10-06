"""Hand-checkable tests for the classical objective evaluator."""

from __future__ import annotations

import unittest

from optimization.models import (
    AllocationDecision,
    BloodBank,
    Hospital,
    Route,
    Scenario,
    Urgency,
)
from optimization.objective import (
    ObjectiveConfig,
    ObjectiveInputError,
    calculate_objective,
)


def small_scenario(route_status: str = "available", a_inventory: int = 1) -> Scenario:
    groups = ("O", "A")
    return Scenario(
        id="objective_example",
        blood_groups=groups,
        blood_banks=(
            BloodBank(
                id="bank_a",
                name="Bank A",
                location_id="LOC_BANK_A",
                inventory={"O": 2, "A": a_inventory},
            ),
        ),
        hospitals=(
            Hospital(
                id="hospital_1",
                name="Hospital 1",
                location_id="LOC_HOSPITAL_1",
                demand={"O": 2, "A": 1},
                urgency={
                    "O": Urgency(category="high", priority_weight=3.0),
                    "A": Urgency(category="low", priority_weight=1.0),
                },
            ),
        ),
        routes=(
            Route(
                source="bank_a",
                destination="hospital_1",
                travel_time_minutes=10,
                distance_km=5,
                transport_cost=2,
                status=route_status,  # type: ignore[arg-type]
            ),
        ),
        compatibility={
            ("O", "O"): True,
            ("O", "A"): True,
            ("A", "O"): False,
            ("A", "A"): True,
        },
    )


def example_weights() -> ObjectiveConfig:
    # These explicit values make the example arithmetic easy to check by hand.
    return ObjectiveConfig(
        critical_unmet_weight=10,
        total_unmet_weight=2,
        transportation_cost_weight=0.5,
        transportation_time_weight=0.1,
        secondary_penalty_weight=3,
    )


class ObjectiveTests(unittest.TestCase):
    def test_calculates_each_component_and_total(self) -> None:
        scenario = small_scenario()
        allocation = (
            AllocationDecision("bank_a", "hospital_1", "O", "O", 1),
            AllocationDecision("bank_a", "hospital_1", "A", "A", 1),
        )

        result = calculate_objective(
            scenario,
            allocation,
            example_weights(),
            secondary_penalties={"example_penalty": 2},
        )

        # One high-urgency O unit remains. Priority-weighted critical shortage
        # is 1 * 3; all other values follow directly from the sample route.
        self.assertEqual(result.critical_unmet_units, 1)
        self.assertEqual(result.priority_weighted_critical_unmet, 3)
        self.assertEqual(result.total_unmet_units, 1)
        self.assertEqual(result.unmet_by_hospital_and_group, {("hospital_1", "O"): 1, ("hospital_1", "A"): 0})
        self.assertEqual(result.transportation_cost, 4)
        self.assertEqual(result.transportation_time, 20)
        self.assertEqual(result.secondary_penalty_total, 2)
        self.assertEqual(result.critical_unmet_penalty, 30)
        self.assertEqual(result.total_unmet_penalty, 2)
        self.assertEqual(result.transportation_cost_penalty, 2)
        self.assertEqual(result.transportation_time_penalty, 2)
        self.assertEqual(result.secondary_penalty_cost, 6)
        self.assertEqual(result.total_objective, 42)

    def test_no_allocation_reports_all_demand_as_unmet(self) -> None:
        result = calculate_objective(small_scenario(), (), example_weights())

        self.assertEqual(result.critical_unmet_units, 2)
        self.assertEqual(result.total_unmet_units, 3)
        self.assertEqual(result.transportation_cost, 0)
        self.assertEqual(result.transportation_time, 0)
        self.assertEqual(result.secondary_penalties, {})

    def test_unknown_bank_is_rejected(self) -> None:
        allocation = (AllocationDecision("missing", "hospital_1", "O", "O", 1),)

        with self.assertRaisesRegex(ObjectiveInputError, "unknown blood bank id"):
            calculate_objective(small_scenario(), allocation, example_weights())

    def test_incompatible_or_blocked_shipments_are_rejected(self) -> None:
        incompatible = (AllocationDecision("bank_a", "hospital_1", "A", "O", 1),)
        with self.assertRaisesRegex(ObjectiveInputError, "incompatible group pair"):
            calculate_objective(small_scenario(), incompatible, example_weights())

        blocked = (AllocationDecision("bank_a", "hospital_1", "O", "O", 1),)
        with self.assertRaisesRegex(ObjectiveInputError, "route .* unavailable"):
            calculate_objective(
                small_scenario(route_status="blocked"), blocked, example_weights()
            )

    def test_inventory_and_demand_overuse_are_rejected(self) -> None:
        uses_too_much_inventory = (
            AllocationDecision("bank_a", "hospital_1", "O", "O", 2),
            AllocationDecision("bank_a", "hospital_1", "O", "A", 1),
        )
        with self.assertRaisesRegex(ObjectiveInputError, "only 2 are available"):
            calculate_objective(
                small_scenario(), uses_too_much_inventory, example_weights()
            )

        overfills_demand = (
            AllocationDecision("bank_a", "hospital_1", "O", "O", 2),
            AllocationDecision("bank_a", "hospital_1", "A", "A", 2),
        )
        with self.assertRaisesRegex(ObjectiveInputError, "demand is 1"):
            calculate_objective(
                small_scenario(a_inventory=2), overfills_demand, example_weights()
            )

    def test_negative_weight_and_secondary_amount_are_rejected(self) -> None:
        with self.assertRaisesRegex(ObjectiveInputError, "weights.total_unmet_weight"):
            ObjectiveConfig(1, -1, 1, 1, 1)

        with self.assertRaisesRegex(ObjectiveInputError, "secondary_penalties.example"):
            calculate_objective(
                small_scenario(),
                (),
                example_weights(),
                secondary_penalties={"example": -0.5},
            )


if __name__ == "__main__":
    unittest.main()
