"""Publish compact, provenance-bearing saved findings; never rerun a solver."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
base=ROOT/'research/quantum_experiments/results'
paths={'quantum_study':base/'study/analysis.json','replacement_study':base/'necessity/analysis.json'}
data={k:json.loads(p.read_text()) for k,p in paths.items()}
q=data['quantum_study'];n=data['replacement_study']
assert q['completed']==992 and n['records']==240
payload={'kind':'saved_research_snapshot','date':'2026-10-23','execution':'Local classical simulation; no quantum hardware or demonstrated quantum advantage.','sources':{k:{'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for k,p in paths.items()},'quantum':{'runs':q['completed'],'instances':8,'seeds_per_instance':10,'methods':q['aggregate'],'comparisons':[{k:v for k,v in row.items() if k not in ('paired_seeds','instance_mean_differences')} for row in q['comparisons']]},'replacement':{'runs':n['records'],'cases':n['cases'],'scaling_cases':n['scaling_cases'],'summary':n['summary'],'comparisons':[{k:v for k,v in row.items() if k!='pairs'} for row in n['paired']],'classical_scaling':n['classical_scaling']}}
(ROOT/'frontend/public/quantum-followup-study.json').write_text(json.dumps(payload,indent=2)+'\n')
print('Exported verified saved research summaries; no solver was run.')
