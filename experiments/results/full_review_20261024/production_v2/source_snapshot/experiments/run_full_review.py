"""Serial, resumable production-control benchmark; append-only records and source guards.
Run python -m experiments.run_full_review --output experiments/results/full_review_20261024/production
"""
from __future__ import annotations
import argparse, hashlib, importlib.metadata, json, math, os, platform, resource, signal, statistics, subprocess, time, traceback
from collections import Counter
from dataclasses import asdict, replace
from pathlib import Path
import numpy as np
from qiskit.quantum_info import Statevector
from backend.data_loader import load_data
from backend.demo_scenarios import build_demo_case, DEMO_CATALOG
from backend.scenario_factory import scenario_from_loaded_data
from emergency.simulator import apply_emergency_events
from experiments.deep_qaoa_audit import scenarios as compact_cases, WEIGHTS
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency, AllocationDecision
from optimization.constraints import validate_allocation
from optimization.objective import calculate_objective
from optimization.exact import ExactSolver, ExactSolverLimitError
from optimization.greedy import GreedyAllocator
from optimization.milp import MILPSolver
from quantum.qubo import build_qubo, QUBOPenaltyConfig, count_scenario_qubo_variables, compute_conservative_objective_bound
from quantum.qaoa_solver import QAOAConfig, QAOASolver, normalize_ising
from quantum.ising import convert_qubo_to_ising
from research.quantum_experiments.instances import holdout, serialize
ROOT=Path(__file__).resolve().parents[1]


def cases():
    result=[(s,'primary') for s in compact_cases()+holdout()]
    historical=json.loads((ROOT/'experiments/results/quantum-value-confirmatory-seed301-20261015.json').read_text())
    for name,d in historical['configuration']['scenarios'].items():
        s=Scenario('legacy_'+name,tuple(d['blood_groups']),tuple(BloodBank(**b) for b in d['blood_banks']),tuple(Hospital(**{**h,'urgency':{k:Urgency(**u) for k,u in h['urgency'].items()}}) for h in d['hospitals']),tuple(Route(**r) for r in d['routes']),{(c['donor_group'],c['recipient_group']):c['allowed'] for c in d['compatibility']},True)
        result.append((s,'historical_input_current_algorithms'))
    full=scenario_from_loaded_data(load_data())
    result.append((full,'full_dataset'))
    for item in DEMO_CATALOG:
        s,event=build_demo_case(full,item['id']);result.append((s,'demo_before'))
        if event:result.append((apply_emergency_events(s,[event]),'demo_after'))
    base=compact_cases()[0]
    for name,stock,demand in [('zero_inventory',0,4),('zero_demand',4,0),('zero_inventory_and_demand',0,0)]:
        result.append((replace(base,id=name,blood_banks=(replace(base.blood_banks[0],inventory={'O':stock}),),hospitals=(replace(base.hospitals[0],demand={'O':demand}),)),'boundary'))
    return result


def fingerprint():
    paths=['quantum/qaoa_solver.py','quantum/qubo.py','quantum/ising.py','optimization/milp.py','optimization/decoder.py','optimization/constraints.py','optimization/objective.py','experiments/run_full_review.py','experiments/configs/full_review_20261024.json']
    return {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths}


def memory_bytes():
    # Process lifetime high-water RSS, not isolated allocation per run.
    value=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(value if platform.system()=='Darwin' else value*1024)


def classical(s,method):
    t=time.perf_counter()
    if method=='lp':
        run=MILPSolver().solve_relaxation(s,WEIGHTS,include_metadata=True)
        integral=all(abs(v-round(v))<1e-7 for name in ('allocation','unmet_demand','slack') for v in run[name].values())
        allocation=tuple(AllocationDecision(*key,int(round(v))) for key,v in run['allocation'].items() if v>1e-7) if integral else ()
        report=validate_allocation(s,allocation) if integral else {'feasible':None,'violations':[]}
        value=run['objective_value']
    else:
        run={'greedy':GreedyAllocator,'exact':ExactSolver,'milp':MILPSolver}[method]().solve(s,WEIGHTS)
        allocation=run.allocation;report=validate_allocation(s,allocation,run.unmet_demand);value=run.objective_breakdown.total_objective;integral=True
    return {'status':'completed','objective':value,'feasibility':report['feasible'],'violations':report['violations'],'integral':integral,'allocation':[asdict(a) for a in allocation], 'wall_seconds':time.perf_counter()-t}


