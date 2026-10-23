"""Exploratory optimizer-only intervention; production solver is unchanged.
First random restart is replaced with zero angles, using the same evaluation cap.
"""
import json,math
from pathlib import Path
from unittest.mock import patch
import numpy as np
from scipy.optimize import minimize
from qiskit.quantum_info import Statevector
from experiments.deep_qaoa_audit import scenarios,WEIGHTS,SEEDS
from quantum.qubo import build_qubo,QUBOPenaltyConfig,compute_conservative_objective_bound
from quantum.ising import convert_qubo_to_ising
from quantum.qaoa_solver import QAOASolver,QAOAConfig,normalize_ising
from optimization.exact import ExactSolver

with Path('audit/deep_qaoa_20261023/zero_start.jsonl').open('x') as f:
 for s in scenarios():
  if s.id not in ('normal_reference','emergency_16','multi_facility'): continue
  penalty=max(1,math.ceil(1.5*compute_conservative_objective_bound(s,WEIGHTS)))
  q=build_qubo(s,WEIGHTS,QUBOPenaltyConfig(penalty,penalty));h,_=normalize_ising(convert_qubo_to_ising(q));exact=ExactSolver().solve(s,WEIGHTS).objective_value
  es=[q.evaluate_assignment(tuple((k>>i)&1 for i in range(q.variable_count))) for k in range(2**q.variable_count)]
  optimal=np.array([e.total_penalty==0 and abs(e.classical_objective-exact)<1e-7 for e in es])
  for mixer in ('x','xy'):
   for seed in SEEDS[:3]:
    cfg=QAOAConfig(p=2,restarts=2,max_iterations=100,shots=1024,seed=seed,warm_start=True,warm_start_epsilon=.1,mixer=mixer)
    solver=QAOASolver(cfg);calls=[0]
    def modified(fun,x0,**kwargs):
     calls[0]+=1
     return minimize(fun,np.zeros_like(x0) if calls[0]==1 else x0,**kwargs)
    with patch('quantum.qaoa_solver.minimize',side_effect=modified): res=solver.solve(q)
    theta=solver._compute_warm_start_thetas(q)
    state=Statevector.from_instruction(solver.build_circuit(h,np.array(res.optimizer_information['final_parameters']),thetas=theta,xy_pairs=solver._compute_xy_pairs(q) if mixer=='xy' else None))
    row={'scenario':s.id,'mixer':mixer,'seed':seed,'optimal_probability':float(state.probabilities()[optimal].sum()),'optimizer':dict(res.optimizer_information),'counts':dict(res.counts)}
    f.write(json.dumps(row)+'\n'); f.flush();print(s.id,mixer,seed,row['optimal_probability'],flush=True)
