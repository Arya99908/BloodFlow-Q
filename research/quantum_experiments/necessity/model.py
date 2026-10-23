"""Equivalent shipment LP and explicitly hypothetical fixed-dispatch extension."""
import time
import numpy as np
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.sparse import csc_matrix
from optimization.models import AllocationDecision
from optimization.objective import calculate_objective
from optimization.constraints import validate_allocation
from research.quantum_experiments.instances import WEIGHTS

class Task:
    def __init__(self, scenario, fees=None):
        self.scenario=scenario
        self.variables=scenario.allocation_variables()
        self.keys=[(v.source,v.destination,v.blood_group,v.recipient_group) for v in self.variables]
        self.upper=np.array([v.upper_bound for v in self.variables],int)
        self.routes=list(dict.fromkeys(k[:2] for k in self.keys))
        self.fees=np.array([float((fees or {}).get(k,0)) for k in self.routes])
        if np.any(self.fees<0):raise ValueError('fees must be nonnegative')
        self.route_index=np.array([self.routes.index(k[:2]) for k in self.keys],int)
        self.constant=calculate_objective(scenario,(),WEIGHTS).total_objective
        self.cost=np.array([calculate_objective(scenario,(AllocationDecision(*k,1),),WEIGHTS).total_objective-self.constant for k in self.keys])
        rows=[];bounds=[]
        for bank in scenario.blood_banks:
            for g,cap in bank.inventory.items():
                rows.append([int(k[0]==bank.id and k[2]==g) for k in self.keys]);bounds.append(cap)
        for hospital in scenario.hospitals:
            for g,cap in hospital.demand.items():
                rows.append([int(k[1]==hospital.id and k[3]==g) for k in self.keys]);bounds.append(cap)
        self.A=np.array(rows,float);self.capacity=np.array(bounds,float)

    def score(self,x):
        x=np.asarray(x)
        if np.any(x<0) or np.any(x>self.upper) or np.any(x!=np.round(x)) or np.any(self.A@x>self.capacity+1e-8):return float('inf')
        active=np.bincount(self.route_index,weights=x,minlength=len(self.routes))>0
        return float(self.constant+self.cost@x+self.fees@active)

    def validate(self,x):
        allocation=tuple(AllocationDecision(*k,int(v)) for k,v in zip(self.keys,x) if v)
        assert validate_allocation(self.scenario,allocation)['feasible']
        route_active={k[:2] for k,v in zip(self.keys,x) if v}
        expected=calculate_objective(self.scenario,allocation,WEIGHTS).total_objective+sum(f for k,f in zip(self.routes,self.fees) if k in route_active)
        assert abs(expected-self.score(x))<1e-7
        return expected

    def solve(self, seconds=1., incumbent=None, selected=None, relaxation=False):
        start=time.perf_counter();n=len(self.keys);use_fees=bool(np.any(self.fees));m=len(self.routes) if use_fees else 0
        cost=np.r_[self.cost,self.fees] if m else self.cost.copy()
        lo=np.zeros(n+m);hi=np.r_[self.upper,np.ones(m)]
        if selected is not None:
            frozen=np.ones(n,bool);frozen[selected]=False
            lo[:n][frozen]=incumbent[frozen];hi[:n][frozen]=incumbent[frozen]
        A=np.pad(self.A,((0,0),(0,m)));cap=self.capacity.copy()
        if m:
            linking=np.zeros((m,n+m))
            for r in range(m):
                mask=self.route_index==r;linking[r,:n]=mask;linking[r,n+r]=-int(self.upper[mask].sum())
            A=np.vstack([A,linking]);cap=np.r_[cap,np.zeros(m)]
        res=milp(cost,integrality=np.zeros(n+m) if relaxation else np.ones(n+m),bounds=Bounds(lo,hi),constraints=LinearConstraint(csc_matrix(A),-np.inf,cap),options={'time_limit':max(.001,seconds),'mip_rel_gap':0.0})
        candidate=None
        if res.x is not None and not relaxation:
            raw=res.x[:n]
            if np.max(abs(raw-np.round(raw)),initial=0)<1e-5:
                candidate=np.round(raw).astype(int)
                if not np.isfinite(self.score(candidate)):candidate=None
        proven=int(res.status)==0
        objective=float(res.fun+self.constant) if res.fun is not None else None
        lower=getattr(res,'mip_dual_bound',None)
        return candidate,{'status':int(res.status),'message':str(res.message),'proven_optimal':proven,'relaxation':relaxation,'objective':objective,'lower_bound':float(lower+self.constant) if lower is not None and np.isfinite(lower) else (objective if relaxation and proven else None),'integral_shipments':bool(res.x is not None and np.max(abs(res.x[:n]-np.round(res.x[:n])),initial=0)<1e-7),'seconds':time.perf_counter()-start,'nodes':int(res.mip_node_count) if getattr(res,'mip_node_count',None) is not None else None}

    def greedy(self):
        x=np.zeros(len(self.keys),int);score=self.score(x)
        while True:
            options=[]
            for j in range(len(x)):
                if x[j]<self.upper[j]:
                    y=x.copy();y[j]+=1;options.append((self.score(y),j))
            value,j=min(options,default=(float('inf'),0))
            if value>=score-1e-8:return x
            x[j]+=1;score=value