def proof(s, q):
    """Independent domain and Ising check of every basis state, before optimization."""
    t=time.perf_counter();exact=ExactSolver().solve(s,WEIGHTS).objective_value
    ising=convert_qubo_to_ising(q);energies=[];valid=[];optimal=[];max_error=0.
    for k in range(1<<q.variable_count):
        bits=tuple((k>>i)&1 for i in range(q.variable_count));entry=q.evaluate_assignment(bits);d=entry.decoded
        operational=validate_allocation(s,d.allocation,d.unmet_demand)['feasible']
        slack=all(sum(a.quantity for a in d.allocation if a.source==b.id and a.blood_group==g)+d.inventory_slack.get((b.id,g),0)==available for b in s.blood_banks for g,available in b.inventory.items())
        feasible=operational and slack
        assert feasible==(entry.total_penalty==0)
        if feasible:assert abs(calculate_objective(s,d.allocation,WEIGHTS).total_objective-entry.classical_objective)<1e-7
        max_error=max(max_error,abs(ising.energy(bits)-q.energy(bits)))
        energies.append(entry.energy);valid.append(feasible);optimal.append(feasible and abs(entry.classical_objective-exact)<1e-7)
    energies=np.asarray(energies);valid=np.asarray(valid);optimal=np.asarray(optimal)
    assert max_error<1e-6 and valid[np.isclose(energies,energies.min(),atol=1e-7,rtol=0)].all()
    assert abs(energies.min()-exact)<1e-7
    return {'states':len(energies),'max_ising_error':max_error,'reference_optimum':exact,'ground_states_feasible':True,'validation_seconds':time.perf_counter()-t},(energies,valid,optimal)


def quantum(s, q, config, ref, analysis):
    t_qubo=time.perf_counter()
    penalty=max(1,math.ceil(1.5*compute_conservative_objective_bound(s,WEIGHTS)))
    q=build_qubo(s,WEIGHTS,QUBOPenaltyConfig(penalty,penalty))
    qubo_seconds=time.perf_counter()-t_qubo
    train_seconds=0.;train_info=None
    if config.parameter_initialization=='provided':
        t=time.perf_counter();training=QAOASolver(replace(config,p=1,parameter_initialization='random',initial_parameters=None)).solve(q);train_seconds=time.perf_counter()-t
        params=training.optimizer_information['final_parameters'];train_info={'config':asdict(replace(config,p=1,parameter_initialization='random',initial_parameters=None)),'optimizer':dict(training.optimizer_information),'seconds':train_seconds}
        # Constant interpolation from one layer; all gamma then all beta.
        config=replace(config,initial_parameters=tuple([params[0]]*config.p+[params[1]]*config.p))
    solver=QAOASolver(config);t=time.perf_counter();run=solver.solve(q);wall=time.perf_counter()-t
    info=dict(run.optimizer_information);best=info['best_feasible_objective'];en,valid,optimal=analysis
    t=time.perf_counter();h=convert_qubo_to_ising(q);h,_=normalize_ising(h) if config.normalize_cost else (h,1)
    theta=solver._compute_warm_start_thetas(q) if config.warm_start or config.mixer=='warm_start' else None
    pairs=solver._compute_xy_pairs(q) if config.mixer=='xy' else None
    final=Statevector.from_instruction(solver.build_circuit(h,np.asarray(info['final_parameters']),thetas=theta,xy_pairs=pairs)).probabilities()
    initial=Statevector.from_instruction(solver.build_circuit(h,np.zeros(2*config.p),thetas=theta,xy_pairs=pairs)).probabilities()
    analysis_seconds=time.perf_counter()-t
    optimal_shots=sum(c for k,c in run.counts.items() if optimal[int(k.replace(' ',''),2)])
    return {'status':'completed','config':asdict(config),'wall_seconds':qubo_seconds+wall+train_seconds,'qubo_construction_seconds':qubo_seconds,'solver_wall_seconds':wall,'training':train_info,'analysis_seconds_excluded':analysis_seconds,'objective':best,'absolute_gap':best-ref if best is not None else None,'feasibility':best is not None,'feasible_shot_rate':info['feasible_shot_rate'],'infeasible_shots':config.shots-info['feasible_shots'],'optimal_shot_rate':optimal_shots/config.shots,'counts':dict(run.counts),'optimizer':info,'initial_expected_energy':float(initial@en),'final_expected_energy':float(final@en),'initial_optimal_probability':float(initial[optimal].sum()),'final_optimal_probability':float(final[optimal].sum()),'final_feasible_probability':float(final[valid].sum())}


def alarm_handler(signum,frame): raise TimeoutError('per-run wall-time alarm expired')


