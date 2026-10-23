"""Independent credibility measurements of unmodified production QAOA.
Run: python -m experiments.deep_qaoa_audit --output audit/new_directory
Artifacts are exclusive-created and include exact statevector and sampled rates.
"""
import argparse, hashlib, importlib.metadata, json, math, platform, time
from pathlib import Path
from dataclasses import asdict, replace
import numpy as np
from qiskit.quantum_info import Statevector
from experiments.run_experiments import build_scenarios
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig
from optimization.exact import ExactSolver
from optimization.milp import MILPSolver
from optimization.greedy import GreedyAllocator
from quantum.qubo import build_qubo, QUBOPenaltyConfig, compute_conservative_objective_bound
from quantum.ising import convert_qubo_to_ising
from quantum.qaoa_solver import QAOASolver, QAOAConfig, normalize_ising

ROOT=Path(__file__).resolve().parents[1]
WEIGHTS=ObjectiveConfig(10,5,1,.1,0)
SEEDS=(7,11,19,23,31)

def scenarios():
    cases=list(build_scenarios(5)); b=cases[0]
    cases.append(replace(b,id='emergency_16',hospitals=(replace(b.hospitals[0],demand={'O':16},urgency={'O':Urgency('critical',3)}),)))
    cases.append(Scenario(id='multi_facility',blood_groups=('O',),
        blood_banks=(BloodBank('a','A','A',{'O':2}),BloodBank('b','B','B',{'O':1})),
        hospitals=(Hospital('h1','H1','H1',{'O':2},{'O':Urgency('critical',3)}),Hospital('h2','H2','H2',{'O':2},{'O':Urgency('medium',1)})),
        routes=tuple(Route(s,h,10,1,c,'available') for s,h,c in [('a','h1',6),('a','h2',1),('b','h1',1),('b','h2',6)]),compatibility={('O','O'):True},synthetic=True))
    return cases

