"""Small real local-simulator checks for Ising conversion and QAOA sampling."""

from __future__ import annotations

import itertools
import unittest

from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig
from quantum.ising import convert_qubo_to_ising
from quantum.qaoa_solver import QAOAConfig, QAOASolver
from quantum.qubo import QUBOPenaltyConfig, build_qubo


def tiny_qubo():
    scenario = Scenario(
        id="qaoa_test", blood_groups=("O",),
        blood_banks=(BloodBank("bank", "Bank A", "B", {"O": 1}),),
        hospitals=(Hospital("hospital", "Hospital 1", "H", {"O": 1},
                            {"O": Urgency("high", 1)}),),
        routes=(Route("bank", "hospital", 1, 1, 1, "available"),),
        compatibility={("O", "O"): True},
    )
    # Penalties exceed the tiny instance's possible objective range.
    return build_qubo(
        scenario, ObjectiveConfig(10, 2, 1, 0.1, 0),
        QUBOPenaltyConfig(1000, 1000),
    )


class IsingConversionTests(unittest.TestCase):
    def test_ising_energy_matches_qubo_for_every_tiny_assignment(self) -> None:
        qubo = tiny_qubo()
        ising = convert_qubo_to_ising(qubo)
        self.assertEqual(ising.variable_mapping, qubo.variable_mapping)
        for bits in itertools.product((0, 1), repeat=qubo.variable_count):
            self.assertAlmostEqual(ising.energy(bits), qubo.energy(bits), places=8)
            qiskit_key = "".join(str(bit) for bit in reversed(bits))
            self.assertAlmostEqual(ising.energy(qiskit_key), qubo.energy(bits), places=8)


class QAOASolverTests(unittest.TestCase):
    def test_local_qaoa_returns_measured_candidates_and_run_metadata(self) -> None:
        qubo = tiny_qubo()
        solver = QAOASolver(QAOAConfig(
            p=1, shots=64, max_iterations=5, seed=11, max_qubits=8,
        ))
        result = solver.solve(qubo)

        self.assertEqual(sum(result.counts.values()), 64)
        self.assertIn(result.best_bitstring, result.counts)
        self.assertEqual(result.qaoa_depth, 1)
        self.assertEqual(result.number_of_shots, 64)
        self.assertEqual(result.variable_mapping, qubo.variable_mapping)
        mapping_order_bits = tuple(
            int(bit) for bit in result.best_bitstring.replace(" ", "")[::-1]
        )
        self.assertAlmostEqual(result.objective_value, qubo.energy(mapping_order_bits))
        self.assertGreaterEqual(result.runtime_seconds, 0)
        self.assertIn("name", result.optimizer_information)
        self.assertIn("not a global", result.result_kind)

    def test_local_qubit_limit_is_reported_before_simulator_run(self) -> None:
        qubo = tiny_qubo()
        solver = QAOASolver(QAOAConfig(max_qubits=1))
        from quantum.qaoa_solver import QAOAResourceLimitError
        with self.assertRaises(QAOAResourceLimitError):
            solver.solve(qubo)


if __name__ == "__main__":
    unittest.main()
