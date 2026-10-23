import unittest
import numpy as np
from qiskit.quantum_info import Statevector
from research.quantum_experiments.instances import generated
from research.quantum_experiments.necessity.model import Task
from research.quantum_experiments.necessity.ablation import table,decode,amplify,circuit,improve,selected_variables
from research.quantum_experiments.necessity.run import fees_for

class NecessityTests(unittest.TestCase):
    def test_model_exhaustive_objective_and_milp(self):
        s=generated(1,1,('O','A'),100,'test',2)
        for fees in (None,fees_for(s,2)):
            t=Task(s,fees);inc=np.zeros(len(t.keys),int);selected=list(range(len(inc)));values,n=table(t,inc,selected)
            for k,val in enumerate(values):
                if np.isfinite(val):self.assertAlmostEqual(t.validate(decode(t,inc,selected,k)),val)
            x,info=t.solve();self.assertTrue(info['proven_optimal']);self.assertAlmostEqual(t.score(x),min(values))
            _,lp=t.solve(relaxation=True);self.assertLessEqual(lp['objective'],min(values)+1e-7)
    def test_fixed_fee_shared_across_groups(self):
        s=generated(1,1,('O','A'),100,'test',2);t=Task(s,{('b0','h0'):7});original=Task(s)
        x=np.array([int(k[2]==k[3]) for k in t.keys]);self.assertTrue(np.isfinite(t.score(x)));self.assertAlmostEqual(t.score(x)-original.score(x),7)
    def test_frozen_neighborhood_matches_exhaustive(self):
        t=Task(generated(2,2,('O',),101,'test',2));inc=t.greedy();selected=[0,1];values,n=table(t,inc,selected)
        x,info=t.solve(1,inc,selected);self.assertTrue(info['proven_optimal']);self.assertAlmostEqual(t.score(x),min(values))
        for j in set(range(len(inc)))-set(selected):self.assertEqual(x[j],inc[j])
    def test_quantum_circuit_matches_array_and_zero_marks(self):
        for marked in (np.array([False]*8),np.array([False,True,False,False,True,False,False,False])):
            for r in range(4):
                p=amplify(marked,r);actual=Statevector.from_instruction(circuit(marked,r)).probabilities();np.testing.assert_allclose(p,actual,atol=1e-12)
    def test_replacement_dominates_and_budget_accounting(self):
        t=Task(generated(2,2,('O',),103,'test',2));inc=t.greedy();selected=selected_variables(t,np.random.default_rng(1),6)
        exact,er=improve(t,inc,selected,'table_lookup',3,1,16)
        for method in ('quantum','uniform','milp'):
            x,r=improve(t,inc,selected,method,3,1,16);self.assertLessEqual(t.score(exact),t.score(x)+1e-7);self.assertLessEqual(t.score(x),t.score(inc)+1e-7)
            self.assertLessEqual(r['oracle_calls']+r['candidate_evaluations'],16)
            if method=='quantum':self.assertEqual(r['table_evaluations'],er['table_evaluations'])
    def test_integral_shipments_do_not_certify_dispatch_lp(self):
        scenario=generated(3,3,('O','A'),7301,'dispatch_lp',2)
        task=Task(scenario,fees_for(scenario,8301))
        x,integer=task.solve();_,relaxed=task.solve(relaxation=True)
        self.assertTrue(integer['proven_optimal'])
        self.assertTrue(relaxed['integral_shipments'])
        self.assertLess(relaxed['objective'],task.score(x)-1e-7)

    def test_sampling_repeatable(self):
        t=Task(generated(2,2,('O',),104,'test',2));inc=t.greedy();sel=list(range(len(inc)))
        x,a=improve(t,inc,sel,'quantum',7,5,16);y,b=improve(t,inc,sel,'quantum',7,5,16)
        np.testing.assert_array_equal(x,y);self.assertEqual(a['attempts'],b['attempts'])

if __name__=='__main__':unittest.main()
