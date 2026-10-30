"""Export measured observations, never execute solvers or synthesize measurements.

Run: python3 experiments/build_observatory_evidence.py
Provenance locators identify the original JSONL line or JSON run index.
"""
from __future__ import annotations

import hashlib
import json
import math
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNS = 'experiments/results/full_review_20261024/production_v2/runs.jsonl'
WARM = 'audit/warm_qaoa_verified_results.json'
SCALING = 'research/quantum_experiments/results/supplementary/scaling.jsonl'
OUTPUT = ROOT / 'frontend/public/observatory-evidence.json'


def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def scenario_summary(scenario, family, qubits):
    banks, hospitals = scenario['blood_banks'], scenario['hospitals']
    allowed = {(r['donor'], r['recipient']) for r in scenario['compatibility'] if r['allowed']}
    routes = {(r['source'], r['destination']) for r in scenario['routes'] if r['status'] != 'blocked'}
    variables = sum(1 for b in banks for h in hospitals for donor, available in b['inventory'].items()
                    for recipient, demand in h['demand'].items()
                    if available > 0 and demand > 0 and (donor, recipient) in allowed and (b['id'], h['id']) in routes)
    return dict(id=scenario['id'], family=family, banks=len(banks), hospitals=len(hospitals),
                groups=len(scenario['blood_groups']), decision_variables=variables,
                inventory=sum(sum(b['inventory'].values()) for b in banks),
                demand=sum(sum(h['demand'].values()) for h in hospitals), qubits=qubits,
                synthetic=scenario.get('synthetic', False))


