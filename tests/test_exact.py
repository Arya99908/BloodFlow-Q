"""Tests for the capped exhaustive solver on tiny synthetic problems."""

from __future__ import annotations

import unittest

from optimization.exact import (
    ExactSolverConfig,
    ExactSolverLimitError,
    solve_exact,
)
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig


def exact_scenario() -> Scenario:
    groups = ("O", "A")
    return Scenario(
        id="known_optimum",
        blood_groups=groups,
        blood_banks=(BloodBank("bank_a", "Bank A", "LOC_B", {"O": 1, "A": 1}),),
        hospitals=(
            Hospital(
                "hospital_1", "Hospital 1", "LOC_H", {"O": 1, "A": 1},
                {"O": Urgency("high", 2), "A": Urgency("low", 1)},
            ),
        ),
        routes=(Route("bank_a", "hospital_1", 1, 1, 1, "available"),),
        compatibility={
            ("O", "O"): True,
            ("O", "A"): True,
            ("A", "O"): False,
            ("A", "A"): True,
        },
    )


def weights() -> ObjectiveConfig:
    return ObjectiveConfig(10, 10, 1, 1, 0)


class ExactSolverTests(unittest.TestCase):
    def test_finds_known_global_optimum_and_reports_feasibility(self) -> None:
        result = solve_exact(exact_scenario(), weights())

        self.assertTrue(result.feasibility_report["feasible"])
        self.assertEqual(result.objective_value, 4)
        self.assertEqual(result.objective_breakdown.total_unmet_units, 0)
        self.assertEqual(
            {(d.blood_group, d.recipient_group, d.quantity) for d in result.allocation},
            {("O", "O", 1), ("A", "A", 1)},
        )
        self.assertEqual(result.examined_candidate_count, 8)
        self.assertGreater(result.feasible_candidate_count, 0)

    def test_refuses_to_search_when_state_count_exceeds_cap(self) -> None:
        with self.assertRaisesRegex(ExactSolverLimitError, "exceeds configured limit"):
            solve_exact(
                exact_scenario(),
                weights(),
                solver_config=ExactSolverConfig(max_candidate_states=7),
            )

    def test_nonpositive_search_cap_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "positive whole number"):
            ExactSolverConfig(max_candidate_states=0)


if __name__ == "__main__":
    unittest.main()
