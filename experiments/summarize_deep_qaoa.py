"""Summarize completed audit measurements without replacing raw evidence."""
import json, statistics, csv
from collections import defaultdict
from pathlib import Path
p=Path('audit/deep_qaoa_20261023/verified')
rows=[json.loads(x) for x in (p/'runs.jsonl').read_text().splitlines()]
groups=defaultdict(list)
for r in rows: groups[r['scenario'],r['variant']].append(r)
summary=[]
for (scenario,variant),runs in groups.items():
    a={'scenario':scenario,'variant':variant,'runs':len(runs),'best_optimal_runs':sum(r['best_sample_optimal'] for r in runs),'converged_runs':sum(r['optimizer']['success'] for r in runs),'mean_seconds':statistics.mean(r['seconds'] for r in runs),'mean_evaluations':statistics.mean(r['optimizer']['function_evaluations'] for r in runs),'initial_optimal_probability':runs[0]['initial']['optimal_probability'],'mean_optimal_probability':statistics.mean(r['final']['optimal_probability'] for r in runs),'min_optimal_probability':min(r['final']['optimal_probability'] for r in runs),'max_optimal_probability':max(r['final']['optimal_probability'] for r in runs),'mean_feasible_probability':statistics.mean(r['final']['feasible_probability'] for r in runs),'mean_sampled_optimal_rate':statistics.mean(r['sampled']['optimal_probability'] for r in runs),'worse_than_initial_optimal_runs':sum(r['final']['optimal_probability']<r['initial']['optimal_probability']-1e-9 for r in runs),'worse_than_initial_energy_runs':sum(r['final']['expected_energy']>r['initial']['expected_energy']+1e-7 for r in runs),'xy_optimal_probability_ceiling':runs[0]['xy_optimal_probability_ceiling']}
    summary.append(a)
with (p/'summary.json').open('w') as f: json.dump(summary,f,indent=2)
with (p/'summary.csv').open('w') as f:
    w=csv.DictWriter(f,fieldnames=list(summary[0]));w.writeheader();w.writerows(summary)
print('Runs',len(rows))
for a in summary:
 print(a['scenario'],a['variant'],a['runs'],round(a['mean_optimal_probability']*100,2),'best',a['best_optimal_runs'],'converged',a['converged_runs'],'worse energy',a['worse_than_initial_energy_runs'])
