"""Audit saved allocations, budgets, paired records, deterministic quantum replay."""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
from research.quantum_experiments.instances import generated
from .model import Task
from .run import fees_for
from .ablation import improve

def rows(p):return [json.loads(x) for x in p.read_text().splitlines()]
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);args=parser.parse_args();b=args.input
    data=rows(b/'runs.jsonl');cases=rows(b/'cases.jsonl');assert len(data)==240 and len(cases)==12
    assert len({(r['scenario'],r['variant'],r['method'],r['seed']) for r in data})==240
    lookup={};replayed=0;round_count=0
    specs=[(3,3,('O',)),(3,3,('O','A')),(4,3,('O',)),(3,4,('O','A')),(4,4,('O','A')),(5,5,('O',))]
    for i,(nb,nh,g) in enumerate(specs):
        s=generated(nb,nh,g,7300+i,f'necessity_{i:02}',2)
        for variant in ('original','fixed_dispatch_hypothesis'):lookup[s.id,variant]=Task(s,fees_for(s,8300+i) if variant!='original' else None)
    for row in data:
        task=lookup[row['scenario'],row['variant']];x=task.greedy()
        for r,detail in enumerate(row['rounds']):
            assert abs(task.validate(x)-detail['initial_objective'])<1e-7
            y=np.array(detail['final_quantities'],int);assert abs(task.validate(y)-detail['final_objective'])<1e-7
            frozen=set(range(len(x)))-set(detail['selected']);assert all(x[j]==y[j] for j in frozen)
            assert detail['final_objective']<=detail['initial_objective']+1e-7
            assert detail['qubits']<=10 and detail['oracle_calls']+detail['candidate_evaluations']<=64
            if row['method']=='quantum' and row['seed']==41:
                replay,log=improve(task,x,detail['selected'],'quantum',row['seed']*100+r,5.,64)
                assert log['attempts']==detail['attempts'];np.testing.assert_array_equal(replay,y);replayed+=1
            x=y;round_count+=1
        assert x.tolist()==row['final_quantities'] and abs(task.validate(x)-row['final_objective'])<1e-7
        assert row['absolute_gap']>=-1e-7
    root=Path('research/quantum_experiments')
    snap=json.loads((root/'results/source_snapshot.json').read_text())
    for path,digest in snap.items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==digest,path
    prior=json.loads((root/'results/delivery_manifest.json').read_text())
    for path,digest in prior.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
    tests={}
    for name in ('necessity_legacy_tests.log','necessity_research_tests.log'):
        text=(root/'results'/name).read_text();assert text.rstrip().endswith('OK');tests[name]=text[text.rfind('Ran '):].strip()
    report={'validated_runs':len(data),'validated_rounds':round_count,'deterministically_replayed_quantum_rounds':replayed,'prior_source_and_evidence_files_unchanged':len(snap),'prior_delivery_artifacts_unchanged':len(prior),'tests':tests,'scaling_cases':len(rows(b/'scaling.jsonl'))}
    (root/'results/necessity_validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