def run(output, config_path, pilot=False):
    cfg=json.loads(config_path.read_text());output.mkdir(parents=True,exist_ok=True)
    protocol={'configuration':cfg,'pilot':pilot,'source_sha256':fingerprint(),'python':platform.python_version(),'platform':platform.platform(),'machine':platform.machine(),'cpu_count':os.cpu_count(),'versions':{k:importlib.metadata.version(k) for k in ('numpy','scipy','qiskit','qiskit-aer')},'thread_limits':{k:os.environ.get(k) for k in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS')},'timing':'serial warm-process timings; repetitions are not independent problem instances; ru_maxrss is process lifetime high-water; references and analysis are excluded and separately timed'}
    try:protocol['hardware']=subprocess.check_output(['sysctl','-n','machdep.cpu.brand_string','hw.memsize'],text=True).strip()
    except (FileNotFoundError,subprocess.SubprocessError):protocol['hardware']='unavailable'
    if (output/'protocol.json').exists():
        previous=json.loads((output/'protocol.json').read_text())
        if previous!=protocol:raise ValueError('resume refused: protocol/source/environment changed; choose new output')
    else:(output/'protocol.json').write_text(json.dumps(protocol,indent=2))
    raw=output/'runs.jsonl';rows=[json.loads(line) for line in raw.read_text().splitlines()] if raw.exists() else []
    completed={r['key'] for r in rows}; inventory=[]; t_all=time.perf_counter()
    chosen=cases()[:1] if pilot else cases()
    with raw.open('a') as stream:
        for s,family in chosen:
            seeds=cfg['primary_seeds'] if family=='primary' else cfg['additional_seeds'];seeds=seeds[:1] if pilot else seeds
            n=count_scenario_qubo_variables(s);penalty=max(1,math.ceil(1.5*compute_conservative_objective_bound(s,WEIGHTS)))
            case_path=output/(s.id+'_case.json'); case_data={'scenario':serialize(s),'family':family,'qubits':n,'weights':asdict(WEIGHTS),'penalty':penalty}
            if not case_path.exists():case_path.write_text(json.dumps(case_data,indent=2))
            inventory.append({'scenario':s.id,'family':family,'qubits':n,'input_file':case_path.name})
            q=None; ref=None; analysis=None
            if 0<n<=cfg['max_qubits']:
                q=build_qubo(s,WEIGHTS,QUBOPenaltyConfig(penalty,penalty));check,analysis=proof(s,q);ref=check['reference_optimum']
                (output/(s.id+'_proof.json')).write_text(json.dumps(check,indent=2))
            variants=cfg['primary_variants'] if family=='primary' else {k:v for k,v in cfg['primary_variants'].items() if k in ('standard','warm','xy','warm_xy','warm_keep')}
            if s.id in cfg['ablation_scenarios'] and not pilot:variants={**variants,**cfg['ablations']}
            jobs=[(method,seed,None) for seed in seeds for method in ('greedy','lp','milp','exact')]
            jobs += [(method,seed,extra) for seed in seeds for method,extra in variants.items()]
            # Frozen permutation avoids always running warm or a baseline first.
            for index in np.random.default_rng(20261024).permutation(len(jobs)):
                method,seed,extra=jobs[index];key=f'{s.id}|{method}|{seed}'
                if key in completed:continue
                base={'key':key,'scenario':s.id,'family':family,'method':method,'seed':seed,'qubits':n,'case_file':case_path.name,'reference_optimum':ref}
                t=time.perf_counter()
                try:
                    signal.signal(signal.SIGALRM,alarm_handler);signal.setitimer(signal.ITIMER_REAL,cfg['run_timeout_seconds'])
                    if extra is None:record=classical(s,method)
                    elif not n or n>cfg['max_qubits']:record={'status':'skipped','reason':'zero-variable problem has no quantum circuit' if not n else f'{n} qubits exceeds frozen {cfg["max_qubits"]}-qubit study cap; production cap is 16'}
                    else:
                        params={**cfg['base'],**extra,'seed':seed,'max_qubits':cfg['max_qubits']}
                        if params.get('parameter_initialization')=='provided':params['initial_parameters']=tuple([0.]*(2*params['p']))
                        record=quantum(s,q,QAOAConfig(**params),ref,analysis)
                except ExactSolverLimitError as exc:record={'status':'skipped','reason':str(exc),'wall_seconds':time.perf_counter()-t}
                except Exception as exc:record={'status':'failed','error_type':type(exc).__name__,'error':str(exc),'traceback':traceback.format_exc(),'wall_seconds':time.perf_counter()-t}
                finally:signal.setitimer(signal.ITIMER_REAL,0)
                row={**base,**record,'process_peak_rss_bytes':memory_bytes()};stream.write(json.dumps(row,allow_nan=False)+'\n');stream.flush();rows.append(row);completed.add(key)
            print(s.id,Counter(r['status'] for r in rows if r['scenario']==s.id),flush=True)
    (output/'scenario_inventory.json').write_text(json.dumps(inventory,indent=2))
    (output/'complete.json').write_text(json.dumps({'statuses':dict(Counter(r['status'] for r in rows)),'records':len(rows),'invocation_seconds':time.perf_counter()-t_all},indent=2))


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--config',type=Path,default=ROOT/'experiments/configs/full_review_20261024.json');p.add_argument('--pilot',action='store_true');a=p.parse_args();run(a.output,a.config,a.pilot)
