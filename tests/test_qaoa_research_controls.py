"""Controls are explicit experiments; default circuit behavior is preserved."""
import unittest
from unittest.mock import patch
import numpy as np
from scipy.optimize import OptimizeResult
from qiskit.quantum_info import Statevector
from quantum.qaoa_solver import QAOASolver, QAOAConfig
from quantum.ising import convert_qubo_to_ising
from tests.test_qaoa_solver import tiny_qubo


class ResearchControlTests(unittest.TestCase):
    def test_retained_initial_circuit_is_measured_when_optimizer_regresses(self):
        q = tiny_qubo()
        solver = QAOASolver(QAOAConfig(warm_start=True, retain_initial_state=True, shots=128))
        def bad_optimizer(fun, initial, **kwargs):
            options = [np.array([g, b]) for g in (.1, .7, 1.8) for b in (.2, .8, 1.4)]
            values = [fun(x) for x in options]
            i = int(np.argmax(values))
            return OptimizeResult(x=options[i], fun=values[i], nfev=len(options), success=False, message='test regression')
        with patch('quantum.qaoa_solver.minimize', side_effect=bad_optimizer):
            run = solver.solve(q)
        info = run.optimizer_information
        self.assertEqual(info['selected_source'], 'initial_state')
        self.assertEqual(info['final_parameters'], [0.0, 0.0])
        self.assertEqual(info['final_expected_energy'], info['initial_state_expected_energy'])
        self.assertEqual(info['objective_evaluations_total'], info['function_evaluations'] + 1)
        self.assertFalse(info['success']) # optimizer failure remains visible
        self.assertEqual(sum(run.counts.values()), 128)

    def test_zero_and_provided_parameters_change_only_first_restart(self):
        q = tiny_qubo()
        def identity(fun, x, **kwargs):
            return OptimizeResult(x=x, fun=fun(x), nfev=1, success=True, message='identity')
        for strategy, params, expected in [('zero_first', None, [0, 0]), ('provided', (.2, .3), [.2, .3])]:
            seen = []
            def capture(fun, x, **kwargs):
                seen.append(x.copy()); return identity(fun, x, **kwargs)
            with patch('quantum.qaoa_solver.minimize', side_effect=capture):
                result = QAOASolver(QAOAConfig(parameter_initialization=strategy, initial_parameters=params, restarts=2)).solve(q)
            np.testing.assert_allclose(seen[0], expected)
            self.assertFalse(np.allclose(seen[1], expected))
            self.assertEqual(result.optimizer_information['reference_evaluations'], 0)

    def test_greedy_seed_is_explicit_and_does_not_call_lp(self):
        with patch('optimization.milp.MILPSolver.solve_relaxation', side_effect=AssertionError('LP must not run')):
            result = QAOASolver(QAOAConfig(warm_start=True, warm_start_source='greedy', max_iterations=5)).solve(tiny_qubo())
        self.assertEqual(result.optimizer_information['seed_source'], 'greedy')
        self.assertNotIn('seed_fallback_reason', result.optimizer_information)

    def test_parameter_validation_and_nonfinite_state_rejected(self):
        for config in [dict(parameter_initialization='provided'), dict(initial_parameters=(0,0)), dict(parameter_initialization='provided', initial_parameters=(float('nan'),0)), dict(seed=-1), dict(warm_start_source='milp')]:
            with self.assertRaises(ValueError): QAOAConfig(**config)
        q = tiny_qubo(); h = convert_qubo_to_ising(q); solver = QAOASolver()
        for angles, thetas, pairs in [(np.array([0,np.inf]),None,None),(np.zeros(2),np.zeros(1),None),(np.zeros(2),None,[(0,0)])]:
            with self.assertRaises(ValueError): solver.build_circuit(h,angles,thetas=thetas,xy_pairs=pairs)

    def test_api_rejects_bad_parameter_dimensions_and_preserves_controls(self):
        from fastapi.testclient import TestClient
        from backend.main import create_app
        client = TestClient(create_app())
        body = {'scenario_id':'normal','method':'qaoa','qaoa_penalties':{'inventory_penalty_weight':10000,'demand_penalty_weight':10000},'qaoa_config':{'warm_start':True,'retain_initial_state':True,'parameter_initialization':'provided','initial_parameters':[0,0],'warm_start_source':'greedy','max_iterations':5,'shots':32}}
        response=client.post('/demo-run',json=body)
        self.assertEqual(response.status_code,200,response.text)
        result=response.json()['result']
        self.assertTrue(result['experiment_configuration']['qaoa']['retain_initial_state'])
        self.assertEqual(result['optimizer_information']['parameter_initialization'],'provided')
        body['qaoa_config']['initial_parameters']=[0]
        self.assertEqual(client.post('/demo-run',json=body).status_code,422)
