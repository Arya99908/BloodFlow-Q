"""Tests for deterministic greedy allocation behavior."""

from __future__ import annotations

import unittest

from optimization.greedy import allocate_greedily
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig


def objective_config() -> ObjectiveConfig:
    return ObjectiveConfig(critical_unmet_weight=10, total_unmet_weight=5,
                           transportation_cost_weight=1,
                           transportation_time_weight=0.1,
                           secondary_penalty_weight=1)


def small_scenario(stock_o: int = 2, stock_a: int = 1) -> Scenario:
    groups = ("O", "A")
    return Scenario(
        id="greedy_case",
        blood_groups=groups,
        blood_banks=(BloodBank("bank_a", "Bank A", "LOC_B", {"O": stock_o, "A": stock_a}),),
        hospitals=(
            Hospital(
                "hospital_1", "Hospital 1", "LOC_H", {"O": 1, "A": 1},
                {"O": Urgency("high", 3), "A": Urgency("medium", 2)},
            ),
        ),
        routes=(Route("bank_a", "hospital_1", 10, 5, 2, "available"),),
        compatibility={
            ("O", "O"): True,
            ("O", "A"): True,
            ("A", "O"): False,
            ("A", "A"): True,
        },
    )


class GreedyTests(unittest.TestCase):
    def test_fills_compatible_demand_and_returns_all_requested_outputs(self) -> None:
        result = allocate_greedily(small_scenario(), objective_config())

        self.assertEqual(result.unmet_demand, {("hospital_1", "O"): 0, ("hospital_1", "A"): 0})
        self.assertTrue(result.feasibility_report["feasible"])
        self.assertEqual(result.objective_breakdown.total_unmet_units, 0)
        self.assertEqual(sum(decision.quantity for decision in result.allocation), 2)

    def test_high_urgency_row_gets_the_only_compatible_supply_first(self) -> None:
        # O supply can cover both rows, but the A demand also has A supply.
        # With only O stock, the critical O row is filled before medium A.
        scenario = small_scenario(stock_o=1, stock_a=0)
        result = allocate_greedily(scenario, objective_config())

        self.assertEqual(result.unmet_demand[("hospital_1", "O")], 0)
        self.assertEqual(result.unmet_demand[("hospital_1", "A")], 1)
        self.assertTrue(result.feasibility_report["feasible"])

    def test_same_inputs_produce_same_allocation(self) -> None:
        first = allocate_greedily(small_scenario(), objective_config())
        second = allocate_greedily(small_scenario(), objective_config())

        self.assertEqual(first.allocation, second.allocation)
        self.assertEqual(first.unmet_demand, second.unmet_demand)


if __name__ == "__main__":
    unittest.main()
