"""Bounded train/held-out study. Usage: python -m ...run_study --output ... [--pilot]."""
import argparse,hashlib,importlib.metadata,json,platform,time
from pathlib import Path
from dataclasses import asdict
import numpy as np
from scipy.optimize import minimize
from qiskit.quantum_info import Statevector
from research.quantum_experiments.instances import scenarios,holdout,serialize,WEIGHTS
from research.quantum_experiments.encodings import full_encoding,reduced_encoding,validate_encoding
from research.quantum_experiments.algorithms import Ansatz,Config,optimize,resources
from research.quantum_experiments.metrics import probabilities,sample_metrics,readout_bitflip
from research.quantum_experiments.classical import classical_baselines,local_search

METHODS=['standard','warm','xy','warm_xy','qubo_cvar','reduced','reduced_cvar','feasible_grover']
ROOT=Path(__file__).resolve().parents[2]

def dump(p,value):
    with p.open('x') as f:json.dump(value,f,indent=2,allow_nan=False)

def train_transfer(training):
    t=time.perf_counter();ans=[];prep=0.
    for s in training:
        e=reduced_encoding(s,WEIGHTS);a=Ansatz(e,Config('reduced'));ans.append(a);prep+=e.prep_seconds+a.preparation_seconds
    rng=np.random.default_rng(44);calls=0
    def objective(x):
        nonlocal calls
        calls+=1
        return float(np.mean([abs(a.state(x))**2@(a.enc.energy/a.enc.scale) for a in ans]))
    x=np.r_[rng.uniform(0,2*np.pi,2),rng.uniform(0,np.pi,2)]
    r=minimize(objective,x,method='COBYLA',options={'maxiter':160})
    return {'training_ids':[s.id for s in training],'seed':44,'objective':'average normalized mean energy; no optimum used','evaluations':calls,'statevector_evaluations':calls*len(ans),'preprocessing_seconds':prep,'total_seconds':time.perf_counter()-t,'parameters':r.x.tolist(),'success':bool(r.success),'message':str(r.message)}