def state_metrics(prob, feasible, optimal, energy):
    return dict(feasible_probability=float(prob[feasible].sum()),optimal_probability=float(prob[optimal].sum()),expected_energy=float(prob@energy))

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--output',required=True); args=ap.parse_args()
    out=Path(args.output); out.mkdir(parents=True,exist_ok=True)
    log=(out/'runs.jsonl').open('x')
    manifest={'python':platform.python_version(),'versions':{k:importlib.metadata.version(k) for k in ['qiskit','qiskit-aer','numpy','scipy']},'seeds':SEEDS,'base_config':{'p':2,'restarts':2,'max_iterations':100,'shots':1024,'warm_start_epsilon':.1,'normalize_cost':True},'source_sha256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['quantum/qaoa_solver.py','quantum/qubo.py','quantum/ising.py','optimization/milp.py','experiments/deep_qaoa_audit.py','tests/test_xy_credibility.py']},'scenarios':[]}
    with (out/'protocol.json').open('x') as f: json.dump(manifest,f,indent=2)
    for s in scenarios():
        penalty=max(1,math.ceil(1.5*compute_conservative_objective_bound(s,WEIGHTS)))
        q=build_qubo(s,WEIGHTS,QUBOPenaltyConfig(penalty,penalty)); n=q.variable_count
        if n>16: raise ValueError((s.id,n))
        exact=ExactSolver().solve(s,WEIGHTS)
        entries=[q.evaluate_assignment(tuple((k>>i)&1 for i in range(n))) for k in range(2**n)]
        feasible=np.array([e.total_penalty==0 for e in entries]); energy=np.array([e.energy for e in entries])
        optimal=np.array([f and abs(e.classical_objective-exact.objective_value)<1e-7 for f,e in zip(feasible,entries)])
        assert optimal.any() and feasible[np.isclose(energy,energy.min(),atol=1e-7,rtol=0)].all()
        assert abs(energy.min()-exact.objective_value)<1e-7
        orig=convert_qubo_to_ising(q); h,_=normalize_ising(orig)
        max_error=max(abs(orig.energy(tuple((k>>i)&1 for i in range(n)))-energy[k]) for k in range(2**n))
        assert max_error<1e-6
        classical={}
        for name,solve in [('exact',ExactSolver().solve),('milp',MILPSolver().solve),('greedy',GreedyAllocator().solve)]:
            t=time.perf_counter(); res=solve(s,WEIGHTS); classical[name]={'objective':(res.objective_breakdown.total_objective if name=='greedy' else res.objective_value),'seconds':time.perf_counter()-t}
        t=time.perf_counter(); lp=MILPSolver().solve_relaxation(s,WEIGHTS); lp_seconds=time.perf_counter()-t
        classical['lp']={'seconds':lp_seconds,'values':{kind:{str(k):v for k,v in val.items()} if isinstance(val,dict) else val for kind,val in lp.items()}}
        # Entire production XY layer, initialized at each feasible basis vector.
        xy=QAOASolver(QAOAConfig(mixer='xy')); pairs=xy._compute_xy_pairs(q)
        leaks=[]
        for k in np.flatnonzero(feasible):
            theta=np.array([np.pi*((int(k)>>i)&1) for i in range(n)])
            st=Statevector.from_instruction(xy.build_circuit(h,np.array([0,.7]),thetas=theta,xy_pairs=pairs))
            leaks.append((float(st.probabilities()[~feasible].sum()),int(k)))
        sector=np.array([k.bit_count() for k in range(2**n)])
        scenario_info={'id':s.id,'repr':repr(s),'qubits':n,'states':2**n,'feasible_states':int(feasible.sum()),'optimal_states':int(optimal.sum()),'penalty':penalty,'exact_objective':exact.objective_value,'ising_max_error':max_error,'classical':classical,'xy_pairs':pairs,'max_feasible_state_leakage_beta_0_7':max(leaks),'optimal_weight_sectors':np.unique(sector[optimal]).tolist()}
        manifest['scenarios'].append(scenario_info)
        with (out/f'{s.id}_reference.json').open('x') as f: json.dump(scenario_info,f,indent=2)
        variants=[('standard_x',{}),('warm',{'warm_start':True}),('xy',{'mixer':'xy'}),('warm_xy',{'warm_start':True,'mixer':'xy'})]
        if s.id in ('normal_reference','emergency_16','multi_facility'):
            variants += [('warm_eps_005',{'warm_start':True,'warm_start_epsilon':.05}),('warm_eps_025',{'warm_start':True,'warm_start_epsilon':.25}),('warm_budget_300',{'warm_start':True,'max_iterations':300}),('warm_p3',{'warm_start':True,'p':3})]
        for label,extra in variants:
            for seed in (SEEDS if label in ('standard_x','warm','xy','warm_xy') else SEEDS[:3]):
                cfg=QAOAConfig(**(manifest['base_config']|{'seed':seed}|extra)); solver=QAOASolver(cfg)
                theta=solver._compute_warm_start_thetas(q) if cfg.warm_start else None
                initial=Statevector.from_instruction(solver.build_circuit(h,np.zeros(2*cfg.p),thetas=theta,xy_pairs=pairs if cfg.mixer=='xy' else None)).probabilities()
                t=time.perf_counter(); res=solver.solve(q); elapsed=time.perf_counter()-t
                final=Statevector.from_instruction(solver.build_circuit(h,np.array(res.optimizer_information['final_parameters']),thetas=theta,xy_pairs=pairs if cfg.mixer=='xy' else None)).probabilities()
                # Independent reconstruction of expectation and measured energy.
                assert abs(final@energy-res.optimizer_information['final_expected_energy'])<1e-5
                counts=res.counts; assert sum(counts.values())==cfg.shots
                sampled=np.zeros(2**n)
                for key,count in counts.items(): sampled[int(key,2)]=count/cfg.shots
                assert abs(sampled@energy-res.measured_mean_energy)<1e-5
                best_index=int(res.best_bitstring,2); assert res.best_bitstring in counts and abs(res.objective_value-energy[best_index])<1e-7
                initial_sectors=np.bincount(sector,weights=initial,minlength=n+1)
                final_sectors=np.bincount(sector,weights=final,minlength=n+1)
                sector_error=float(np.max(np.abs(initial_sectors-final_sectors)))
                if cfg.mixer=='xy': assert sector_error<1e-10
                row={'scenario':s.id,'variant':label,'seed':seed,'config':asdict(cfg),'seconds':elapsed,'initial':state_metrics(initial,feasible,optimal,energy),'final':state_metrics(final,feasible,optimal,energy),'sampled':state_metrics(sampled,feasible,optimal,energy),'best_sample_feasible':bool(feasible[best_index]),'best_sample_optimal':bool(optimal[best_index]),'optimizer':dict(res.optimizer_information),'counts':dict(counts),'xy_optimal_probability_ceiling':float(initial_sectors[np.unique(sector[optimal])].sum()) if cfg.mixer=='xy' else None,'sector_mass_max_change':sector_error}
                log.write(json.dumps(row)+'\n'); log.flush()
                print(s.id,label,seed,'optimal',round(row['final']['optimal_probability'],4),'initial',round(row['initial']['optimal_probability'],4),flush=True)
    with (out/'completed.json').open('x') as f: json.dump(manifest,f,indent=2)
    log.close()

if __name__=='__main__': main()
