import unittest
from dataclasses import replace
import numpy as np
from qiskit.quantum_info import Statevector
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.flagship import FlagshipRequest, build_flagship
from optimization.milp import MILPSolver
from optimization.exact import ExactSolver
from research.quantum_experiments.encodings import full_encoding
from research.quantum_experiments.algorithms import Ansatz, Config
from tests.test_qaoa_solver import tiny_qubo
from quantum.qaoa_solver import QAOASolver, QAOAConfig
from quantum.qubo import build_qubo, QUBOPenaltyConfig, QUBOInputError, estimate_qubo_variables
from unittest.mock import patch

class FlagshipTests(unittest.TestCase):
    def test_policy_ordering_and_reference_agreement(self):
        for disrupted, policy, expected in [(False,'service_first',(0,1)),(True,'service_first',(1,1)),(False,'weighted',(2,2))]:
            scenario, weights=build_flagship(FlagshipRequest(disrupted=disrupted,policy=policy))
            exact=ExactSolver().solve(scenario,weights)
            milp=MILPSolver().solve(scenario,weights)
            self.assertAlmostEqual(exact.objective_value,milp.objective_value)
            self.assertEqual((milp.objective_breakdown.critical_unmet_units,milp.objective_breakdown.total_unmet_units),expected)

    def test_live_export_has_policy_provenance_and_shortage_explanation(self):
        r=TestClient(create_app()).post('/demo/flagship',json={'method':'milp'})
        self.assertEqual(r.status_code,200,r.text)
        d=r.json(); self.assertTrue(d['result']['feasibility'])
        self.assertEqual(len(d['configuration']['scenario']['blood_banks']),2)
        self.assertEqual(d['qubo_variable_count'],9)
        self.assertTrue(d['shortage_explanations'])

    def test_seed_only_skips_variational_optimizer(self):
        with patch('quantum.qaoa_solver.minimize', side_effect=AssertionError('must not optimize')):
            result=QAOASolver(QAOAConfig(warm_start=True,seed_only=True,shots=16)).solve(tiny_qubo())
        self.assertTrue(result.optimizer_information['seed_only'])
        self.assertEqual(sum(result.counts.values()),16)

    def test_empty_xy_matches_production_state(self):
        q=tiny_qubo(); s=q.scenario
        s=replace(s,blood_banks=(replace(s.blood_banks[0],inventory={'O':0}),))
        enc=full_encoding(s,q.objective_config)
        ansatz=Ansatz(enc,Config(method='xy',p=1))
        angles=np.array([.3,.7])
        np.testing.assert_allclose(abs(ansatz.state(angles))**2,Statevector.from_instruction(ansatz.circuit(angles)).probabilities(),atol=1e-10)

    def test_qubo_limit_precedes_dense_construction(self):
        q=tiny_qubo()
        self.assertEqual(estimate_qubo_variables(q.scenario),q.variable_count)
        with self.assertRaises(QUBOInputError):
            build_qubo(q.scenario,q.objective_config,QUBOPenaltyConfig(10000,10000),max_variables=1)
