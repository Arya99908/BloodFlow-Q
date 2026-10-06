"""Consistency checks between the QUBO polynomial and classical model."""

from __future__ import annotations

import itertools
import random
import unittest

from optimization.constraints import validate_allocation
from optimization.exact import solve_exact
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig, calculate_objective
from quantum.qubo import QUBOInputError, QUBOPenaltyConfig, build_qubo


def tiny_scenario() -> Scenario:
    return Scenario(
        id="qubo_tiny",
        blood_groups=("O", "A"),
        blood_banks=(BloodBank("bank_a", "Bank A", "B", {"O": 1, "A": 1}),),
        hospitals=(Hospital(
            "hospital_1", "Hospital 1", "H", {"O": 1, "A": 1},
            {"O": Urgency("high", 2), "A": Urgency("low", 1)},
        ),),
        routes=(Route("bank_a", "hospital_1", 3, 2, 4, "available"),),
        compatibility={("O", "O"): True, ("O", "A"): True,
                       ("A", "O"): False, ("A", "A"): True},
    )


def objective_config() -> ObjectiveConfig:
    return ObjectiveConfig(critical_unmet_weight=5, total_unmet_weight=2,
                           transportation_cost_weight=0.5,
                           transportation_time_weight=0.25,
                           secondary_penalty_weight=3)


def built(scenario: Scenario | None = None):
    return build_qubo(scenario or tiny_scenario(), objective_config(),
                      QUBOPenaltyConfig(100, 100), {"fixed example": 2})


