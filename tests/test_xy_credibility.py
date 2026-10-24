"""Structural checks of the production mixer; no optimizer required."""
import unittest
from unittest.mock import patch
import numpy as np
from scipy.linalg import expm
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector, Operator
from tests.test_qaoa_solver import tiny_qubo
from quantum.qaoa_solver import QAOASolver, QAOAConfig, normalize_ising
from quantum.ising import convert_qubo_to_ising

class XYCredibilityTests(unittest.TestCase):
    def test_two_qubit_exchange_matches_generator(self):
        x=np.array([[0,1],[1,0]]); y=np.array([[0,-1j],[1j,0]])
        for beta in (0, .13, .7, -1.2):
            qc=QuantumCircuit(2); qc.rxx(beta,0,1); qc.ryy(beta,0,1)
            np.testing.assert_allclose(Operator(qc).data, expm(-1j*beta*(np.kron(x,x)+np.kron(y,y))/2),atol=1e-12)

    def test_full_xy_circuit_preserves_each_weight_sector(self):
        q=tiny_qubo(); n=q.variable_count
        solver=QAOASolver(QAOAConfig(mixer='xy',p=2))
        h,_=normalize_ising(convert_qubo_to_ising(q))
        for k in range(2**n):
            theta=np.array([np.pi*((k>>i)&1) for i in range(n)])
            state=Statevector.from_instruction(solver.build_circuit(h,np.array([.31,.62,.43,.78]),thetas=theta,xy_pairs=solver._compute_xy_pairs(q)))
            outside=sum(p for j,p in enumerate(state.probabilities()) if j.bit_count()!=k.bit_count())
            self.assertLess(outside,1e-12)

    def test_feasible_basis_state_leaks_out_of_allocation_constraints(self):
        q=tiny_qubo(); n=q.variable_count; h=convert_qubo_to_ising(q)
        solver=QAOASolver(QAOAConfig(mixer='xy'))
        feasible=np.array([q.evaluate_assignment(tuple((k>>i)&1 for i in range(n))).total_penalty==0 for k in range(2**n)])
        leakage=[]
        for k in np.flatnonzero(feasible):
            theta=np.array([np.pi*((int(k)>>i)&1) for i in range(n)])
            state=Statevector.from_instruction(solver.build_circuit(h,np.array([0,.7]),thetas=theta,xy_pairs=solver._compute_xy_pairs(q)))
            leakage.append(float(state.probabilities()[~feasible].sum()))
        # This characterizes a limitation, not a guarantee of feasible mixing.
        self.assertGreater(max(leakage),.1)

    def test_xy_sector_mass_fixed_for_warm_and_uniform_states(self):
        q=tiny_qubo(); n=q.variable_count; h,_=normalize_ising(convert_qubo_to_ising(q))
        for warm in (False,True):
            solver=QAOASolver(QAOAConfig(mixer='xy',warm_start=warm,p=2))
            theta=solver._compute_warm_start_thetas(q) if warm else None
            states=[Statevector.from_instruction(solver.build_circuit(h,np.array(a),thetas=theta,xy_pairs=solver._compute_xy_pairs(q))) for a in ([0,0,0,0],[.3,.8,.5,.2])]
            masses=[[sum(p for k,p in enumerate(s.probabilities()) if k.bit_count()==w) for w in range(n+1)] for s in states]
            np.testing.assert_allclose(*masses,atol=1e-12)

    def test_warm_x_alias_uses_warm_mixer(self):
        q=tiny_qubo(); h=convert_qubo_to_ising(q)
        a=QAOASolver(QAOAConfig(warm_start=True,mixer='x'))
        b=QAOASolver(QAOAConfig(mixer='warm_start'))
        theta=a._compute_warm_start_thetas(q)
        self.assertTrue(Statevector.from_instruction(a.build_circuit(h,np.array([.3,.4]),thetas=theta)).equiv(Statevector.from_instruction(b.build_circuit(h,np.array([.3,.4]),thetas=theta))))

    def test_double_seed_failure_reports_uniform_fallback(self):
        q=tiny_qubo(); solver=QAOASolver(QAOAConfig(warm_start=True,max_iterations=5,shots=32))
        with patch('optimization.milp.MILPSolver.solve_relaxation',side_effect=RuntimeError('test failure')), patch('optimization.greedy.GreedyAllocator.solve',side_effect=RuntimeError('test failure')):
            np.testing.assert_allclose(solver._compute_warm_start_thetas(q),np.pi/2)
            result=solver.solve(q)
        self.assertFalse(result.warm_start_used)
        self.assertTrue(result.optimizer_information['warm_start_requested'])
        self.assertEqual(result.optimizer_information['seed_source'], 'uniform_fallback')
        self.assertIn('greedy fallback unavailable', result.optimizer_information['seed_fallback_reason'])

    def test_empty_xy_graph_preserves_state(self):
        from dataclasses import replace
        from quantum.qubo import build_qubo, QUBOPenaltyConfig
        q=tiny_qubo(); base=q.scenario
        one=replace(base,blood_banks=(replace(base.blood_banks[0],inventory={'O':0}),))
        q=build_qubo(one,q.objective_config,QUBOPenaltyConfig(1000,1000))
        self.assertEqual(q.variable_count,1)
        solver=QAOASolver(QAOAConfig(mixer='xy'))
        self.assertEqual(solver._compute_xy_pairs(q),())
        qc=solver.build_circuit(convert_qubo_to_ising(q),np.array([0,.7]),thetas=np.array([0.]),xy_pairs=())
        self.assertNotIn('rx',qc.count_ops())
        self.assertAlmostEqual(Statevector.from_instruction(qc).probabilities()[1],0.0)
