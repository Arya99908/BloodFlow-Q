"""Summarize recorded production runs without substituting missing measurements."""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
import math
from pathlib import Path
import statistics

METRICS = ('wall_seconds', 'solver_wall_seconds', 'qubo_construction_seconds',
           'objective', 'absolute_gap', 'feasibility', 'feasible_shot_rate',
           'optimal_shot_rate', 'final_feasible_probability', 'initial_expected_energy', 'final_expected_energy')


def summarize(rows):
    result = {'records': len(rows), 'statuses': dict(Counter(r['status'] for r in rows))}
    for metric in METRICS:
        values = []
        for row in rows:
            value = row.get(metric)
            if metric == 'feasibility' and isinstance(value, bool):
                value = int(value)
            if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
                values.append(value)
        result[metric] = {'n': len(values), 'mean': statistics.mean(values) if values else None,
                          'median': statistics.median(values) if values else None,
                          'sample_std': statistics.stdev(values) if len(values) > 1 else None}
    return result


def analyze(directory: Path):
    raw = directory / 'runs.jsonl'
    payload = raw.read_bytes()
    rows = [json.loads(line) for line in payload.splitlines() if line.strip()]
    keys = [row['key'] for row in rows]
    if len(keys) != len(set(keys)):
        raise ValueError('Duplicate run keys; refusing to double-count resumed records')
    groups = defaultdict(list)
    methods = defaultdict(list)
    for row in rows:
        groups[(row['family'], row['scenario'], row['method'])].append(row)
        if row['family'] == 'primary':
            methods[row['method']].append(row)
    grouped = [{'family': family, 'scenario': scenario, 'method': method, **summarize(items)}
               for (family, scenario, method), items in sorted(groups.items())]
    aggregate = [{'method': method, **summarize(items)} for method, items in sorted(methods.items())]
    result = {'source': str(raw), 'source_sha256': hashlib.sha256(payload).hexdigest(),
              'complete_marker_present': (directory / 'complete.json').exists(),
              'records': len(rows), 'statuses': dict(Counter(r['status'] for r in rows)),
              'definitions': 'feasible_shot_rate is operational allocation/shortage feasibility; final_feasible_probability and optimal_shot_rate use strict encoded equality proof masks. Statistics use only finite recorded values, with n per metric. Feasibility mean is returned-solution feasibility, distinct from feasible-shot rate. Sample standard deviation uses n-1 and is null for n<2. Aggregate methods use primary-family rows only; ablations have fewer scenarios and must not be ranked against full methods. Runtime/objective means across different instances are descriptive, not paired significance evidence. Failed/skipped rows remain in status counts; missing metrics are never zero.',
              'scenario_method': grouped, 'primary_method': aggregate}
    (directory / 'summary.json').write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    for name, entries in [('scenario_method', grouped), ('primary_method', aggregate)]:
        flattened = []
        for entry in entries:
            flat = {k:v for k,v in entry.items() if k not in METRICS and k != 'statuses'}
            flat['statuses'] = json.dumps(entry['statuses'], sort_keys=True)
            for metric in METRICS:
                flat.update({f'{metric}_{stat}':value for stat,value in entry[metric].items()})
            flattened.append(flat)
        with (directory / f'{name}_summary.csv').open('w', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=list(flattened[0]) if flattened else ['records'])
            writer.writeheader()
            writer.writerows(flattened)
    public_methods = []
    for method, items in sorted(methods.items()):
        completed = [r for r in items if r['status'] == 'completed']
        measured = summarize(completed)
        counts = Counter(r['status'] for r in items)
        public_methods.append({'method': method, 'label': method.replace('_', ' '),
            'scenario_count': len({r['scenario'] for r in items}),
            **{status: counts[status] for status in ('completed', 'failed', 'skipped', 'blocked')},
            'feasible_trials': sum(r.get('feasibility') is True for r in completed),
            'evaluated_trials': sum(isinstance(r.get('feasibility'), bool) for r in completed),
            'mean_runtime_seconds': measured['wall_seconds']['mean'],
            'mean_feasible_shot_probability': measured['feasible_shot_rate']['mean']})
    public = {'schema_version': 1, 'study_date': '2026-10-24',
        'status': 'complete' if result['complete_marker_present'] else 'partial',
        'counts': {status: result['statuses'].get(status, 0) for status in ('completed', 'failed', 'skipped', 'blocked')},
        'methods': public_methods,
        'notes': ['Primary-family methods only. Scenario counts differ for ablations; compare matched cases.',
                  'Means include recorded completed runs only. Operational feasible-shot rates do not prove encoded slack equality.',
                  'Wall time includes QUBO, warm preprocessing, and interpolation training when applicable; exact proof and diagnostic analysis are excluded.',
                  'Failed and skipped records remain in counts. Simulated quantum execution; no hardware evidence or advantage claim.'],
        'report_url': '/full-review-report.md'}
    (directory / 'full-review-study.json').write_text(json.dumps(public, indent=2, allow_nan=False) + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    args = parser.parse_args()
    result = analyze(args.input)
    print(json.dumps({key:result[key] for key in ('records', 'statuses', 'complete_marker_present')}))
