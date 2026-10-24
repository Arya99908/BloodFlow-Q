"""Render the October 24 measured report without altering historical evidence.

Run only after production_v2 has its complete marker and matching analyzer output.
Optional experiment families remain explicitly absent/incomplete until recorded.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import shutil
import statistics

ROOT = Path(__file__).resolve().parents[1]
START = '<!-- BEGIN FULL REVIEW 20261024 -->'
END = '<!-- END FULL REVIEW 20261024 -->'


def read(path):
    return json.loads(path.read_text())


def rows(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def finite(value):
    return isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value)


def fmt(value):
    return f'{value:.6g}' if finite(value) else 'not measured'


def stats(values):
    values = [value for value in values if finite(value)]
    return {'n': len(values), 'mean': statistics.mean(values) if values else None,
            'median': statistics.median(values) if values else None,
            'sample_std': statistics.stdev(values) if len(values) > 1 else None}


def stat_text(value):
    return f"{fmt(value['mean'])} / {fmt(value['median'])} / {fmt(value['sample_std'])} (n={value['n']})"


def table(headers, values):
    def cell(value):
        return str(value).replace('|', '\\|').replace('\n', ' ')
    return '\n'.join(['| ' + ' | '.join(map(cell, headers)) + ' |',
                      '| ' + ' | '.join('---' for _ in headers) + ' |'] +
                     ['| ' + ' | '.join(map(cell, row)) + ' |' for row in values]) + '\n'


def link(path):
    relative = path.resolve().relative_to(ROOT)
    return f'[{relative.as_posix()}](../{relative.as_posix()})'


def render(directory):
    production = directory / 'production_v2'
    if not (production / 'complete.json').exists():
        raise ValueError('production_v2/complete.json missing; refusing to publish unfinished primary results')
    summary = read(production / 'summary.json')
    payload = (production / 'runs.jsonl').read_bytes()
    if summary['source_sha256'] != hashlib.sha256(payload).hexdigest():
        raise ValueError('Production summary is stale; rerun analyze_full_review first')
    raw = rows(production / 'runs.jsonl')
    marker = read(production / 'complete.json')
    if not summary['complete_marker_present'] or marker['records'] != len(raw) or summary['records'] != len(raw):
        raise ValueError('Primary completion marker, raw records, and summary disagree')
    adapter = read(production / 'full-review-study.json')
    if adapter.get('schema_version') != 1 or adapter.get('status') != 'complete':
        raise ValueError('Current UI adapter is missing or incomplete')
    protocol = read(production / 'protocol.json')
    config = protocol['configuration']
    sections = [START, '## October 24, 2026 — fresh full-repository review',
        'This section is generated from recorded local runs. Historical results below remain separate. '
        'All quantum execution is simulated; no hardware speedup or quantum advantage is established. '
        'The current linear allocation problem has a strong integral LP/min-cost-flow baseline. '
        'Warm preparation and optimizer parameter initialization are distinct algorithm choices.',
        f"Primary raw evidence: {link(production / 'runs.jsonl')}. Configuration/environment: {link(production / 'protocol.json')}. "
        f"Machine-readable summaries: {link(production / 'summary.json')}. Raw SHA-256: `{summary['source_sha256']}`.",
        '### Methodology and source provenance',
        'The objective minimizes priority-weighted shortage, total shortage and per-unit transportation burdens. '
        'Supply and demand constraints use shortened binary shipment/shortage/slack registers in production QAOA. '
        'Exact enumeration verifies small formulations, MILP/LP and greedy provide classical references. '
        'Synthetic cases, weights, penalty strengths and qubit counts are saved in each `*_case.json`; '
        'every `*_proof.json` preserves its exhaustive energy-equivalence check. '
        'See [mathematical audit](mathematical_model_audit.md) and [primary-literature review](quantum_research_review.md) '
        'for equations and citations, including Egger warm-start QAOA, Hadfield constrained mixers, and Zhou parameter interpolation.',
        '```json\n' + json.dumps(protocol, indent=2) + '\n```',
        'The production_v2 protocol/source_snapshot preserves the module versions imported when that process started. '
        'Its MILP snapshot predates the all-zero-demand corner correction. Those original boundary rows remain evidence; '
        'the separately recorded `boundary_corrected` family must be used for corrected-source behavior and is never silently pooled. '
        'Source hashes identify recorded coverage, not an assertion that every dependency or the current checkout is unchanged.',
        '### Execution coverage and metric definitions',
        f"Recorded primary-runner outcomes: `{json.dumps(summary['statuses'], sort_keys=True)}` across {len(raw)} records. "
        'Completed means a run returned; inspect optimizer success/convergence separately. '
        'Failures, explicit unsupported skips, and resource limits remain in the raw ledger.',
        summary['definitions'],
        'Tables report mean / median / sample standard deviation (n−1 denominator), with the actual nonmissing n. '
        'Missing metrics are not zero. Feasibility is returned operational allocation feasibility; feasible-shot rate uses '
        'the shipment/shortage validator and does not require encoded slack equality. Ideal final_feasible_probability and '
        'optimal_shot_rate use strict encoded proof masks. Objective gaps are absolute, reference-dependent and absent when '
        'no valid reference/comparison exists. Different scenarios have different objective scales.',
        'End-to-end `wall_seconds` charges QUBO construction, warm preprocessing, optimizer work, circuit construction, '
        'simulation, final sampling/postprocessing and parameter-training overhead where applicable. Independent exact proofs '
        'and diagnostic probability analysis are excluded and timed separately. Circuit/statevector timing is nested inside '
        'inclusive optimization time: do not sum overlapping fields. Peak RSS is a process-lifetime high-water mark, '
        'not isolated per-run allocation. Serial fixed-seed repetitions share machine/cache conditions and are not independent '
        'problem instances. This small fixed corpus does not justify population confidence claims.',
    ]
    primary = [r for r in raw if r['family'] == 'primary']
    full_methods = set(config['primary_variants']) | {'greedy', 'milp', 'lp', 'exact'}
    for label, selected in [('Primary methods and classical baselines', full_methods),
                            ('Smaller-scope parameter/depth/shot ablations', {r['method'] for r in primary} - full_methods)]:
        output = []
        for method in sorted(selected):
            group = [r for r in primary if r['method'] == method]
            if not group:
                continue
            completed = [r for r in group if r['status'] == 'completed']
            gaps = [r.get('absolute_gap') for r in completed]
            output.append([method, len({r['scenario'] for r in group}), json.dumps(dict(Counter(r['status'] for r in group))),
                stat_text(stats(r.get('wall_seconds') for r in completed)),
                f"{sum(r.get('feasibility') is True for r in completed)}/{sum(isinstance(r.get('feasibility'), bool) for r in completed)}",
                stat_text(stats(r.get('feasible_shot_rate') for r in completed)),
                stat_text(stats(gaps)), len(completed)-sum(finite(g) for g in gaps)])
        sections += ['### ' + label, 'Completed-run statistics; all outcomes remain in the status column. '
                     'Do not rank the smaller ablations against methods covering a different case set.',
                     table(['Method', 'Scenarios', 'Statuses', 'Runtime s mean/median/SD (n)', 'Feasible/evaluated',
                            'Operational shot rate mean/median/SD (n)', 'Absolute gap mean/median/SD (n)', 'Missing gap'], output)]
    sections += ['### Matched guard ablations (exploratory)',
        'Pairs match scenario and seed among completed primary-family runs. Differences below are treatment minus control; '
        'negative runtime/energy/gap differences favor treatment. Seeds within a case are not independent case evidence. '
        'No p-values, significance or universal superiority claim is inferred. The guard only ensures ideal expected '
        'penalized energy no worse than its initial reference when solver execution succeeds; it does not guarantee '
        'optimal-shot rate, returned quality, feasibility or speed.']
    paired = []
    lookup = {(r['scenario'], r['method'], r['seed']): r for r in primary if r['status'] == 'completed'}
    for control, treatment in [('warm','warm_keep'), ('warm_zero','warm_zero_keep'), ('warm','warm_zero')]:
        matches = [(row, lookup[(scenario,treatment,seed)]) for (scenario,method,seed),row in lookup.items()
                   if method == control and (scenario,treatment,seed) in lookup]
        for metric in ['wall_seconds','final_expected_energy','optimal_shot_rate','absolute_gap']:
            differences = [b[metric]-a[metric] for a,b in matches if finite(a.get(metric)) and finite(b.get(metric))]
            paired.append([control, treatment, metric, len(matches), stat_text(stats(differences))])
    sections.append(table(['Control','Treatment','Metric','Matched runs','Difference mean/median/SD (n)'],paired))
    phases = []
    for method in sorted({r['method'] for r in primary}):
        group = [r for r in primary if r['method']==method and r['status']=='completed']
        for field in ['preprocessing_seconds','optimization_seconds_inclusive','circuit_construction_seconds',
                      'statevector_simulation_seconds','compilation_seconds','final_sampling_seconds','postprocessing_seconds']:
            values = [r.get('optimizer',{}).get('timing',{}).get(field) for r in group]
            if any(finite(v) for v in values): phases.append([method,field,stat_text(stats(values))])
        for field in ['objective_evaluations_total','reference_evaluations','function_evaluations']:
            values = [r.get('optimizer',{}).get(field) for r in group]
            if any(finite(v) for v in values): phases.append([method,field,stat_text(stats(values))])
    sections += ['### Timing phases and computational budgets',
                 table(['Method','Nested phase (seconds) or evaluation count','Mean/median/SD (n)'],phases)]
    sections += ['### Every recorded scenario/method',
        table(['Family','Scenario','Method','Statuses','Runtime s mean/median/SD (n)','Objective mean/median/SD (n)',
               'Absolute gap mean/median/SD (n)','Operational feasible-shot mean/median/SD (n)'],
              [[r['family'],r['scenario'],r['method'],json.dumps(r['statuses']),stat_text(r['wall_seconds']),
                stat_text(r['objective']),stat_text(r['absolute_gap']),stat_text(r['feasible_shot_rate'])]
               for r in summary['scenario_method']])]
    failures = [r for r in raw if r['status']!='completed']
    sections += ['### Explicit skipped/failed records', table(['Run','Status','Reason'],
                [[r['key'],r['status'],r.get('reason',r.get('error',r.get('message','See raw record')))] for r in failures])]
    if (production/'primary_comparison.svg').exists():
        sections += ['### Recorded distributions', '![Measured primary runtime and strict optimal-shot distributions](../'+(production/'primary_comparison.svg').relative_to(ROOT).as_posix()+')', 'Recreate with `python -m experiments.plot_full_review --input experiments/results/full_review_20261024/production_v2` (optional plotting dependency: matplotlib==3.11.2). Boxplots pool cases and seeds descriptively; they are not confidence intervals.']
    sections += ['### Independent suites and corrected boundaries']
    suite_names = ['research_study','supplementary','necessity','necessity_v2','boundary_corrected','historical_recovered']
    suite_names += sorted(p.name for p in directory.iterdir() if p.is_dir() and p.name not in set(suite_names) | {'production_v2'})
    for name in suite_names:
        folder = directory/name
        if not folder.exists():
            sections.append(f'**{name}: not present at report generation; no results claimed.**')
            continue
        complete = (folder/'complete.json').exists()
        sections.append(f"#### {name}\n\nCompletion marker: {'present' if complete else 'absent; incomplete/unverified'}. Sources: " +
                        ', '.join(link(p) for p in sorted(folder.glob('*.json')) if p.name in {'complete.json','analysis.json','summary.json','validation.json','protocol.json'}))
        inventory = []
        for path in sorted(folder.glob('*.jsonl')):
            records = rows(path)
            inventory.append([path.name,len(records),json.dumps(dict(Counter(r.get('status','status not recorded') for r in records))),link(path)])
        sections.append(table(['Artifact','Rows','Recorded statuses','Evidence'], inventory))
        for filename in ['analysis.json','validation.json']:
            if (folder/filename).exists():
                data=read(folder/filename)
                sections.append(f'{filename}: '+link(folder/filename)+' (full per-case statistics and provenance).')
                if filename=='validation.json':
                    sections.append('Validation counts: '+json.dumps({k:v for k,v in data.items() if isinstance(v,(int,float))})+'.')
                if filename=='analysis.json':
                    sections.append(str(data.get('scope','')))
                    records=data.get('summary',data.get('aggregate',[]))
                    if isinstance(records,list) and records:
                        numeric=[k for k in records[0] if isinstance(records[0][k],(int,float,str))]
                        sections.append(table(numeric,[[r.get(k,'not recorded') for k in numeric] for r in records]))
        if name=='boundary_corrected' and (folder/'runs.jsonl').exists():
            sections.append(table(['Scenario','Method','Status','Feasible','Objective','Runtime s'],
                [[r.get('scenario'),r.get('method'),r.get('status'),r.get('feasibility'),fmt(r.get('objective')),fmt(r.get('wall_seconds'))] for r in rows(folder/'runs.jsonl')]))
    manifests = sorted(directory.glob('*execution*.json'))
    if manifests:
        sections.append('### Orchestration manifests and exact commands')
        for path in manifests:
            sections.append(link(path) + '\n\n```json\n' + json.dumps(read(path), indent=2) + '\n```')
    sections += ['The research prototype suite uses separate encodings/optimizers and timing conventions, including '
        'enumerated feasible states and reduced quantities. Its pipeline timings excluding synthesis cannot be pooled with '
        'production compiled end-to-end timings. Supplementary noise is a toy gate-depolarizing model, not hardware calibration. '
        'Grover/table oracles pay classical enumeration costs; oracle access is not free. Necessity fixed-dispatch cases '
        'are hypothetical extensions. The first necessity validator failed because it hardcoded an older source manifest; '
        'its raw runs and failure log remain intact. The new validator checks its own protocol and writes local validation.json. '
        'A missing validation artifact is not a successful validation.',
        '### Reproduction and limitations',
        'Run from the repository root in the installed Python environment. Use fresh output directories; benchmark scripts '
        'reject conflicting source fingerprints/existing protocols. Historical production_v2 reproduction requires its '
        'recorded source_snapshot in an isolated checkout; current source includes the documented zero-demand correction. '
        'The following commands recreate current-source studies, then regenerate summaries/report. Do not run expensive '
        'suites concurrently; retain failure logs and all seeds. Set `OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1`.\n\n'
        '```sh\npython -m experiments.run_full_review --config experiments/configs/full_review_20261024.json --output experiments/results/REPRODUCTION/production_v2\n'
        'python -m experiments.analyze_full_review --input experiments/results/REPRODUCTION/production_v2\n'
        'python -m research.quantum_experiments.run_study --output experiments/results/REPRODUCTION/research_study\n'
        'python -m research.quantum_experiments.analyze --input experiments/results/REPRODUCTION/research_study\n'
        'python -m research.quantum_experiments.supplementary --output experiments/results/REPRODUCTION/supplementary\n'
        'python -m research.quantum_experiments.necessity.run --output experiments/results/REPRODUCTION/necessity_v2\n'
        'python -m research.quantum_experiments.necessity.analyze --input experiments/results/REPRODUCTION/necessity_v2\n'
        'python -m research.quantum_experiments.necessity.validate --input experiments/results/REPRODUCTION/necessity_v2\n'
        'python -m experiments.render_full_review_report --input experiments/results/REPRODUCTION\n```',
        'For the committed measurements, render with `python -m experiments.render_full_review_report '
        '--input experiments/results/full_review_20261024`. This verifies the complete marker and summary hash, '
        'preserves the historical report section, and copies the measured UI artifact. API/UI tests and build logs are '
        'separate engineering evidence; this renderer does not imply they passed. Statistical variability, optimizer '
        'nonconvergence, simulator scaling, classical warm-start cost, bounded scenario coverage, and absent hardware '
        'evidence limit any performance conclusion. Selection by exact expected energy does not guarantee finite-shot improvement.',
        END]
    return '\n\n'.join(sections)+'\n\n', production/'full-review-study.json'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,required=True)
    args=parser.parse_args()
    section, adapter = render(args.input.resolve())
    report=ROOT/'docs/EXPERIMENT_RESULTS.md'
    original=report.read_text()
    if START in original:
        if END not in original: raise ValueError('Existing generated section has no closing marker')
        original=original[:original.index(START)]+original[original.index(END)+len(END):]
    title, historical=original.split('\n',1)
    content=title+'\n\n'+section+'## Historical measurements (preserved)\n\n'+historical.lstrip().removeprefix('## Historical measurements (preserved)').lstrip()
    report.write_text(content)
    public=ROOT/'frontend/public'
    public.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(report,public/'full-review-report.md')
    shutil.copyfile(adapter,public/'full-review-study.json')
    print(f'Rendered {report}; published measured report and adapter')


if __name__=='__main__':
    main()
