import itertools
import unittest
import numpy as np
from qiskit.quantum_info import Statevector
from quantum.qaoa_solver import encode_register_probabilities, normalize_ising, QAOASolver, QAOAConfig
from quantum.qubo import _binary_weights
from quantum.ising import convert_qubo_to_ising
from tests.test_qaoa_solver import tiny_qubo

class WarmAuditTests(unittest.TestCase):
    def test_all_bounded_registers_integer_and_fractional(self):
        for maximum in range(1, 65):
            pairs = tuple(enumerate(_binary_weights(maximum)))
            for quarter in range(4 * maximum + 1):
                value = quarter / 4
                probabilities = encode_register_probabilities(value, pairs)
                self.assertAlmostEqual(sum(probabilities[i] * w for i, w in pairs), value)
                self.assertTrue(all(0 <= p <= 1 for p in probabilities.values()))
                if value.is_integer():
                    self.assertTrue(all(p in (0, 1) for p in probabilities.values()))

    def test_normalization_preserves_all_energies(self):
        qubo = tiny_qubo()
        original = convert_qubo_to_ising(qubo)
        normalized, scale = normalize_ising(original)
        for bits in itertools.product((0, 1), repeat=qubo.variable_count):
            self.assertAlmostEqual(normalized.energy(bits) * scale, qubo.energy(bits))
        angles = np.array([0.37, 0.29])
        solver = QAOASolver()
        a = Statevector.from_instruction(solver.build_circuit(original, angles))
        b = Statevector.from_instruction(solver.build_circuit(normalized, angles * [scale, 1]))
        self.assertTrue(a.equiv(b))

    def test_warm_mixer_preserves_prepared_state_without_cost(self):
        qubo = tiny_qubo()
        solver = QAOASolver(QAOAConfig(warm_start=True))
        thetas = solver._compute_warm_start_thetas(qubo)
        ising = convert_qubo_to_ising(qubo)
        a = Statevector.from_instruction(solver.build_circuit(ising, np.array([0, 0]), thetas=thetas))
        b = Statevector.from_instruction(solver.build_circuit(ising, np.array([0, 0.7]), thetas=thetas))
        self.assertTrue(a.equiv(b))

    def test_restarts_select_by_expectation_and_preserve_measured_energy(self):
        qubo = tiny_qubo()
        result = QAOASolver(QAOAConfig(warm_start=True, restarts=2, max_iterations=8, shots=64)).solve(qubo)
        info = result.optimizer_information
        self.assertAlmostEqual(info['final_expected_energy'], min(info['restart_expected_energies']))
        self.assertGreaterEqual(result.runtime_seconds, info['preparation_seconds'])
        for candidate in result.ranked_candidates:
            self.assertAlmostEqual(candidate.energy, qubo.energy(tuple(map(int, candidate.bitstring[::-1]))))

    def test_api_preserves_hybrid_controls_and_measured_metrics(self):
        from fastapi.testclient import TestClient
        from backend.main import create_app
        response = TestClient(create_app()).post('/demo-run', json={
            'scenario_id': 'normal', 'method': 'qaoa',
            'qaoa_penalties': {'inventory_penalty_weight': 10000, 'demand_penalty_weight': 10000},
            'qaoa_config': {'warm_start': True, 'warm_start_epsilon': 0.1,
                            'normalize_cost': True, 'restarts': 2, 'shots': 64, 'max_iterations': 8},
        })
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()['result']
        config = result['experiment_configuration']['qaoa']
        self.assertEqual(config['restarts'], 2)
        self.assertEqual(config['warm_start_epsilon'], 0.1)
        self.assertTrue(config['normalize_cost'])
        info = result['optimizer_information']
        self.assertTrue(0 <= info['feasible_shot_rate'] <= 1)
        self.assertEqual(info['seed_source'], 'lp_relaxation')
        self.assertEqual(info['requested_mixer'], 'x')
        self.assertEqual(info['effective_mixer'], 'warm_start')
        self.assertEqual(result['mixer_type'], 'warm_start')
        self.assertTrue(result['warm_start_used'])
        self.assertEqual(info['measured_shots'], sum(result['counts'].values()))
        self.assertGreater(info['circuit_depth'], 0)
        self.assertGreater(info['two_qubit_gate_count'], 0)
        self.assertEqual(info['parameter_count'], 2 * config['p'])
        if info['best_feasible_bitstring'] is not None:
            self.assertIn(info['best_feasible_bitstring'], result['counts'])

    def test_all_four_visible_variants_execute_through_demo_api(self):
        from fastapi.testclient import TestClient
        from backend.main import create_app
        client = TestClient(create_app())
        for warm, mixer in [(False, 'x'), (True, 'x'), (False, 'xy'), (True, 'xy')]:
            with self.subTest(warm_start=warm, mixer=mixer):
                response = client.post('/demo-run', json={
                    'scenario_id': 'normal', 'method': 'qaoa',
                    'qaoa_penalties': {'inventory_penalty_weight': 10000, 'demand_penalty_weight': 10000},
                    'qaoa_config': {'warm_start': warm, 'mixer': mixer, 'shots': 32, 'max_iterations': 5},
                })
                self.assertEqual(response.status_code, 200, response.text)
                result = response.json()['result']
                self.assertEqual(sum(result['counts'].values()), 32)
                config = result['experiment_configuration']['qaoa']
                self.assertEqual(config['warm_start'], warm)
                self.assertEqual(config['mixer'], mixer)
                self.assertEqual(result['mixer_type'], 'xy' if mixer == 'xy' else 'warm_start' if warm else 'x')
