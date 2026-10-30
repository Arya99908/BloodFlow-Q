"""Audit saved allocations, budgets, paired records, deterministic quantum replay."""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
from research.quantum_experiments.instances import generated
from .model import Task
from .run import fees_for, REPOSITORY_ROOT
from .ablation import improve

def rows(p):return [json.loads(x) for x in p.read_text().splitlines()]
def validate_sources(protocol, repository_root=REPOSITORY_ROOT):
    """Check this run's recorded source, never a different experiment's snapshot.

    Legacy protocols recorded absolute necessity-module filenames. Relocate only
    that known suffix; arbitrary absolute paths are deliberately not trusted.
    """
    snapshot = protocol.get('source_sha256')
    if not isinstance(snapshot, dict) or not snapshot:
        raise ValueError('Protocol must contain a nonempty source_sha256 mapping')
    checked = []
    legacy = protocol.get('source_path_format') != 'repository-relative-v1'
    for recorded, digest in snapshot.items():
        path = Path(recorded)
        if path.is_absolute() or recorded.startswith(("/", "\\")):
            if not legacy:
                raise ValueError(f'Absolute path in portable source snapshot: {recorded}')
            marker = ('research', 'quantum_experiments', 'necessity')
            indices = [i for i in range(len(path.parts)-2) if path.parts[i:i+3] == marker]
            if len(indices) != 1:
                raise ValueError(f'Unsupported legacy source path: {recorded}')
            path = Path(*path.parts[indices[0]:])
        resolved = (repository_root / path).resolve()
        if not resolved.is_relative_to(repository_root.resolve()):
            raise ValueError(f'Source path escapes repository: {recorded}')
        actual = hashlib.sha256(resolved.read_bytes()).hexdigest()
        if actual != digest:
            raise ValueError(f'Source hash mismatch: {path.as_posix()}')
        checked.append(path.as_posix())
    plan = repository_root / 'research/quantum_experiments/necessity/PROTOCOL.md'
    if hashlib.sha256(plan.read_bytes()).hexdigest() != protocol.get('plan_sha256'):
        raise ValueError('Protocol plan hash mismatch: PROTOCOL.md')
    return {'verified_source_files': checked, 'source_coverage': protocol.get(
        'source_coverage', 'Legacy recorded files only; imported dependencies were not captured'),
        'legacy_source_scope': legacy, 'plan_hash_verified': True}


def historical_integrity(snapshot_path):
    """Optional explicit verification, separate from run-source provenance."""
    snapshot = json.loads(snapshot_path.read_text())
    for name, digest in snapshot.items():
        path = Path(name)
        if not path.is_absolute():
            path = REPOSITORY_ROOT / path
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f'Historical snapshot mismatch: {name}')
    return {'snapshot': str(snapshot_path), 'verified_files': len(snapshot)}


def save_report(directory, report):
    # Exclusive creation protects earlier successful validation evidence as well.
    with (directory / 'validation.json').open('x') as stream:
        stream.write(json.dumps(report, indent=2) + '\n')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--historical-snapshot',type=Path,
                        help='Optional separate historical hash manifest; never implied by run validation')
    args=parser.parse_args();b=args.input
    protocol=json.loads((b/'protocol.json').read_text())
    provenance=validate_sources(protocol)
    historical=historical_integrity(args.historical_snapshot) if args.historical_snapshot else None
    data=rows(b/'runs.jsonl');cases=rows(b/'cases.jsonl')
    expected_cases=2 if protocol['pilot'] else 12
    expected_runs=expected_cases*4*len(protocol['seeds'])
    assert len(data)==expected_runs and len(cases)==expected_cases
    assert len({(r['scenario'],r['variant'],r['method'],r['seed']) for r in data})==expected_runs
    lookup={};replayed=0;round_count=0
    specs=[(3,3,('O',)),(3,3,('O','A')),(4,3,('O',)),(3,4,('O','A')),(4,4,('O','A')),(5,5,('O',))]
    for i,(nb,nh,g) in enumerate(specs):
        s=generated(nb,nh,g,7300+i,f'necessity_{i:02}',2)
        for variant in ('original','fixed_dispatch_hypothesis'):lookup[s.id,variant]=Task(s,fees_for(s,8300+i) if variant!='original' else None)
    for row in data:
        task=lookup[row['scenario'],row['variant']];x=task.greedy()
        assert row['seed'] in protocol['seeds'] and row['method'] in ('milp','table_lookup','quantum','uniform')
        assert len(row['rounds'])==protocol['rounds']
        for r,detail in enumerate(row['rounds']):
            assert abs(task.validate(x)-detail['initial_objective'])<1e-7
            y=np.array(detail['final_quantities'],int);assert abs(task.validate(y)-detail['final_objective'])<1e-7
            frozen=set(range(len(x)))-set(detail['selected']);assert all(x[j]==y[j] for j in frozen)
            assert detail['final_objective']<=detail['initial_objective']+1e-7
            assert detail['qubits']<=protocol['bit_cap'] and detail['oracle_calls']+detail['candidate_evaluations']<=protocol['query_cap']
            if row['method']=='quantum' and row['seed']==41:
                replay,log=improve(task,x,detail['selected'],'quantum',row['seed']*100+r,5.,protocol['query_cap'])
                assert log['attempts']==detail['attempts'];np.testing.assert_array_equal(replay,y);replayed+=1
            x=y;round_count+=1
        assert x.tolist()==row['final_quantities'] and abs(task.validate(x)-row['final_objective'])<1e-7
        if row['absolute_gap'] is not None:assert row['absolute_gap']>=-1e-7
    report={'validated_runs':len(data),'validated_rounds':round_count,
            'deterministically_replayed_quantum_rounds':replayed,
            'run_source_provenance':provenance, 'historical_integrity':historical,
            'scaling_cases':len(rows(b/'scaling.jsonl')) if not protocol['pilot'] else 0,
            'test_logs':'Not assessed by this allocation/replay validator; run regression tests separately'}
    save_report(b,report)
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
