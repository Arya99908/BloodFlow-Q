"""Disjoint instance IDs and frozen generation seed; all data are synthetic."""
from dataclasses import asdict
import numpy as np
from optimization.models import Scenario,BloodBank,Hospital,Route,Urgency
from experiments.deep_qaoa_audit import scenarios,WEIGHTS


def generated(nb,nh,groups,seed,identifier,quantity=2):
    rng=np.random.default_rng(seed);groups=tuple(groups)
    banks=tuple(BloodBank(f'b{i}',f'Bank{i}',f'B{i}',{g:int(rng.integers(1,quantity+1)) for g in groups}) for i in range(nb))
    hospitals=tuple(Hospital(f'h{i}',f'Hospital{i}',f'H{i}',{g:int(rng.integers(1,quantity+1)) for g in groups},{g:Urgency('high' if i%2==0 else 'medium',float(rng.integers(1,4))) for g in groups}) for i in range(nh))
    routes=tuple(Route(b.id,h.id,float(rng.integers(5,30)),float(rng.integers(1,10)),float(rng.integers(1,16)),'available') for b in banks for h in hospitals)
    compat={(g,r):bool(g==r or (g==groups[0] and r==groups[-1])) for g in groups for r in groups}
    return Scenario(identifier,groups,banks,hospitals,routes,compat,True)


def holdout():
    specs=[(1,1,('O',),3),(1,2,('O',),2),(2,2,('O',),1),(2,2,('O',),2),(2,2,('O',),2),(2,1,('O',),3),(1,1,('O','A'),1),(1,2,('O','A'),1)]
    return [generated(b,h,g,20261023+i,f'holdout_{i:02}',q) for i,(b,h,g,q) in enumerate(specs)]


def serialize(s):
    return {'id':s.id,'blood_groups':list(s.blood_groups),'blood_banks':[asdict(x) for x in s.blood_banks],'hospitals':[asdict(x) for x in s.hospitals],'routes':[asdict(x) for x in s.routes],'compatibility':[{'donor':g,'recipient':r,'allowed':v} for (g,r),v in s.compatibility.items()],'synthetic':True}