def build(root=ROOT):
    sources = {}
    def read(path):
        raw = (root / path).read_bytes()
        sources[path] = hashlib.sha256(raw).hexdigest()
        return raw.decode()
    def read_json(path):
        return json.loads(read(path))
    rows = [json.loads(line) for line in read(RUNS).splitlines() if line.strip()]
    scenarios, observations, examples = {}, [], {}
    for line, row in enumerate(rows, 1):
        case_path = str(Path(RUNS).parent / row['case_file'])
        if case_path not in scenarios:
            case = read_json(case_path)
            scenarios[case_path] = scenario_summary(case['scenario'], case['family'], case.get('qubits'))
        config, optimizer = row.get('config') or {}, row.get('optimizer') or {}
        quantum = row['method'] not in {'lp', 'milp', 'exact', 'greedy'}
        objective, reference = number(row.get('objective')), number(row.get('reference_optimum'))
        feasible = row.get('feasibility')
        raw_gap = objective - reference if feasible is True and objective is not None and reference is not None else None
        raw_relative_gap = raw_gap / abs(reference) if raw_gap is not None and reference != 0 else (0.0 if raw_gap == 0 else None)
        gap = 0.0 if raw_gap is not None and abs(raw_gap) <= 1e-9 else raw_gap
        observation = dict(
            id=row['key'], scenario=row['scenario'], family=row['family'], solver=row['method'],
            seed=row.get('seed'), status=row['status'], runtime_seconds=number(row.get('wall_seconds')) if row['status']=='completed' else None,
            recorded_elapsed_seconds=number(row.get('wall_seconds')),
            objective=objective, reference_objective=reference, absolute_gap=gap,
            raw_absolute_gap=raw_gap, raw_relative_gap=raw_relative_gap,
            relative_gap=gap / abs(reference) if gap is not None and reference != 0 else (0.0 if gap == 0 else None),
            feasible=feasible, operational_feasible_shot_rate=number(row.get('feasible_shot_rate')),
            strict_optimal_shot_rate=number(row.get('optimal_shot_rate')),
            strict_feasible_probability=number(row.get('final_feasible_probability')),
            shots=config.get('shots'), qubits=row.get('qubits'),
            circuit_depth=optimizer.get('circuit_depth'), two_qubit_gates=optimizer.get('two_qubit_gate_count'),
            gate_counts=optimizer.get('compiled_operation_counts'), peak_rss_bytes=row.get('process_peak_rss_bytes'),
            config=config or None, backend='not executed' if row['status'] == 'skipped' else ('AerSimulator (local CPU); exact statevector training' if quantum else 'classical CPU'),
            source=dict(path=RUNS, line=line))
        observations.append(observation)
        if quantum and row['status'] == 'completed' and row['method'] not in examples and row.get('counts'):
            examples[row['method']] = {**observation, 'counts': row['counts'],
                'parameters': optimizer.get('final_parameters'), 'optimizer': optimizer.get('name'),
                'function_evaluations': optimizer.get('function_evaluations'),
                'operational_feasible_shots': optimizer.get('feasible_shots'),
                'initial_optimal_probability': row.get('initial_optimal_probability'),
                'final_optimal_probability': row.get('final_optimal_probability'),
                'resource_scope': 'Aer compiled operations; no physical topology routing',
                'circuit_operations': None}
    warm = read_json(WARM)
    selected = []
    for index, r in enumerate(warm['runs']):
        if r['penalty'] == 248 and r['variant'] in ('tuned_standard_more_compute', 'tuned_warm_more_compute'):
            selected.append(dict(solver='warm' if r['config']['warm_start'] else 'standard', seed=r['config']['seed'],
                optimal_shot_rate=r['optimal_shot_rate'], feasible_shot_rate=r['feasible_shot_rate'],
                runtime_seconds=r['wall_seconds_including_preparation'], shots=r['config']['shots'],
                objective=r['best_feasible_objective'], config=r['config'], source=dict(path=WARM, run_index=index)))
    standard = statistics.mean(r['optimal_shot_rate'] for r in selected if r['solver'] == 'standard')
    warmed = statistics.mean(r['optimal_shot_rate'] for r in selected if r['solver'] == 'warm')
    warm_start = dict(conditions=dict(scenario='demo_normal', synthetic=True, banks=1, hospitals=1, qubits=10,
        penalty=248, p=2, restarts=3, max_iterations=80, shots_per_run=512, optimizer='COBYLA',
        warm_epsilon=0.1, backend='qiskit_aer.AerSimulator', seed_objective=25.2,
        reference_objective=25.2, versions=warm['versions'],
        interpretation='Three paired seeds on one synthetic instance; LP seed already optimal. Sampling density is not computational advantage.'),
        observations=selected, standard_mean=standard, warm_mean=warmed,
        difference_pp=100*(warmed-standard), ratio=warmed/standard)
    scaling=[]
    for line, raw in enumerate(read(SCALING).splitlines(), 1):
        r=json.loads(raw); s=r['scenario']; metrics=r.get('metrics') or {}; resources=r.get('resources') or {}
        scaling.append(dict(**scenario_summary(s,'scaling',r.get('reduced_qubits')), seed=r.get('seed'),
            solver=r.get('method'), status=r['status'], reason=r.get('reason'),
            full_qubits=r['full_qubits'], reduced_qubits=r['reduced_qubits'],
            estimated_full_statevector_bytes=r['full_statevector_bytes_complex128'],
            estimated_reduced_statevector_bytes=r['reduced_statevector_bytes_complex128'],
            lp_seconds=r.get('lp_seconds'), milp_seconds=r.get('milp_seconds'),
            lp_integral=r.get('lp_integral'), runtime_seconds=(r['preprocessing_seconds']+r['optimization_seconds']) if 'optimization_seconds' in r else None,
            runtime_scope='encoding preprocessing + optimization; excludes circuit synthesis',
            strict_feasible_probability=metrics.get('p_feasible'), absolute_gap=metrics.get('conditional_feasible_absolute_gap'),
            resources=resources or None, backend='ideal statevector / NumPy multinomial', source=dict(path=SCALING,line=line)))
    # Preserve actual basis-decomposition measurements as a separate experiment, not the live circuit.
    resources=[]
    for path in sorted((root/'research/quantum_experiments/results/study').glob('*_case.json')):
        relative=str(path.relative_to(root)); case=read_json(relative)
        for solver, resource in case.get('resources',{}).items():
            resources.append(dict(scenario=case['scenario']['id'],solver=solver,**resource,source=dict(path=relative)))
    return dict(schema_version=1,sources=[dict(path=p,sha256=h) for p,h in sorted(sources.items())],
        methodology=dict(primary_source=RUNS,default_family='primary',
            uncertainty='Across-seed intervals describe optimizer variability on fixed synthetic cases, not clinical effectiveness. Pair by family, scenario and seed. Small n must remain visible.',
            feasibility='Returned-solution feasibility and operational feasible-shot rate differ from strict encoded equality feasibility. The latter is an exact statevector probability, not a sampled rate.',
            runtime='Recorded full-review wall_seconds includes QUBO construction and solver pipeline, excludes independent analysis. Classical rows are actual repeated calls; no duplicated pseudo-observations.',
            gaps='Objective differences are defined only for feasible solutions with an exact reference. Raw arithmetic differences are retained in raw_absolute_gap and raw_relative_gap. Display gaps with absolute difference <= 1e-9 objective units normalize to zero for numerical tolerance. Relative gap is a fraction; zero reference with a nonzero normalized gap is undefined.',
            resources='Aer operation counts are not native-device gate counts. Basis-resource fixtures are all-to-all and unrouted. Peak RSS is measured process high-water memory; scaling byte estimates are analytical statevector storage.',
            hardware='No physical QPU execution evidence. Training uses exact statevectors; sample counts are simulator measurements.',
            missing='Unavailable and skipped measurements remain null. No extrapolated observations.',
            confidence='Historical warm comparison has three paired seeds. Show individual observations; a smooth distribution is descriptive, not additional samples.'),
        scenarios=list(scenarios.values()),observations=observations,warm_start=warm_start,
        execution_examples=list(examples.values()),scaling=scaling,basis_resources=resources)


def main():
    payload=json.dumps(build(), separators=(',', ':'), allow_nan=False)+'\n'
    if len(payload.encode()) > 2_000_000:
        raise ValueError('Evidence exceeds 2 MB budget')
    OUTPUT.write_text(payload)
    print(f'Wrote {OUTPUT}: {len(payload.encode()):,} bytes')

if __name__ == '__main__':
    main()
