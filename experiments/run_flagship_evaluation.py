"""Matched synthetic controls. Retains failures; never overwrites an artifact."""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
from importlib.metadata import version
import itertools
import json
from pathlib import Path
import platform
import random
import statistics
import subprocess
import time

from backend.flagship import FlagshipRequest, run_flagship
from backend.services import BackendService


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    # Reserve output before any work. Existing scientific results are immutable.
    with args.output.open('x') as output:
        methods = ['milp', 'exact', 'greedy', 'standard', 'warm', 'seed_only', 'xy', 'warm_xy']
        jobs = list(itertools.product(['service_first', 'weighted'], [False, True], [1, 40], [7, 11, 19], methods))
        random.Random(20261025).shuffle(jobs)
        rows = []
        for policy, disrupted, cost, seed, method in jobs:
            request = FlagshipRequest(policy=policy, disrupted=disrupted, critical_route_cost=cost, seed=seed, method=method)
            start = time.perf_counter()
            try:
                record = run_flagship(request, BackendService())
                rows.append({'status': 'PASS' if record['result']['feasibility'] else 'FAIL', 'record': record})
            except Exception as error:
                rows.append({'status': 'FAIL', 'input': request.model_dump(), 'error': str(error), 'wall_seconds': time.perf_counter()-start})
        references = {r['record']['comparison_id']: r['record']['result']['total_objective'] for r in rows if r['status']=='PASS' and r['record']['method']=='milp'}
        summaries = defaultdict(lambda: {'runs': 0, 'feasible': 0, 'matches_milp': 0, 'seconds': []})
        for row in rows:
            record = row.get('record')
            method = record['method'] if record else row['input']['method']
            summary = summaries[method]
            summary['runs'] += 1
            summary['seconds'].append(record['wall_seconds'] if record else row['wall_seconds'])
            if row['status']=='PASS':
                summary['feasible'] += 1
                ref = references.get(record['comparison_id'])
                summary['matches_milp'] += int(ref is not None and abs(record['result']['total_objective']-ref)<1e-7)
        for summary in summaries.values():
            times = summary.pop('seconds')
            summary.update(mean_service_seconds=statistics.mean(times), min_service_seconds=min(times), max_service_seconds=max(times))
        root = Path(__file__).resolve().parents[1]
        hashes = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['backend','optimization','quantum'] for p in sorted((root/folder).rglob('*.py'))}
        artifact = {'created_at_utc': datetime.now(timezone.utc).isoformat(), 'command': f'python -m experiments.run_flagship_evaluation --output {args.output}',
                    'python': platform.python_version(), 'platform': platform.platform(), 'packages': {p: version(p) for p in ['qiskit','qiskit-aer','numpy','scipy','pydantic','fastapi']},
                    'git_head': subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(), 'source_sha256': hashes,
                    'design': '8 fixed synthetic templates, 3 seeds, 8 methods; shuffled order seed 20261025. Shared settings; no tuning on this suite. Descriptive only; templates are not an independent population sample.',
                    'timing_scope': 'Service wall time; local ideal statevector training/Aer sampling. No HTTP/process startup or hardware time. Inclusive solver timing components remain in raw records.',
                    'summary': dict(summaries), 'runs': rows}
        json.dump(artifact, output, indent=2, allow_nan=False)
        output.write('\n')
    print(json.dumps(artifact['summary'], indent=2))


if __name__ == '__main__':
    main()
