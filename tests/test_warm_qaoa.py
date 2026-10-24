"""Regression tests for the LP-seeded bounded-register QAOA variant."""
from __future__ import annotations

import unittest
from unittest.mock import patch

import numpy as np

from optimization.decoder import evaluate_quantum_solution
from optimization.milp import MILPSolver
from quantum.qaoa_solver import QAOAConfig, QAOASolver
from tests.test_qaoa_solver import tiny_qubo


class WarmQAOAEncodingTests(unittest.TestCase):
    def test_lp_solution_is_a_continuous_feasible_seed_with_recorded_objective(self):
        qubo = tiny_qubo()
        seed, metadata = QAOASolver(QAOAConfig(warm_start=True))._prepare_warm_start(qubo)
        self.assertEqual(metadata["seed_source"], "lp_relaxation")
        self.assertEqual(metadata["seed_feasibility"], "feasible_continuous_relaxation")
        self.assertIsInstance(metadata["seed_objective"], float)
        self.assertGreaterEqual(metadata["seed_preprocessing_seconds"], 0)
        self.assertEqual(seed.shape, (qubo.variable_count,))
        self.assertTrue(np.all(np.isfinite(seed)))

    def test_lp_failure_falls_back_to_validated_greedy_not_milp_optimum(self):
        qubo = tiny_qubo()
        with patch("optimization.milp.MILPSolver.solve_relaxation", side_effect=RuntimeError("LP unavailable")):
            result = QAOASolver(QAOAConfig(warm_start=True, shots=32, max_iterations=2)).solve(qubo)
        info = result.optimizer_information
        self.assertEqual(info["seed_source"], "greedy_fallback")
        self.assertEqual(info["seed_feasibility"], "feasible_integer")
        self.assertIn("LP relaxation unavailable", info["seed_fallback_reason"])
        self.assertEqual(sum(result.counts.values()), 32)

    def test_feasible_shot_rate_uses_independent_operational_validator(self):
        qubo = tiny_qubo()
        result = QAOASolver(QAOAConfig(warm_start=True, shots=64, max_iterations=3)).solve(qubo)
        valid = 0
        for bitstring, count in result.counts.items():
            if evaluate_quantum_solution(qubo, bitstring).feasibility:
                valid += count
        info = result.optimizer_information
        self.assertEqual(info["feasible_shots"], valid)
        self.assertEqual(info["measured_shots"], 64)
        self.assertAlmostEqual(info["feasible_shot_rate"], valid / 64)

    def test_lp_metadata_does_not_break_existing_research_map_consumers(self):
        qubo = tiny_qubo()
        plain = MILPSolver().solve_relaxation(qubo.scenario, qubo.objective_config)
        detailed = MILPSolver().solve_relaxation(qubo.scenario, qubo.objective_config, include_metadata=True)
        self.assertEqual(set(plain), {"allocation", "unmet_demand", "slack"})
        for key in plain:
            self.assertEqual(plain[key], detailed[key])
        self.assertIsInstance(detailed["objective_value"], float)


if __name__ == "__main__":
    unittest.main()
