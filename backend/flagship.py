"""Small, editable, synthetic policy demonstration; all methods share one model."""
from dataclasses import asdict
from datetime import datetime, timezone
import hashlib
import json
import time
from typing import Literal
from pydantic import Field
from backend.schemas import StrictModel, Quantity, OptimizeRequest, ScenarioInput, QAOAConfigInput, QUBOPenaltiesInput, ObjectiveWeightsInput
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig
from quantum.qubo import compute_conservative_objective_bound, estimate_qubo_variables

class FlagshipRequest(StrictModel):
    bank_a_stock: Quantity = Field(default=1, le=2)
    bank_b_stock: Quantity = Field(default=1, le=2)
    critical_demand: Quantity = Field(default=2, le=2)
    community_demand: Quantity = Field(default=1, le=2)
    critical_route_cost: float = Field(default=40, ge=0, le=100, allow_inf_nan=False)
    disrupted: bool = False
    policy: Literal['service_first', 'weighted'] = 'service_first'
    method: Literal['milp', 'exact', 'greedy', 'standard', 'warm', 'seed_only', 'xy', 'warm_xy'] = 'milp'
    seed: int = Field(default=7, ge=0, le=4294967295, strict=True)


def build_flagship(request: FlagshipRequest):
    scenario = Scenario(
        id='contested_network_disrupted' if request.disrupted else 'contested_network_normal',
        blood_groups=('O',),
        blood_banks=tuple(BloodBank(key, name, key, {'O': stock}) for key, name, stock in [
            ('bank_a','Bank A',request.bank_a_stock),('bank_b','Bank B',request.bank_b_stock)]),
        hospitals=(Hospital('critical','Critical Hospital','critical',{'O':request.critical_demand},{'O':Urgency('critical',1)}),
                   Hospital('community','Community Hospital','community',{'O':request.community_demand},{'O':Urgency('low',1)})),
        routes=tuple(Route(b,h,30 if h=='critical' else 10,10,
                           request.critical_route_cost if h=='critical' else 1,
                           'blocked' if request.disrupted and b=='bank_b' and h=='critical' else 'available')
                     for b in ('bank_a','bank_b') for h in ('critical','community')),
        compatibility={('O','O'):True}, synthetic=True)
    # Both policies use the same scenario, including unit urgency multipliers.
    # B bounds ALL possible transport burden, so one unmet unit costs > B.
    # C costs more than ALL total-shortage penalties plus ALL transport burden.
    demand = request.critical_demand + request.community_demand
    transport_bound = sum(v.upper_bound * (r.transport_cost + .1*r.travel_time_minutes)
        for v in scenario.allocation_variables() for r in scenario.routes
        if (r.source,r.destination)==(v.source,v.destination))
    total_weight = transport_bound + 1 if request.policy=='service_first' else 5
    critical_weight = (demand + 1) * (transport_bound + 1) if request.policy=='service_first' else 10
    weights = ObjectiveConfig(critical_weight,total_weight,1,.1,0)
    return scenario, weights


def run_flagship(request: FlagshipRequest, service):
    from backend.services import scenario_to_payload
    started=time.perf_counter()
    scenario, weights=build_flagship(request)
    quantum = request.method not in {'milp','exact','greedy'}
    settings = QAOAConfigInput(p=1,shots=128,max_iterations=15,seed=request.seed,
        warm_start=request.method in {'warm','warm_xy','seed_only'},
        mixer='xy' if request.method in {'xy','warm_xy'} else 'x', seed_only=request.method=='seed_only') if quantum else None
    penalty=max(100,compute_conservative_objective_bound(scenario,weights)*1.5+10)
    result=service.optimize(OptimizeRequest(scenario=ScenarioInput(**scenario_to_payload(scenario)),
        method='qaoa' if quantum else request.method, objective_weights=ObjectiveWeightsInput(**asdict(weights)),
        qaoa_config=settings,qaoa_penalties=QUBOPenaltiesInput(inventory_penalty_weight=penalty,demand_penalty_weight=penalty) if quantum else None))
    unmet=[]
    for row in result['unmet_demand']:
        if not row['units']:continue
        h=row['hospital_id']
        routes=[r for r in scenario.routes if r.destination==h and r.status=='available']
        stock=sum(b.inventory['O'] for b in scenario.blood_banks if any(r.source==b.id for r in routes))
        shortage_price=weights.total_unmet_weight+(weights.critical_unmet_weight if h=='critical' else 0)
        if stock==0:
            explanation='No stocked bank has an available route to this hospital.'
        elif min(r.transport_cost+.1*r.travel_time_minutes for r in routes)>shortage_price:
            explanation='Every available shipment costs more than the configured penalty for one unmet unit.'
        elif stock<next(hospital for hospital in scenario.hospitals if hospital.id == h).demand['O']:
            explanation=f'Available routes reach at most {stock} stock units, below this hospital’s demand; that stock is also shared.'
        else:
            explanation='Stock is shared between hospitals. Inspect the selected policy and allocations; this is not a unique causal or optimality certificate.'
        unmet.append({**row,'explanation':explanation})
    config={'input':request.model_dump(exclude={'method'}),'scenario':scenario_to_payload(scenario),
            'objective_weights':asdict(weights),'penalty_weights':{'inventory_penalty_weight':penalty,'demand_penalty_weight':penalty}}
    comparison_id=hashlib.sha256(json.dumps(config,sort_keys=True).encode()).hexdigest()[:16]
    return {'record_type':'live_synthetic_flagship','created_at_utc':datetime.now(timezone.utc).isoformat(),
        'method':request.method,'comparison_id':comparison_id,'configuration':config,'result':result,
        'qubo_variable_count':estimate_qubo_variables(scenario),
        'policy_description':('Minimize critical unmet units, then all unmet units, then synthetic transport burden. Exact/MILP certify this ordering on this bounded fixture; heuristics/QAOA may miss it.' if request.policy=='service_first' else 'Minimize a weighted sum. Leaving demand unmet can be cheaper than shipping, including critical demand.'),
        'shortage_explanations':unmet if result['feasibility'] else [],
        'wall_seconds':time.perf_counter()-started,
        'limitations':['Synthetic ABO-only O-group fixture; not clinical advice.',
            'No expiry, vehicle capacity or arrival deadline. Time is a per-unit cost, not a hard deadline.',
            'Local ideal simulation, not hardware. Single-seed comparisons are not evidence of advantage.',
            'Service-first weights are re-derived per scenario; do not compare objective totals across policies or disruptions.'],
        'timing_scope':'End-to-end service call including model, solver and decoding; not physical device time.'}
