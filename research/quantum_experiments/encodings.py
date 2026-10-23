"""Research encodings. Dense tables are explicitly exponential simulator/oracle work."""
from dataclasses import dataclass
import math,time
import numpy as np
from optimization.models import AllocationDecision
from optimization.objective import calculate_objective
from optimization.constraints import validate_allocation
from quantum.qubo import build_qubo,QUBOPenaltyConfig,compute_conservative_objective_bound
from quantum.ising import convert_qubo_to_ising
from quantum.qaoa_solver import normalize_ising

@dataclass
class Encoding:
    scenario: object
    weights: object
    kind: str
    n: int
    energy: np.ndarray
    objective: np.ndarray
    feasible: np.ndarray
    allocation_keys: list
    allocations: list
    penalty: float
    scale: float
    prep_seconds: float
    qubo: object=None
    ising: object=None
    registers: object=None

    @property
    def optimum(self): return float(self.objective[self.feasible].min())
    @property
    def optimal(self): return self.feasible & np.isclose(self.objective,self.optimum,atol=1e-7,rtol=0)


def full_encoding(s,w,max_qubits=14):
    t=time.perf_counter();pen=max(1,math.ceil(1.5*compute_conservative_objective_bound(s,w)))
    q=build_qubo(s,w,QUBOPenaltyConfig(pen,pen)); n=q.variable_count
    if n>max_qubits: raise ValueError(f'full_qubit_cap:{n}>{max_qubits}')
    entries=[q.evaluate_assignment(tuple((k>>i)&1 for i in range(n))) for k in range(1<<n)]
    original=convert_qubo_to_ising(q);ising,scale=normalize_ising(original)
    keys=[(v.source,v.destination,v.blood_group,v.recipient_group) for v in s.allocation_variables()]
    allocations=[]
    for e in entries:
        a={(d.source,d.destination,d.blood_group,d.recipient_group):d.quantity for d in e.decoded.allocation}
        allocations.append(tuple(a.get(k,0) for k in keys))
    return Encoding(s,w,'full_qubo',n,np.array([e.energy for e in entries]),np.array([e.classical_objective for e in entries]),np.array([e.total_penalty==0 for e in entries]),keys,allocations,pen,scale,time.perf_counter()-t,q,ising)


def reduced_encoding(s,w,max_qubits=12):
    """Unique ordinary binary per shipment. Residuals are deterministic.
    Feasible cost is unchanged. On invalid states use nonnegative shortages
    and squared positive violations; P>all-zero feasible cost guarantees an
    infeasible state cannot minimize. No silent repair of invalid shipments.
    """
    t=time.perf_counter(); variables=s.allocation_variables()
    regs=[];n=0
    for v in variables:
        width=v.upper_bound.bit_length();regs.append((n,width,v.upper_bound));n+=width
    # A dummy qubit for the unique no-shipment decision; only bit zero is valid.
    dummy=n==0;n=max(1,n)
    if n>max_qubits:raise ValueError(f'reduced_qubit_cap:{n}>{max_qubits}')
    keys=[(v.source,v.destination,v.blood_group,v.recipient_group) for v in variables]
    pen=max(1,math.ceil(1.5*compute_conservative_objective_bound(s,w)))
    routes={(r.source,r.destination):r for r in s.routes}
    energies=[];objectives=[];feasible=[];allocations=[]
    for k in range(1<<n):
        vals=tuple((k>>start)&((1<<width)-1) for start,width,bound in regs)
        overflow=sum(max(0,v-bound)**2 for v,(_,_,bound) in zip(vals,regs))+(int(k!=0) if dummy else 0)
        used={};served={};cost=0.
        for key,qty in zip(keys,vals):
            a,h,g,r=key;used[a,g]=used.get((a,g),0)+qty;served[h,r]=served.get((h,r),0)+qty
            cost+=qty*(w.transportation_cost_weight*routes[a,h].transport_cost+w.transportation_time_weight*routes[a,h].travel_time_minutes)
        violation=overflow
        for bank in s.blood_banks:
            for g,stock in bank.inventory.items():violation+=max(0,used.get((bank.id,g),0)-stock)**2
        for hospital in s.hospitals:
            for g,demand in hospital.demand.items():
                residual=demand-served.get((hospital.id,g),0)
                urgency=hospital.urgency[g]
                coef=w.total_unmet_weight+(w.critical_unmet_weight*urgency.priority_weight if urgency.category in ('high','critical') else 0)
                cost+=coef*max(0,residual);violation+=max(0,-residual)**2
        energies.append(cost+pen*violation);objectives.append(cost);feasible.append(violation==0);allocations.append(vals)
    energy=np.array(energies);valid=np.array(feasible)
    # Match production's largest nonidentity Pauli coefficient normalization.
    coefficients=energy.copy()
    width=1
    while width<len(coefficients):
        blocks=coefficients.reshape(-1,2*width);a=blocks[:,:width].copy();b=blocks[:,width:].copy()
        blocks[:,:width]=a+b;blocks[:,width:]=a-b;width*=2
    coefficients/=len(coefficients)
    scale=max(1,float(np.max(np.abs(coefficients[1:]))))
    return Encoding(s,w,'shipments_only',n,energy,np.array(objectives),valid,keys,allocations,pen,scale,time.perf_counter()-t,registers=regs)


def decisions(enc,index):
    return tuple(AllocationDecision(*key,int(qty)) for key,qty in zip(enc.allocation_keys,enc.allocations[index]) if qty)


def validate_encoding(enc,reference):
    feasible_objectives=[]
    for k in np.flatnonzero(enc.feasible):
        allocation=decisions(enc,int(k))
        assert validate_allocation(enc.scenario,allocation)['feasible']
        value=calculate_objective(enc.scenario,allocation,enc.weights).total_objective
        assert abs(value-enc.objective[k])<1e-7
        feasible_objectives.append(value)
    assert abs(min(feasible_objectives)-reference)<1e-7
    assert enc.feasible[np.isclose(enc.energy,enc.energy.min(),rtol=0,atol=1e-7)].all()
    return {'states':len(enc.energy),'feasible_states':int(enc.feasible.sum()),'optimal_states':int(enc.optimal.sum()),'objective':enc.optimum}
