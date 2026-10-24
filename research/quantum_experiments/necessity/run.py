"""Run bounded classical-vs-quantum component replacement experiments."""
import argparse,hashlib,importlib.metadata,json,platform,time
from pathlib import Path
from dataclasses import asdict
import numpy as np
from research.quantum_experiments.instances import generated,serialize,WEIGHTS
from .model import Task
from .ablation import improve,selected_variables

METHODS=('milp','table_lookup','quantum','uniform')

def fees_for(s,seed):
    rng=np.random.default_rng(seed)
    return {(r.source,r.destination):int(rng.integers(3,13)) for r in s.routes}

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def source_snapshot(repository_root=REPOSITORY_ROOT):
    """Portable, conservative coverage of production and experiment Python code."""
    paths = set()
    for directory in ('optimization', 'quantum', 'experiments', 'research/quantum_experiments'):
        paths.update((repository_root / directory).rglob('*.py'))
    return {p.relative_to(repository_root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(paths)}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--pilot',action='store_true');args=parser.parse_args()
    out=args.output;out.mkdir(parents=True,exist_ok=True)
    if (out/'protocol.json').exists():raise FileExistsError('Use a fresh output directory')
    root=Path(__file__).parent
    protocol={'pilot':args.pilot,'python':platform.python_version(),'versions':{x:importlib.metadata.version(x) for x in ('numpy','scipy','qiskit')},'seeds':[41] if args.pilot else list(range(41,46)),'rounds':1 if args.pilot else 4,'bit_cap':10,'round_seconds':.1,'query_cap':64,'source_sha256':source_snapshot(),'source_path_format':'repository-relative-v1','source_coverage':'All Python files in optimization, quantum, experiments, and research/quantum_experiments; excludes external dependencies and non-Python input files','plan_sha256':hashlib.sha256((root/'PROTOCOL.md').read_bytes()).hexdigest()}
    (out/'protocol.json').write_text(json.dumps(protocol,indent=2));start=time.perf_counter()
    specs=[(3,3,('O',)),(3,3,('O','A')),(4,3,('O',)),(3,4,('O','A')),(4,4,('O','A')),(5,5,('O',))]
    with (out/'runs.jsonl').open('x') as f,(out/'cases.jsonl').open('x') as cases:
        for i,(nb,nh,groups) in enumerate(specs[:1] if args.pilot else specs):
            s=generated(nb,nh,groups,7300+i,f'necessity_{i:02}',2)
            for variant in ('original','fixed_dispatch_hypothesis'):
                prep=time.perf_counter();task=Task(s,fees_for(s,8300+i) if variant!='original' else None);init=task.greedy();shared=time.perf_counter()-prep
                optimum,exact=task.solve(2.);_,lp=task.solve(2.,relaxation=True)
                if optimum is not None:task.validate(optimum)
                ref=task.score(optimum) if optimum is not None and exact['proven_optimal'] else None
                case={'scenario':serialize(s),'variant':variant,'weights':asdict(WEIGHTS),'fees':[{'route':list(k),'fee':float(v)} for k,v in zip(task.routes,task.fees)],'keys':task.keys,'initial_quantities':init.tolist(),'initial_objective':task.score(init),'shared_setup_seconds':shared,'milp':exact,'lp':lp,'reference_optimum':ref,'variables':len(task.keys)}
                cases.write(json.dumps(case)+'\n');cases.flush()
                for seed in protocol['seeds']:
                    schedule_rng=np.random.default_rng(seed);schedule=[selected_variables(task,schedule_rng) for _ in range(protocol['rounds'])]
                    # Counterbalance execution order to reduce warm-cache order effects.
                    for method in np.random.default_rng(seed+700).permutation(METHODS):
                        x=init.copy();rounds=[];t=time.perf_counter()
                        for r,selected in enumerate(schedule):
                            x,detail=improve(task,x,selected,str(method),seed*100+r,protocol['round_seconds'],protocol['query_cap']);rounds.append(detail)
                        elapsed=time.perf_counter()-t;value=task.validate(x)
                        record={'scenario':s.id,'variant':variant,'seed':seed,'method':str(method),'initial_objective':task.score(init),'final_objective':value,'reference_optimum':ref,'absolute_gap':value-ref if ref is not None else None,'optimal':bool(abs(value-ref)<1e-7) if ref is not None else None,'seconds_excluding_shared_setup':elapsed,'seconds_including_shared_setup':elapsed+shared,'final_quantities':x.tolist(),'rounds':rounds}
                        f.write(json.dumps(record)+'\n');f.flush()
                print(s.id,variant,'completed',flush=True)
    if not args.pilot:
        with (out/'scaling.jsonl').open('x') as f:
            for size in (4,8,16,24):
                for seed in (9100,9101):
                    s=generated(size,size,('O','A'),seed+size,f'scale_{size}_{seed}',3)
                    for variant in ('original','fixed_dispatch_hypothesis'):
                        t=time.perf_counter();task=Task(s,fees_for(s,seed) if variant!='original' else None);prep=time.perf_counter()-t
                        x,exact=task.solve(2.);_,lp=task.solve(2.,relaxation=True)
                        if x is not None:task.validate(x)
                        f.write(json.dumps({'scenario':serialize(s),'variant':variant,'fee_seed':seed,'fees':[{'route':list(k),'fee':float(v)} for k,v in zip(task.routes,task.fees)],'variables':len(task.keys),'setup_seconds':prep,'milp':exact,'lp':lp,'final_quantities':x.tolist() if x is not None else None})+'\n');f.flush()
                    print('scaling',size,seed,'completed',flush=True)
    (out/'complete.json').write_text(json.dumps({'status':'complete','seconds':time.perf_counter()-start},indent=2))

if __name__=='__main__':main()
