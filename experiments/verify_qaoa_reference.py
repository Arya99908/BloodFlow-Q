"""Check QUBO feasibility and objective against allocation-domain definitions."""
import json, math
from pathlib import Path
import numpy as np
from experiments.deep_qaoa_audit import scenarios, WEIGHTS
from quantum.qubo import build_qubo,QUBOPenaltyConfig,compute_conservative_objective_bound
from quantum.qaoa_solver import QAOASolver,QAOAConfig,encode_register_probabilities
from optimization.objective import calculate_objective
from optimization.constraints import validate_allocation
from optimization.exact import ExactSolver
from optimization.milp import MILPSolver

out=[]
for s in scenarios():
    penalty=max(1,math.ceil(1.5*compute_conservative_objective_bound(s,WEIGHTS)))
    q=build_qubo(s,WEIGHTS,QUBOPenaltyConfig(penalty,penalty)); checked=0
    for k in range(2**q.variable_count):
        bits=tuple((k>>i)&1 for i in range(q.variable_count)); e=q.evaluate_assignment(bits); d=e.decoded
        # Validator checks shipments/unmet; separately check all inventory slack equalities.
        v=validate_allocation(s,d.allocation,d.unmet_demand)
        slack_ok=all(sum(a.quantity for a in d.allocation if a.source==bank.id and a.blood_group==g)+d.inventory_slack.get((bank.id,g),0)==stock for bank in s.blood_banks for g,stock in bank.inventory.items())
        assert (e.total_penalty==0)==(v['feasible'] and slack_ok),(s.id,k)
        if e.total_penalty==0:
            obj=calculate_objective(s,d.allocation,WEIGHTS).total_objective
            assert abs(obj-e.classical_objective)<1e-7
        checked+=1
    lp=MILPSolver().solve_relaxation(s,WEIGHTS)
    integral=all(abs(v-round(v))<1e-7 for values in lp.values() for v in values.values())
    bits=np.zeros(q.variable_count,dtype=int)
    if integral:
        for (kind,key),pairs in q._integer_bit_indices.items():
            source={'allocation':'allocation','unmet':'unmet_demand','slack':'slack'}[kind]
            for i,v in encode_register_probabilities(lp[source].get(key,0),pairs).items(): bits[i]=round(v)
        entry=q.evaluate_assignment(tuple(map(int,bits)))
        exact=ExactSolver().solve(s,WEIGHTS).objective_value
        assert entry.total_penalty==0
        optimal=abs(entry.classical_objective-exact)<1e-7
    else: optimal=None
    out.append({'scenario':s.id,'assignments_verified':checked,'lp_integral':integral,'lp_seed_optimal':optimal,'lp_seed_objective':entry.classical_objective if integral else None})
    print(out[-1],flush=True)
with Path('audit/deep_qaoa_20261023/independent_reference.json').open('x') as f: json.dump(out,f,indent=2)
