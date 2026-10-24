"""Descriptive paired analysis; case, not seed, is the independent unit."""
import argparse,json,statistics
from pathlib import Path
import numpy as np

def load(path):return [json.loads(line) for line in path.read_text().splitlines()]
def ci(values):
    a=np.asarray(values);rng=np.random.default_rng(20261023)
    return np.quantile(rng.choice(a,(10000,len(a)),replace=True).mean(axis=1),[.025,.975]).tolist()

def main():
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);args=p.parse_args();b=args.input
    rows=load(b/'runs.jsonl');cases=load(b/'cases.jsonl');scaling=load(b/'scaling.jsonl');summary=[];paired=[]
    for variant in sorted({r['variant'] for r in rows}):
        for method in ('milp','table_lookup','quantum','uniform'):
            subset=[r for r in rows if r['variant']==variant and r['method']==method]
            case_means=[statistics.mean(r['absolute_gap'] for r in subset if r['scenario']==s) for s in sorted({r['scenario'] for r in subset})]
            summary.append({'variant':variant,'method':method,'runs':len(subset),'instances':len(case_means),'mean_absolute_gap':statistics.mean(case_means),'gap_case_bootstrap95':ci(case_means),'optimal_runs':sum(r['optimal'] for r in subset),'improved_runs':sum(r['final_objective']<r['initial_objective']-1e-7 for r in subset),'mean_seconds_including_setup':statistics.mean(r['seconds_including_shared_setup'] for r in subset),'mean_table_evaluations':statistics.mean(sum(x['table_evaluations'] for x in r['rounds']) for r in subset),'mean_oracle_calls':statistics.mean(sum(x['oracle_calls'] for x in r['rounds']) for r in subset),'mean_measurement_shots':statistics.mean(sum(x['measurement_shots'] for x in r['rounds']) for r in subset),'round_overruns':sum(x['budget_overrun_seconds']>0 for r in subset for x in r['rounds'])})
        quantum={(r['scenario'],r['seed']):r for r in rows if r['variant']==variant and r['method']=='quantum'}
        for method in ('milp','table_lookup','uniform'):
            other={(r['scenario'],r['seed']):r for r in rows if r['variant']==variant and r['method']==method};assert quantum.keys()==other.keys()
            differences=[{'scenario':s,'seed':seed,'objective_quantum_minus_classical':quantum[s,seed]['final_objective']-other[s,seed]['final_objective'],'seconds_quantum_minus_classical':quantum[s,seed]['seconds_including_shared_setup']-other[s,seed]['seconds_including_shared_setup']} for s,seed in quantum]
            vals=[statistics.mean(d['objective_quantum_minus_classical'] for d in differences if d['scenario']==s) for s in sorted({d['scenario'] for d in differences})]
            paired.append({'variant':variant,'classical_replacement':method,'mean_quantum_minus_classical':statistics.mean(vals),'case_bootstrap95':ci(vals),'quantum_wins':sum(d['objective_quantum_minus_classical']< -1e-7 for d in differences),'ties':sum(abs(d['objective_quantum_minus_classical'])<=1e-7 for d in differences),'quantum_losses':sum(d['objective_quantum_minus_classical']>1e-7 for d in differences),'pairs':differences})
    result={'scope':'Exploratory; 6 generated instances paired across 2 formulations, 5 seeds. No general speedup or inferential significance claim. Intervals descriptive; ties do not prove equivalence.','records':len(rows),'cases':len(cases),'scaling_cases':len(scaling),'summary':summary,'paired':paired,'classical_scaling':[]}
    for variant in sorted({r['variant'] for r in scaling}):
        subset=[r for r in scaling if r['variant']==variant]
        result['classical_scaling'].append({'variant':variant,'cases':len(subset),'milp_proven_optimal':sum(r['milp']['proven_optimal'] for r in subset),'max_variables':max(r['variables'] for r in subset),'max_milp_seconds':max(r['milp']['seconds'] for r in subset),'max_lp_seconds':max(r['lp']['seconds'] for r in subset),'lp_strict_lower_than_milp_incumbent':sum(r['lp']['objective']<r['milp']['objective']-1e-7 for r in subset if r['lp']['objective'] is not None and r['milp']['objective'] is not None),'unproven':[{'id':r['scenario']['id'],'milp':r['milp']} for r in subset if not r['milp']['proven_optimal']]})
    (b/'analysis.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='paired'},indent=2))

if __name__=='__main__':main()