class QUBOConsistencyTests(unittest.TestCase):
    def test_random_feasible_and_infeasible_bitstrings_match_polynomial(self) -> None:
        qubo = built()
        rng = random.Random(20261006)
        assignments = [tuple(0 for _ in range(qubo.variable_count)),
                       tuple(1 for _ in range(qubo.variable_count))]
        assignments.extend(tuple(rng.randint(0, 1) for _ in range(qubo.variable_count))
                           for _ in range(100))

        feasible_count = 0
        infeasible_count = 0
        for bits in assignments:
            evaluation = qubo.evaluate_assignment(bits)
            expected = (evaluation.classical_objective
                        + evaluation.inventory_penalty
                        + evaluation.demand_penalty)
            # The polynomial includes the constant offset. Without it, the
            # same minimizers are retained but reported energies are shifted.
            self.assertAlmostEqual(qubo.energy(bits), expected, places=8)
            self.assertAlmostEqual(evaluation.energy, expected, places=8)
            report = validate_allocation(
                qubo.scenario, evaluation.decoded.allocation,
                evaluation.decoded.unmet_demand,
            )
            # QUBO feasibility includes the inventory-slack equality too;
            # the shared classical validator has no slack variable to inspect.
            if report["feasible"] and evaluation.total_penalty == 0:
                feasible_count += 1
                classical = calculate_objective(
                    qubo.scenario, evaluation.decoded.allocation,
                    qubo.objective_config, qubo.secondary_penalties,
                )
                self.assertAlmostEqual(classical.total_objective,
                                       evaluation.classical_objective, places=8)
            elif report["feasible"]:
                # The shipment itself is valid, but the chosen slack bits do
                # not equal the actual unused inventory and must be penalized.
                infeasible_count += 1
                self.assertGreater(evaluation.total_penalty, 0)
            else:
                infeasible_count += 1
                self.assertGreater(evaluation.total_penalty, 0)
        self.assertGreater(feasible_count, 0)
        self.assertGreater(infeasible_count, 0)

    def test_bit_mapping_decodes_to_the_declared_decision_quantity(self) -> None:
        qubo = built()
        for variable in qubo.variable_mapping:
            self.assertEqual(variable.index, qubo.variable_mapping.index(variable))
            bits = [0] * qubo.variable_count
            bits[variable.index] = 1
            decoded = qubo.decode(bits)
            if variable.kind == "allocation":
                matching = [decision for decision in decoded.allocation
                            if (decision.source, decision.destination,
                                decision.blood_group, decision.recipient_group)
                            == (variable.source, variable.hospital,
                                variable.blood_group, variable.recipient_group)]
                quantity = matching[0].quantity if matching else 0
            elif variable.kind == "unmet":
                quantity = decoded.unmet_demand[(variable.hospital, variable.recipient_group)]
            else:
                quantity = decoded.inventory_slack[(variable.source, variable.blood_group)]
            self.assertEqual(quantity, variable.bit_weight)
            self.assertIn("bit contributes", variable.decision_meaning)

    def test_ineligible_route_and_compatibility_have_no_allocation_bits(self) -> None:
        scenario = Scenario(
            id="filtered", blood_groups=("O", "A"),
            blood_banks=(BloodBank("bank", "Bank", "B", {"O": 1, "A": 1}),),
            hospitals=(Hospital("hospital", "Hospital", "H", {"O": 1, "A": 1},
                                {"O": Urgency("low", 1), "A": Urgency("low", 1)}),),
            routes=(Route("bank", "hospital", 1, 1, 1, "blocked"),),
            compatibility={("O", "O"): True, ("O", "A"): False,
                           ("A", "O"): False, ("A", "A"): True},
        )
        qubo = build_qubo(scenario, objective_config(), QUBOPenaltyConfig(50, 50))
        self.assertFalse(any(item.kind == "allocation" for item in qubo.variable_mapping))

    def test_penalties_must_exceed_conservative_objective_bound(self) -> None:
        with self.assertRaisesRegex(QUBOInputError, "objective upper bound"):
            build_qubo(tiny_scenario(), objective_config(), QUBOPenaltyConfig(1, 100))

    def test_tiny_qubo_minimum_matches_classical_exact_solver(self) -> None:
        qubo = built()
        exact = solve_exact(tiny_scenario(), objective_config())
        minimum = min(qubo.energy(bits)
                      for bits in itertools.product((0, 1), repeat=qubo.variable_count))
        expected = exact.objective_value + 3 * 2  # configured fixed secondary amount
        self.assertAlmostEqual(minimum, expected, places=8)
        best_bits = min(itertools.product((0, 1), repeat=qubo.variable_count), key=qubo.energy)
        decoded = qubo.decode(best_bits)
        self.assertTrue(validate_allocation(tiny_scenario(), decoded.allocation,
                                           decoded.unmet_demand)["feasible"])

    def test_hand_inspectable_one_unit_qubo(self) -> None:
        scenario = Scenario(
            id="one_unit", blood_groups=("O",),
            blood_banks=(BloodBank("bank", "Bank", "B", {"O": 1}),),
            hospitals=(Hospital("hospital", "Hospital", "H", {"O": 1},
                                {"O": Urgency("high", 1)}),),
            routes=(Route("bank", "hospital", 0, 0, 0, "available"),),
            compatibility={("O", "O"): True},
        )
        objective = ObjectiveConfig(2, 1, 0, 0, 0)
        qubo = build_qubo(scenario, objective, QUBOPenaltyConfig(4, 4))
        self.assertEqual([item.kind for item in qubo.variable_mapping],
                         ["allocation", "unmet", "slack"])
        self.assertEqual(qubo.constant_offset, 8)
        self.assertEqual(qubo.matrix, ((-8, 4, 4), (4, -1, 0), (4, 0, -4)))
        self.assertEqual(qubo.energy((1, 0, 0)), 0)
        self.assertEqual(qubo.energy((0, 1, 1)), 3)

    def test_invalid_bitstrings_are_rejected(self) -> None:
        qubo = built()
        with self.assertRaisesRegex(QUBOInputError, "exactly"):
            qubo.energy((0,))
        with self.assertRaisesRegex(QUBOInputError, "0 or 1"):
            qubo.energy((2,) + (0,) * (qubo.variable_count - 1))

    def test_qubo_metadata_points_to_separate_qaoa_execution_module(self) -> None:
        qubo = built()
        self.assertEqual(qubo.metadata["qaoa_status"], "implemented_separately")
        self.assertEqual(qubo.metadata["qaoa_solver_module"], "quantum.qaoa_solver")


if __name__ == "__main__":
    unittest.main()
