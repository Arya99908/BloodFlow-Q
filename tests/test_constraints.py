"""Tests that feasibility reports explain each violated hard rule."""

from __future__ import annotations

import unittest

from optimization.constraints import validate_allocation
from optimization.models import AllocationDecision, BloodBank, Hospital, Route, Scenario, Urgency


def scenario(route_status: str = "available") -> Scenario:
    groups = ("O", "A")
    return Scenario(
        id="constraints_case",
        blood_groups=groups,
        blood_banks=(BloodBank("bank_a", "Bank A", "LOC_B", {"O": 2, "A": 1}),),
        hospitals=(
            Hospital(
                "hospital_1",
                "Hospital 1",
                "LOC_H",
                {"O": 1, "A": 1},
                {
                    "O": Urgency("high", 3),
                    "A": Urgency("low", 1),
                },
            ),
        ),
        routes=(Route("bank_a", "hospital_1", 0, 0, 0, route_status),),  # type: ignore[arg-type]
        compatibility={
            ("O", "O"): True,
            ("O", "A"): True,
            ("A", "O"): False,
            ("A", "A"): True,
        },
    )


class ConstraintReportTests(unittest.TestCase):
    def assert_violation_has_details(self, report: dict, check: str) -> dict:
        violation = next(item for item in report["violations"] if item["check"] == check)
        self.assertIn("message", violation)
        self.assertIn("location", violation)
        self.assertIn("expected", violation)
        self.assertIn("actual", violation)
        return violation

    def test_valid_allocation_returns_structured_feasible_report(self) -> None:
        report = validate_allocation(
            scenario(),
            [AllocationDecision("bank_a", "hospital_1", "O", "O", 1)],
            {("hospital_1", "O"): 0, ("hospital_1", "A"): 1},
        )

        self.assertTrue(report["feasible"])
        self.assertEqual(report["violations"], [])
        self.assertTrue(all(report["checks"].values()))

    def test_inventory_overuse_reports_expected_and_actual(self) -> None:
        report = validate_allocation(
            scenario(),
            [
                AllocationDecision("bank_a", "hospital_1", "O", "O", 2),
                AllocationDecision("bank_a", "hospital_1", "O", "A", 1),
            ],
        )

        self.assertFalse(report["feasible"])
        violation = self.assert_violation_has_details(report, "inventory_constraints")
        self.assertEqual(violation["expected"], "<= 2")
        self.assertEqual(violation["actual"], 3)

    def test_demand_accounting_requires_served_plus_unmet_to_equal_demand(self) -> None:
        report = validate_allocation(
            scenario(),
            [AllocationDecision("bank_a", "hospital_1", "O", "O", 1)],
            {("hospital_1", "O"): 1, ("hospital_1", "A"): 1},
        )

        violation = self.assert_violation_has_details(report, "demand_accounting")
        self.assertEqual(violation["expected"], 1)
        self.assertEqual(violation["actual"], 2)

    def test_incompatible_group_pair_is_reported(self) -> None:
        report = validate_allocation(
            scenario(),
            [AllocationDecision("bank_a", "hospital_1", "A", "O", 1)],
        )

        self.assert_violation_has_details(report, "compatibility")

    def test_blocked_route_is_reported(self) -> None:
        report = validate_allocation(
            scenario("blocked"),
            [AllocationDecision("bank_a", "hospital_1", "O", "O", 1)],
        )

        violation = self.assert_violation_has_details(report, "route_availability")
        self.assertEqual(violation["expected"], "available route")
        self.assertEqual(violation["actual"], "blocked")

    def test_negative_allocation_is_reported_even_if_object_was_bypassed(self) -> None:
        # Normal construction rejects negatives. Simulate an unsafe external
        # decoder modifying a frozen record so the feasibility check is still
        # independently tested against malformed candidate data.
        bad_decision = AllocationDecision("bank_a", "hospital_1", "O", "O", 0)
        object.__setattr__(bad_decision, "quantity", -1)
        report = validate_allocation(scenario(), [bad_decision])

        self.assert_violation_has_details(report, "non_negative_allocations")

    def test_invalid_source_hospital_and_groups_are_separate_checks(self) -> None:
        bad_decision = AllocationDecision("bank_a", "hospital_1", "O", "O", 0)
        object.__setattr__(bad_decision, "source", "bank_missing")
        object.__setattr__(bad_decision, "destination", "hospital_missing")
        object.__setattr__(bad_decision, "blood_group", "Z")
        report = validate_allocation(scenario(), [bad_decision])

        for check in ("valid_source_ids", "valid_hospital_ids", "valid_blood_groups"):
            self.assert_violation_has_details(report, check)


if __name__ == "__main__":
    unittest.main()
