"""Reproducible compact-demo audit; no classical candidates enter measured results.

Run: python -m experiments.audit_warm_qaoa --output audit/warm_qaoa_results.json
"""
import argparse
import hashlib
import importlib.util
import importlib.metadata
import itertools
import json
import math
import platform
import sys
import time
from pathlib import Path
from dataclasses import asdict
from backend.data_loader import load_data
from backend.scenario_factory import scenario_from_loaded_data
from backend.demo_scenarios import build_demo_case
from optimization.objective import ObjectiveConfig
from optimization.exact import ExactSolver
from optimization.milp import MILPSolver
from quantum.qubo import build_qubo, QUBOPenaltyConfig, compute_conservative_objective_bound
from quantum.qaoa_solver import QAOASolver, QAOAConfig

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    destination = Path(args.output)
    if destination.exists():
        raise FileExistsError('Use a new output path to preserve prior measurements')
    spec = importlib.util.spec_from_file_location('audit_original_qaoa', ROOT / 'audit/warm_qaoa_before/quantum/qaoa_solver.py')
    old = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = old
    spec.loader.exec_module(old)
    scenario, _ = build_demo_case(scenario_from_loaded_data(load_data()), 'normal')
    weights = ObjectiveConfig(10, 5, 1, 0.1, 0)
    bound = compute_conservative_objective_bound(scenario, weights)
    penalty = float(max(1, math.ceil(1.5 * bound)))
    exact = ExactSolver().solve(scenario, weights)
    lp = MILPSolver().solve_relaxation(scenario, weights)
    results = []
    checks = []
    for penalty_value in (10000.0, penalty):
        qubo = build_qubo(scenario, weights, QUBOPenaltyConfig(penalty_value, penalty_value))
        evaluated = [(bits, qubo.evaluate_assignment(bits)) for bits in itertools.product((0, 1), repeat=qubo.variable_count)]
        feasible = [entry.classical_objective for _, entry in evaluated if entry.total_penalty == 0]
        minimum_energy = min(entry.energy for _, entry in evaluated)
        minimizers = [entry for _, entry in evaluated if abs(entry.energy - minimum_energy) < 1e-7]
        assert all(entry.total_penalty == 0 for entry in minimizers)
        assert abs(min(feasible) - exact.objective_value) < 1e-7
        checks.append({'penalty': penalty_value, 'states': len(evaluated), 'qubits': qubo.variable_count,
                       'all_qubo_minimizers_feasible': True, 'exact_objective': exact.objective_value})
        variants = [('original_warm', old.QAOASolver, old.QAOAConfig, {'warm_start': True}),
                    ('encoding_fixed_warm', QAOASolver, QAOAConfig, {'warm_start': True, 'normalize_cost': False}),
                    ('normalized_standard', QAOASolver, QAOAConfig, {'warm_start': False}),
                    ('normalized_warm', QAOASolver, QAOAConfig, {'warm_start': True}),
                    ('tuned_standard_more_compute', QAOASolver, QAOAConfig, {'warm_start': False, 'p': 2, 'restarts': 3}),
                    ('tuned_warm_more_compute', QAOASolver, QAOAConfig, {'warm_start': True, 'p': 2, 'restarts': 3, 'warm_start_epsilon': 0.1})]
        for label, solver_class, config_class, extra in variants:
            for seed in (7, 11, 19):
                config = config_class(**{'p': 1, 'shots': 512, 'max_iterations': 80, 'seed': seed, **extra})
                started = time.perf_counter()
                result = solver_class(config).solve(qubo)
                wall_seconds = time.perf_counter() - started
                feasible_count = optimal_count = 0
                best = None
                for bitstring, count in result.counts.items():
                    entry = qubo.evaluate_assignment(tuple(map(int, bitstring[::-1])))
                    if entry.total_penalty == 0:
                        feasible_count += count
                        best = entry.classical_objective if best is None else min(best, entry.classical_objective)
                        if abs(entry.classical_objective - exact.objective_value) < 1e-7:
                            optimal_count += count
                row = {'variant': label, 'penalty': penalty_value, 'config': asdict(config),
                       'feasible_shot_rate': feasible_count / config.shots,
                       'optimal_shot_rate': optimal_count / config.shots,
                       'best_feasible_objective': best,
                       'absolute_gap': None if best is None else best - exact.objective_value,
                       'wall_seconds_including_preparation': wall_seconds,
                       'optimizer': dict(result.optimizer_information), 'counts': dict(result.counts)}
                results.append(row)
                print(label, penalty_value, seed, 'gap', row['absolute_gap'], 'feasible', row['feasible_shot_rate'], flush=True)
    paths = ['quantum/qaoa_solver.py', 'quantum/qubo.py', 'quantum/ising.py',
             'optimization/milp.py', 'experiments/audit_warm_qaoa.py',
             'audit/warm_qaoa_before/quantum/qaoa_solver.py']
    payload = {'scope': 'Normal compact synthetic demo only; three seeds; no hardware or quantum advantage claim',
               'python': platform.python_version(),
               'versions': {name: importlib.metadata.version(name) for name in ('numpy','scipy','qiskit','qiskit-aer')},
               'source_sha256': {path: hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in paths},
               'scenario': repr(scenario), 'objective_weights': asdict(weights), 'bound': bound,
               'lp_seed': {kind: {str(k): v for k,v in values.items()} for kind, values in lp.items()},
               'exhaustive_checks': checks, 'runs': results}
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('x') as stream:
        json.dump(payload, stream, indent=2, allow_nan=False)

if __name__ == '__main__':
    main()
