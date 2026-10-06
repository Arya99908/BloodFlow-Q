"""Tests for the non-optimizing allocation model data structures."""

from __future__ import annotations

import unittest

from optimization.models import (
    AllocationDecision,
    BloodBank,
    Hospital,
    ModelValidationError,
    Route,
    Scenario,
    Urgency,
)


def make_scenario(route_status: str = "available") -> Scenario:
    """Make a tiny all-synthetic scenario that is easy to inspect by hand."""

    groups = ("O", "A")
    return Scenario(
        id="tiny_example",
        blood_groups=groups,
        blood_banks=(
            BloodBank(
                id="bank_a",
                name="Bank A",
                location_id="LOC_BANK_A",
                inventory={"O": 4, "A": 2},
            ),
        ),
        hospitals=(
            Hospital(
                id="hospital_1",
                name="Hospital 1",
                location_id="LOC_HOSPITAL_1",
                demand={"O": 1, "A": 2},
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
                travel_time_minutes=0,
                distance_km=0,
                transport_cost=0,
                status=route_status,  # type: ignore[arg-type] -- invalid value is tested below
            ),
        ),
        compatibility={
            ("O", "O"): True,
            ("O", "A"): True,
            ("A", "O"): False,
            ("A", "A"): True,
        },
    )


class AllocationModelTests(unittest.TestCase):
    def test_valid_scenario_describes_expected_domain_data(self) -> None:
        scenario = make_scenario()

        self.assertEqual(scenario.blood_banks[0].inventory["O"], 4)
        self.assertEqual(scenario.hospitals[0].demand["A"], 2)
        self.assertEqual(scenario.hospitals[0].urgency["O"].category, "high")
        self.assertEqual(scenario.routes[0].status, "available")

    def test_only_compatible_available_allocations_become_variables(self) -> None:
        variables = make_scenario().allocation_variables()
        keys_and_bounds = {
            (v.source, v.destination, v.blood_group, v.recipient_group): v.upper_bound
            for v in variables
        }

        self.assertEqual(
            keys_and_bounds,
            {
                ("bank_a", "hospital_1", "O", "O"): 1,
                ("bank_a", "hospital_1", "O", "A"): 2,
                ("bank_a", "hospital_1", "A", "A"): 2,
            },
        )

    def test_blocked_route_creates_no_allocation_variables(self) -> None:
        scenario = make_scenario(route_status="blocked")

        self.assertEqual(scenario.allocation_variables(), ())

    def test_unmet_demand_variables_are_bounded_by_demand(self) -> None:
        variables = make_scenario().unmet_demand_variables()

        self.assertEqual(
            {(v.hospital_id, v.recipient_group): v.upper_bound for v in variables},
            {("hospital_1", "O"): 1, ("hospital_1", "A"): 2},
        )

    def test_allocation_decision_is_a_nonnegative_whole_unit_quantity(self) -> None:
        decision = AllocationDecision(
            source="bank_a",
            destination="hospital_1",
            blood_group="O",
            recipient_group="A",
            quantity=2,
        )
        self.assertEqual(decision.quantity, 2)

        with self.assertRaisesRegex(ModelValidationError, "non-negative whole number"):
            AllocationDecision("bank_a", "hospital_1", "O", "A", -1)

    def test_duplicate_bank_ids_are_rejected(self) -> None:
        scenario = make_scenario()
        duplicate = BloodBank(
            id="bank_a",
            name="Another Bank A",
            location_id="LOC_OTHER",
            inventory={"O": 1, "A": 1},
        )

        with self.assertRaisesRegex(ModelValidationError, "duplicate blood bank id"):
            Scenario(
                id=scenario.id,
                blood_groups=scenario.blood_groups,
                blood_banks=scenario.blood_banks + (duplicate,),
                hospitals=scenario.hospitals,
                routes=(
                    scenario.routes[0],
                    Route("bank_a", "hospital_1", 1, 1, 1, "available"),
                ),
                compatibility=scenario.compatibility,
            )

    def test_unsupported_group_is_rejected(self) -> None:
        scenario = make_scenario()
        scenario.blood_banks[0].inventory["Z"] = 1

        with self.assertRaisesRegex(ModelValidationError, "unsupported group.*Z"):
            Scenario(
                scenario.id,
                scenario.blood_groups,
                scenario.blood_banks,
                scenario.hospitals,
                scenario.routes,
                scenario.compatibility,
            )

    def test_negative_inventory_and_demand_are_rejected(self) -> None:
        scenario = make_scenario()
        scenario.blood_banks[0].inventory["O"] = -1
        with self.assertRaisesRegex(ModelValidationError, "inventory.O.*non-negative"):
            Scenario(
                scenario.id,
                scenario.blood_groups,
                scenario.blood_banks,
                scenario.hospitals,
                scenario.routes,
                scenario.compatibility,
            )

        scenario = make_scenario()
        scenario.hospitals[0].demand["A"] = -1
        with self.assertRaisesRegex(ModelValidationError, "demand.A.*non-negative"):
            Scenario(
                scenario.id,
                scenario.blood_groups,
                scenario.blood_banks,
                scenario.hospitals,
                scenario.routes,
                scenario.compatibility,
            )

    def test_negative_route_time_and_cost_are_rejected(self) -> None:
        scenario = make_scenario()
        invalid_route = Route("bank_a", "hospital_1", -1, 1, 1, "available")

        with self.assertRaisesRegex(ModelValidationError, "travel_time_minutes.*non-negative"):
            Scenario(
                scenario.id,
                scenario.blood_groups,
                scenario.blood_banks,
                scenario.hospitals,
                (invalid_route,),
                scenario.compatibility,
            )

        invalid_route = Route("bank_a", "hospital_1", 1, 1, -1, "available")
        with self.assertRaisesRegex(ModelValidationError, "transport_cost.*non-negative"):
            Scenario(
                scenario.id,
                scenario.blood_groups,
                scenario.blood_banks,
                scenario.hospitals,
                (invalid_route,),
                scenario.compatibility,
            )

    def test_route_must_reference_known_entities(self) -> None:
        scenario = make_scenario()
        invalid_route = Route("missing_bank", "hospital_1", 1, 1, 1, "available")

        with self.assertRaisesRegex(ModelValidationError, "unknown blood bank id"):
            Scenario(
                scenario.id,
                scenario.blood_groups,
                scenario.blood_banks,
                scenario.hospitals,
                (invalid_route,),
                scenario.compatibility,
            )

    def test_urgency_category_must_be_allowed(self) -> None:
        with self.assertRaisesRegex(ModelValidationError, "low, medium, high, or critical"):
            Urgency(category="urgent", priority_weight=1.0)

    def test_critical_urgency_is_a_supported_synthetic_priority(self) -> None:
        self.assertEqual(Urgency(category="critical", priority_weight=4).category, "critical")


if __name__ == "__main__":
    unittest.main()
