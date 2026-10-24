import unittest
from unittest.mock import patch
import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector,Operator
from research.quantum_experiments.encodings import full_encoding,reduced_encoding,validate_encoding
from research.quantum_experiments.algorithms import Ansatz,Config,cvar,warm_seed
from research.quantum_experiments.metrics import probabilities,success_probability,shots99,wilson,readout_bitflip,sample_metrics
from research.quantum_experiments.instances import scenarios,holdout,WEIGHTS
from research.quantum_experiments.classical import classical_baselines,local_search
from quantum.qaoa_solver import QAOASolver,QAOAConfig

class ResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s=scenarios()[1];cls.full=full_encoding(cls.s,WEIGHTS);cls.reduced=reduced_encoding(cls.s,WEIGHTS)

    def test_cvar_fractional_boundary_and_mean(self):
        e=np.array([0.,2.,5.]);p=np.array([.1,.6,.3])
        self.assertAlmostEqual(cvar(e,p,.5),1.6)
        self.assertAlmostEqual(cvar(e,p,1),p@e)
        self.assertAlmostEqual(cvar(e,p,.05),0)
        self.assertAlmostEqual(cvar(np.array([2.,0.,2.]),np.array([.2,.1,.7]),.5),1.6)
        with self.assertRaises(ValueError):cvar(e,p,0)

    def test_full_numpy_matches_actual_production_circuits(self):
        for method in ['standard','warm','xy','warm_xy','qubo_cvar']:
            a=Ansatz(self.full,Config(method))
            for seed in (1,7,22):
                angles=np.random.default_rng(seed).normal(size=4)
                actual=Statevector.from_instruction(a.circuit(angles))
                self.assertTrue(actual.equiv(Statevector(a.state(angles))),method)

    def test_reduced_numpy_matches_qiskit_circuits(self):
        for method in ['reduced','reduced_cvar','feasible_grover']:
            a=Ansatz(self.reduced,Config(method))
            for seed in (1,7,22):
                angles=np.random.default_rng(seed).normal(size=4)
                self.assertTrue(Statevector.from_instruction(a.circuit(angles)).equiv(Statevector(a.state(angles))),method)

    def test_reduced_preserves_feasible_allocations_and_objectives(self):
        for s in [scenarios()[0],scenarios()[1],scenarios()[3],holdout()[2],holdout()[-1]]:
            f=full_encoding(s,WEIGHTS);r=reduced_encoding(s,WEIGHTS)
            fa={f.allocations[k]:round(f.objective[k],7) for k in np.flatnonzero(f.feasible)}
            ra={r.allocations[k]:round(r.objective[k],7) for k in np.flatnonzero(r.feasible)}
            self.assertEqual(fa,ra,s.id)
            validate_encoding(r,f.optimum)
            self.assertEqual(len(r.allocations),len(set(r.allocations)) if len(r.registers) else 2)

    def test_grover_preserves_full_feasible_subspace(self):
        e=self.reduced;a=Ansatz(e,Config('feasible_grover',p=1))
        qc=a.circuit(np.array([.3,.7]));mix=QuantumCircuit(e.n)
        for instruction in qc.data[1:]:mix.append(instruction.operation,[qc.find_bit(q).index for q in instruction.qubits])
        u=Operator(mix).data
        self.assertLess(np.max(np.abs(u[np.ix_(~e.feasible,e.feasible)]),initial=0),1e-10)
        for angles in [np.array([.3,.7]),np.array([2.1,-.2])]:
            p=abs(a.state(angles))**2;self.assertAlmostEqual(p[e.feasible].sum(),1)

    def test_grover_reflection_analytic(self):
        e=self.reduced;a=Ansatz(e,Config('feasible_grover',p=1));v=a.initial
        beta=.7;u=np.eye(len(v))+(np.exp(-1j*beta)-1)*np.outer(v,v.conj())
        np.testing.assert_allclose(u.conj().T@u,np.eye(len(v)),atol=1e-12)
        self.assertTrue(Statevector(u@v).equiv(Statevector(a.state(np.array([0,beta])))))

    def test_seed_equivalence_and_truthful_failure(self):
        theta,info=warm_seed(self.full,.1)
        prod=QAOASolver(QAOAConfig(warm_start=True,warm_start_epsilon=.1))._compute_warm_start_thetas(self.full.qubo)
        np.testing.assert_allclose(theta,prod);self.assertEqual(info['seed_source'],'lp')
        with patch('optimization.milp.MILPSolver.solve_relaxation',side_effect=RuntimeError('injected')),patch('optimization.greedy.GreedyAllocator.solve',side_effect=RuntimeError('injected')):
            theta,info=warm_seed(self.full,.1)
        self.assertFalse(info['actual_warm_start']);self.assertEqual(info['seed_source'],'uniform_fallback')
        np.testing.assert_allclose(theta,np.pi/2)

    def test_greedy_seed_fallback(self):
        with patch('optimization.milp.MILPSolver.solve_relaxation',side_effect=RuntimeError('injected')):
            theta,info=warm_seed(self.full,.1)
        self.assertTrue(info['actual_warm_start']);self.assertEqual(info['seed_source'],'greedy')

    def test_no_shipment_dummy_qubit_not_repaired(self):
        e=reduced_encoding(scenarios()[3],WEIGHTS)
        self.assertEqual(e.n,1);self.assertEqual(list(e.feasible),[True,False]);self.assertGreater(e.energy[1],e.energy[0])

    def test_probability_denominators_and_extremes(self):
        e=self.reduced;p=np.ones(len(e.energy))/len(e.energy);m=probabilities(e,p)
        self.assertAlmostEqual(m['p_optimal_given_feasible'],e.optimal.sum()/e.feasible.sum())
        self.assertEqual(success_probability(0,100),0);self.assertEqual(success_probability(1,1),1)
        self.assertEqual(success_probability(1,0),0);self.assertAlmostEqual(success_probability(.5,2),.75)
        self.assertIsNone(shots99(0));self.assertEqual(shots99(1),1);self.assertEqual(shots99(.5),7)
        self.assertEqual(wilson(0,0),None)

    def test_sampling_reproducible_and_decoding(self):
        e=self.reduced;p=np.ones(len(e.energy))/len(e.energy)
        a=sample_metrics(e,p,1024,3);b=sample_metrics(e,p,1024,3);self.assertEqual(a,b)
        self.assertEqual(sum(a['counts'].values()),1024)
        for key in a['counts']:self.assertLess(int(key,2),len(e.energy))
        self.assertEqual(a['feasible_measurements']+a['infeasible_measurements'],1024)

    def test_readout_noise_can_break_feasibility(self):
        e=self.reduced;p=e.feasible/e.feasible.sum();noisy=readout_bitflip(p,e.n,.03)
        self.assertAlmostEqual(noisy.sum(),1);self.assertLess(noisy[e.feasible].sum(),1)

    def test_classical_baselines_and_search_are_valid(self):
        b=classical_baselines(self.s,WEIGHTS)
        self.assertAlmostEqual(b['milp']['objective'],self.reduced.optimum)
        self.assertAlmostEqual(b['lp']['objective'],self.reduced.optimum)
        a=local_search(self.s,WEIGHTS,7,160);self.assertLessEqual(a['evaluations'],160);self.assertGreaterEqual(a['objective']+1e-7,self.reduced.optimum)


class GroverSearchTests(unittest.TestCase):
    def test_fixed_threshold_amplification_matches_qiskit_and_zero_mark_case(self):
        from research.quantum_experiments.grover_search import threshold_state,threshold_circuit
        e=reduced_encoding(scenarios()[1],WEIGHTS)
        for threshold in (e.optimum, e.optimum+1,10000):
            for iterations in (0,1,2,3):
                state,marked=threshold_state(e,threshold,iterations)
                qc=threshold_circuit(e,threshold,iterations)
                self.assertTrue(Statevector(state).equiv(Statevector.from_instruction(qc)))
                self.assertAlmostEqual(float(np.vdot(state,state).real),1)
                if not marked.any():np.testing.assert_allclose(abs(state)**2,1/len(state))

if __name__=='__main__':unittest.main()
