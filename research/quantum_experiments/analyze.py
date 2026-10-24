"""Prespecified instance-paired tests; descriptive hierarchical bootstrap intervals."""
import itertools,json,statistics
from pathlib import Path
from collections import defaultdict
import numpy as np

BASE=Path('research/quantum_experiments/results/study')

def bootstrap(values,seed=17,reps=10000):
    a=np.asarray(values,float);rng=np.random.default_rng(seed)
    draws=rng.choice(a,size=(reps,len(a)),replace=True).mean(axis=1)
    return [float(x) for x in np.quantile(draws,[.025,.975])]

def sign_test(d):
    d=np.array(d,float);obs=abs(d.mean());perms=[abs(np.mean(d*np.array(signs))) for signs in itertools.product((-1,1),repeat=len(d))]
    return sum(v>=obs-1e-14 for v in perms)/len(perms)

def analyze():
    rows=[json.loads(x) for x in (BASE/'runs.jsonl').read_text().splitlines()]
    completed=[r for r in rows if r['status']=='completed'];held=[r for r in completed if r['split']=='heldout']
    cells=defaultdict(list)
    for r in held:cells[r['scenario'],r['method']].append(r)
    summaries=[]
    for (s,m),a in cells.items():
        values=[r['metrics']['p_optimal_feasible'] for r in a]
        summaries.append({'scenario':s,'method':m,'seeds':[r['seed'] for r in a],'n':len(a),'mean_p_optimal':statistics.mean(values),'seed_bootstrap95':bootstrap(values),'min_p_optimal':min(values),'max_p_optimal':max(values),'mean_p_feasible':statistics.mean(r['metrics']['p_feasible'] for r in a),'mean_conditional_feasible_gap':statistics.mean(r['metrics']['conditional_feasible_absolute_gap'] for r in a if r['metrics']['conditional_feasible_absolute_gap'] is not None),'best_optimal_runs':sum(r['sample']['best_feasible_absolute_gap'] is not None and abs(r['sample']['best_feasible_absolute_gap'])<1e-7 for r in a),'mean_pipeline_seconds_without_synthesis':statistics.mean(r['timing']['standalone_pipeline_seconds_excluding_synthesis'] for r in a),'mean_training_shots':statistics.mean(r['optimizer'].get('training_shots',0) for r in a),'mean_evaluations':statistics.mean(r['optimizer'].get('evaluations',0) for r in a)})
    aggregate=[]
    for m in dict.fromkeys(r['method'] for r in held):
        a=[s for s in summaries if s['method']==m]
        aggregate.append({'method':m,'instances':len(a),'runs':sum(x['n'] for x in a),'mean_p_optimal':statistics.mean(x['mean_p_optimal'] for x in a),'instance_bootstrap95':bootstrap([x['mean_p_optimal'] for x in a]),'mean_p_feasible':statistics.mean(x['mean_p_feasible'] for x in a),'best_optimal_runs':sum(x['best_optimal_runs'] for x in a),'mean_pipeline_seconds_without_synthesis':statistics.mean(x['mean_pipeline_seconds_without_synthesis'] for x in a),'mean_evaluations':statistics.mean(x['mean_evaluations'] for x in a),'mean_training_shots':statistics.mean(x['mean_training_shots'] for x in a)})
    comparisons=[]
    for cand,control in [('qubo_cvar','standard'),('reduced','standard'),('feasible_grover','reduced')]:
        ids=sorted(set(r['scenario'] for r in held));d=[];seed_pairs=[]
        for s in ids:
            aa={r['seed']:r['metrics']['p_optimal_feasible'] for r in cells[s,cand]};bb={r['seed']:r['metrics']['p_optimal_feasible'] for r in cells[s,control]}
            assert aa.keys()==bb.keys();diff=[aa[k]-bb[k] for k in sorted(aa)]
            d.append(statistics.mean(diff));seed_pairs.append({'scenario':s,'paired_seed_differences':diff})
        comparisons.append({'candidate':cand,'control':control,'n_independent_instances':len(d),'instance_mean_differences':d,'paired_seeds':seed_pairs,'mean_difference':statistics.mean(d),'instance_bootstrap95':bootstrap(d),'two_sided_exact_sign_permutation_p':sign_test(d)})
    order=sorted(range(len(comparisons)),key=lambda i:comparisons[i]['two_sided_exact_sign_permutation_p']);last=0
    for rank,i in enumerate(order):
        p=min(1,(len(order)-rank)*comparisons[i]['two_sided_exact_sign_permutation_p']);last=max(last,p);comparisons[i]['holm_adjusted_p']=last
    payload={'scope':'8 prespecified synthetic held-out cases, 10 paired optimizer seeds; bootstrap CIs descriptive for this small case collection, not representative population inference','null_assumption':'instance-level paired differences symmetric under sign flip; instances not shots are units in confirmatory family','multiple_comparison_family':'exactly three prespecified contrasts; all other comparisons exploratory','total_records':len(rows),'completed':len(completed),'per_case':summaries,'aggregate':aggregate,'comparisons':comparisons}
    (BASE/'analysis.json').write_text(json.dumps(payload,indent=2)+'\n')
    print(json.dumps({'aggregate':aggregate,'comparisons':[{k:v for k,v in c.items() if k not in ['paired_seeds','instance_mean_differences']} for c in comparisons]},indent=2))

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,default=BASE)
    BASE=parser.parse_args().input
    analyze()
