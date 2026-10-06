"""Tests for transparent QAOA candidate validation and scoring."""

from __future__ import annotations

import unittest

from optimization.decoder import evaluate_quantum_solution
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig
from quantum.qubo import QUBOPenaltyConfig, build_qubo


def build_tiny_qubo():
    scenario = Scenario(
        id="quantum_evaluation",
        blood_groups=("O",),
        blood_banks=(BloodBank("bank", "Bank A", "B", {"O": 2}),),
        hospitals=(Hospital("hospital", "Hospital 1", "H", {"O": 2},
                            {"O": Urgency("critical", 2)}),),
        routes=(Route("bank", "hospital", 10, 3, 2, "available"),),
        compatibility={("O", "O"): True},
    )
    weights = ObjectiveConfig(5, 2, 1, 0.1, 0)
    return build_qubo(scenario, weights, QUBOPenaltyConfig(100, 100))


def qiskit_key_from_mapping_bits(bits: list[int]) -> str:
    return "".join(str(bit) for bit in reversed(bits))


class QuantumSolutionEvaluationTests(unittest.TestCase):
    def test_feasible_candidate_flows_through_validator_and_objective(self) -> None:
        qubo = build_tiny_qubo()
        bits = [0] * qubo.variable_count
        for variable in qubo.variable_mapping:
            if variable.kind == "allocation":
                bits[variable.index] = 1  # both unit bits sum to two units
        result = evaluate_quantum_solution(qubo, qiskit_key_from_mapping_bits(bits))

        self.assertTrue(result.feasibility)
        self.assertEqual(result.violations, ())
        self.assertEqual(len(result.decoded_allocation), 1)
        self.assertEqual(result.decoded_allocation[0].quantity, 2)
        self.assertEqual(result.total_unmet_demand, 0)
        self.assertEqual(result.critical_satisfaction["satisfied_units"], 2)
        self.assertEqual(result.critical_satisfaction["total_units"], 2)
        self.assertEqual(result.critical_satisfaction["rate"], 1)
        self.assertEqual(result.transport_cost, 4)
        self.assertEqual(result.average_transport_time, 10)
        self.assertEqual(result.total_objective, result.objective_breakdown.total_objective)
        self.assertIn("classical objective calculator", result.objective_basis)

    def test_infeasible_candidate_is_reported_unmodified(self) -> None:
        qubo = build_tiny_qubo()
        bits = [0] * qubo.variable_count
        for variable in qubo.variable_mapping:
            if variable.kind in {"allocation", "unmet"}:
                bits[variable.index] = 1  # sends two and also marks two unmet
        original_key = qiskit_key_from_mapping_bits(bits)
        result = evaluate_quantum_solution(qubo, original_key)

        self.assertFalse(result.feasibility)
        self.assertGreater(len(result.violations), 0)
        self.assertEqual(result.decoded_candidate.bits_in_mapping_order, tuple(bits))
        self.assertEqual(result.decoded_allocation[0].quantity, 2)
        self.assertEqual(result.unmet_demand[("hospital", "O")], 2)
        self.assertEqual(result.total_unmet_demand, 2)
        self.assertIn("not a feasible allocation score", result.objective_basis)
        # No repair silently changed the input candidate.
        self.assertEqual(qiskit_key_from_mapping_bits(list(result.decoded_candidate.bits_in_mapping_order)),
                         original_key)


if __name__ == "__main__":
    unittest.main()