def run_case(s,split,seeds,out,stream,transferred,methods):
    classical=classical_baselines(s,WEIGHTS);reference=classical['milp']['objective']
    encs={};validation={};skips=[]
    for name,build in [('full',full_encoding),('reduced',reduced_encoding)]:
        try:
            enc=build(s,WEIGHTS);validation[name]=validate_encoding(enc,reference);encs[name]=enc
        except ValueError as error:skips.append({'encoding':name,'reason':str(error)})
    if 'reduced' in encs:
        e=encs['reduced'];classical['enumeration_lookup']={'objective':e.optimum,'seconds':e.prep_seconds,'status':'completed','states_scanned':len(e.energy),'note':'same exhaustive truth table required by reduced prototype'}
    resource_map={}
    for method in methods:
        key='reduced' if method in ('reduced','reduced_cvar','feasible_grover') else 'full'
        if key not in encs:continue
        cfg=Config(method,alpha=.2 if 'cvar' in method else 1)
        resource_map[method]=resources(Ansatz(encs[key],cfg))
    case={'scenario':serialize(s),'split':split,'weights':asdict(WEIGHTS),'classical':classical,'encoding_validation':validation,'skips':skips,'resources':resource_map,'controls':{}}
    for name,e in encs.items():
        p=np.ones(len(e.energy))/len(e.energy);case['controls'][f'uniform_{name}']=probabilities(e,p)
        if name=='reduced':case['controls']['uniform_feasible']=probabilities(e,e.feasible/e.feasible.sum())
    dump(out/f'{s.id}_case.json',case)
    for seed in seeds:
        local=local_search(s,WEIGHTS,seed)
        for method in methods:
            key='reduced' if method in ('reduced','reduced_cvar','feasible_grover') else 'full'
            if key not in encs:
                stream.write(json.dumps({'scenario':s.id,'split':split,'seed':seed,'method':method,'status':'skipped','reason':'encoding_cap','case_file':f'{s.id}_case.json'})+'\n');stream.flush();continue
            start=time.perf_counter();e=encs[key];cfg=Config(method,seed=seed,alpha=.2 if 'cvar' in method else 1)
            a=Ansatz(e,cfg);angles,optimizer=optimize(a)
            t=time.perf_counter();p=abs(a.state(angles))**2;final_sim=time.perf_counter()-t
            # Every method/instance checked against independently constructed Qiskit circuit once.
            qiskit_error=None;tcheck=time.perf_counter()
            if seed==seeds[0]:
                sv=Statevector.from_instruction(a.circuit(angles));qiskit_error=float(np.max(np.abs(sv.probabilities()-p)));assert qiskit_error<1e-8,(s.id,method,qiskit_error)
            verification_seconds=time.perf_counter()-tcheck
            t=time.perf_counter();sample=sample_metrics(e,p,cfg.shots,seed+2000000);sample_seconds=time.perf_counter()-t
            t=time.perf_counter();metrics=probabilities(e,p);initial=probabilities(e,abs(a.initial)**2);readout={str(err):probabilities(e,readout_bitflip(p,e.n,err)) for err in (.01,.03)};metrics_seconds=time.perf_counter()-t
            elapsed=time.perf_counter()-start
            row={'scenario':s.id,'split':split,'method':method,'seed':seed,'status':'completed','config':asdict(cfg),'encoding':e.kind,'qubits':e.n,'energy_scale':e.scale,'penalty':e.penalty,'parameters':angles.tolist(),'provenance':a.provenance,'optimizer':optimizer,'initial_metrics':initial,'metrics':metrics,'sample':sample,'readout_only_noise_metrics':readout,'classical_local_search':local,'qiskit_probability_max_error':qiskit_error,'timing':{'encoding_table_preprocessing_seconds':e.prep_seconds,'state_preparation_seconds':a.preparation_seconds,'optimization_seconds':optimizer['optimization_seconds'],'simulation_seconds':optimizer['simulation_seconds']+final_sim,'final_sampling_and_summary_seconds':sample_seconds,'metric_evaluation_seconds':metrics_seconds,'circuit_verification_seconds':verification_seconds,'observed_cached_run_wall_seconds':elapsed,'standalone_pipeline_seconds_excluding_synthesis':elapsed-verification_seconds+e.prep_seconds,'synthesis_seconds':resource_map[method]['synthesis_seconds'],'standalone_pipeline_seconds_including_measured_synthesis':elapsed-verification_seconds+e.prep_seconds+resource_map[method]['synthesis_seconds'] if resource_map[method]['status']=='compiled' else None},'case_file':f'{s.id}_case.json'}
            stream.write(json.dumps(row,allow_nan=False)+'\n');stream.flush()
        print(s.id,split,seed,'complete',flush=True)
    # Controls use identical test cases; transferred schedule has no per-instance fitting.
    if split=='heldout' and 'reduced' in encs:
        e=encs['reduced']
        for seed in seeds:
            for label in ('transfer_only','random_schedule','reduced_cvar_shot'):
                start=time.perf_counter();cfg=Config('reduced_cvar' if label=='reduced_cvar_shot' else 'reduced',seed=seed,alpha=.2 if label=='reduced_cvar_shot' else 1,training_shots=256 if label=='reduced_cvar_shot' else 0)
                a=Ansatz(e,cfg)
                if label=='transfer_only':angles=np.array(transferred['parameters']);opt={'evaluations':0,'training_shots':0}
                elif label=='random_schedule':
                    rng=np.random.default_rng(seed);angles=np.r_[rng.uniform(0,2*np.pi,2),rng.uniform(0,np.pi,2)];opt={'evaluations':0,'training_shots':0}
                else:angles,opt=optimize(a)
                p=abs(a.state(angles))**2;sample=sample_metrics(e,p,1024,seed+2000000)
                row={'scenario':s.id,'split':split,'method':label,'seed':seed,'status':'completed','config':asdict(cfg),'parameters':angles.tolist(),'metrics':probabilities(e,p),'sample':sample,'optimizer':opt,'qubits':e.n,'timing':{'observed_cached_run_wall_seconds':time.perf_counter()-start,'encoding_table_preprocessing_seconds':e.prep_seconds,'standalone_pipeline_seconds_excluding_synthesis':time.perf_counter()-start+e.prep_seconds},'transfer_training_seconds':transferred['total_seconds'] if label=='transfer_only' else 0,'transfer_training_ids':transferred['training_ids'] if label=='transfer_only' else []}
                stream.write(json.dumps(row,allow_nan=False)+'\n');stream.flush()


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',required=True);ap.add_argument('--pilot',action='store_true');args=ap.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    protocol={'pilot':args.pilot,'primary_methods':METHODS,'heldout_seeds':list(range(101,111)),'training_seeds':[11,19],'generation_seed':20261023,'config':asdict(Config('standard')),'training_shot_control':256,'versions':{k:importlib.metadata.version(k) for k in ['numpy','scipy','qiskit','qiskit-aer']},'python':platform.python_version(),'source_sha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'research/quantum_experiments').glob('*.py')}}
    dump(out/'protocol.json',protocol);start=time.perf_counter()
    train=scenarios();transfer=train_transfer([train[0],train[1],train[-1]]);dump(out/'transfer_training.json',transfer)
    with (out/'runs.jsonl').open('x') as stream:
        for s in (train[:1] if args.pilot else train):run_case(s,'training',[11] if args.pilot else [11,19],out,stream,transfer,METHODS)
        if not args.pilot:
            for s in holdout():run_case(s,'heldout',list(range(101,111)),out,stream,transfer,METHODS)
    dump(out/'complete.json',{'seconds':time.perf_counter()-start,'status':'completed'})

if __name__=='__main__':main()
