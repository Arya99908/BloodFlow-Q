"""Strong exact LP/MILP and budgeted feasible local-search controls."""
import time
import numpy as np
from optimization.models import AllocationDecision
from optimization.milp import MILPSolver
from optimization.greedy import GreedyAllocator
from optimization.exact import ExactSolver
from optimization.constraints import validate_allocation
from optimization.objective import calculate_objective


def classical_baselines(s,w):
    output={}
    for name,fn in [('exact',ExactSolver().solve),('milp',MILPSolver().solve),('greedy',GreedyAllocator().solve)]:
        t=time.perf_counter()
        try:
            r=fn(s,w);obj=calculate_objective(s,r.allocation,w).total_objective
            output[name]={'status':'completed','objective':obj,'feasible':validate_allocation(s,r.allocation)['feasible'],'seconds':time.perf_counter()-t}
        except Exception as e:output[name]={'status':'error','error_type':type(e).__name__,'error':str(e),'seconds':time.perf_counter()-t}
    t=time.perf_counter();lp=MILPSolver().solve_relaxation(s,w)
    integral=all(abs(v-round(v))<1e-7 for vals in lp.values() for v in vals.values())
    allocation=tuple(AllocationDecision(*key,int(round(v))) for key,v in lp['allocation'].items()) if integral else ()
    output['lp']={'status':'completed','integral':integral,'feasible':validate_allocation(s,allocation)['feasible'] if integral else None,'objective':calculate_objective(s,allocation,w).total_objective if integral else None,'seconds':time.perf_counter()-t,'values':{kind:{str(k):v for k,v in val.items()} for kind,val in lp.items()}}
    return output


def local_search(s,w,seed,budget=160):
    t=time.perf_counter();rng=np.random.default_rng(seed);variables=s.allocation_variables();keys=[(v.source,v.destination,v.blood_group,v.recipient_group) for v in variables];upper=np.array([v.upper_bound for v in variables]);calls=0
    def score(x):
        nonlocal calls
        calls+=1;a=tuple(AllocationDecision(*k,int(v)) for k,v in zip(keys,x) if v)
        if not validate_allocation(s,a)['feasible']:return float('inf')
        return calculate_objective(s,a,w).total_objective
    x=np.zeros(len(keys),int);value=score(x);best=value
    while calls<budget and len(keys):
        if calls%40==0:x=np.zeros(len(keys),int);value=score(x)
        if calls>=budget:break
        y=x.copy()
        # Single moves plus relocation swaps escape some allocation traps.
        i=int(rng.integers(len(keys)));y[i]=np.clip(y[i]+int(rng.choice([-1,1])),0,upper[i])
        if len(keys)>1 and rng.random()<.5:
            j=int(rng.integers(len(keys)));y[j]=np.clip(y[j]+int(rng.choice([-1,1])),0,upper[j])
        new=score(y)
        if new<=value:x,value=y,new
        best=min(best,value)
    return {'objective':float(best),'evaluations':calls,'seconds':time.perf_counter()-t,'seed':seed,'budget':budget,'method':'feasible_multistart_coordinate_search','initialization':'zero_allocation_no_lp_seed'}
