"""Build the audit report from completed measurements."""
import json,statistics,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'audit/deep_qaoa_20261023'
p=BASE/'verified'
assert (p/'completed.json').exists(), 'Wait for the benchmark to finish'
rows=[json.loads(x) for x in (p/'runs.jsonl').read_text().splitlines()]
assert len(rows)==176
zero=[json.loads(x) for x in (BASE/'zero_start.jsonl').read_text().splitlines()]
assert len(zero)==18
summary=json.loads((p/'summary.json').read_text())
lookup={(a['scenario'],a['variant']):a for a in summary}
scenarios=list(dict.fromkeys(r['scenario'] for r in rows))
refs=[json.loads((p/f'{s}_reference.json').read_text()) for s in scenarios]
reference=json.loads((BASE/'independent_reference.json').read_text())
repro=json.loads((BASE/'reproduction_check.json').read_text())
assert repro['identical_selected_fields']==36
names={'normal_reference':'Normal','inventory_shortage':'Inventory shortage','demand_below_inventory':'Low demand','transport_disruption':'Blocked route','critical_shortage':'Critical shortage','emergency_16':'Emergency demand 16','multi_facility':'Two banks and two hospitals'}
lines=['# Warm QAOA and XY mixer credibility audit','',
'Assessment date: 23 October 2026. Target: `BloodFlow-Q-main 3`. This is an implementation and simulator audit by the coding assistant, not independent certification. The production solver, frontend, historical audit reports, and saved historical results were not changed.','',
'**Verdict:** the implementation runs genuine QAOA circuits on a local simulator, and the earlier warm-start sampling results reproduce exactly. Warm-start with its matching mixer is the strongest of the four tested configurations. The current XY mixer preserves the number of excited qubits, but does not generally preserve the allocation constraints and frequently degrades an already good starting distribution. None of these experiments demonstrates quantum advantage.','',
'## Evidence and experimental design','',
'- All 157 existing tests passed before the audit. The final suite passed 164 tests, including seven new structural characterization tests.',
'- Reproduced all 36 runs from the original warm-start audit. Raw counts, configurations, feasible-shot rates, optimal-shot rates, best feasible objectives, and gaps match for all 36 runs. Wall times were not compared for equality.',
'- Ran 140 matched primary experiments: seven synthetic scenarios, four variants, five paired seeds (7, 11, 19, 23, 31). Every primary run used p=2, two restarts, COBYLA capped at 100 function evaluations per restart, 1,024 final shots, normalized cost, and epsilon=0.1 when warm-started.',
'- Ran 36 additional tuning experiments on the normal, emergency, and multi-facility cases using seeds 7, 11, 19. Each changes one setting: epsilon=0.05, epsilon=0.25, 300 evaluations per restart, or p=3.',
'- Ran 18 exploratory zero-angle restart experiments on those same three cases and three seeds, for warm and warm+XY. These were motivated by the initial benchmark and are not an independent held-out confirmation.',
'- Total: 230 solver runs including the historical reproduction; 194 new main and intervention runs. Structural unit tests perform additional small solver calls.',
'- Exhaustively checked all 18,368 binary assignments across the seven scenarios, ranging from 6 to 13 qubits. QUBO ground states are feasible and match Exact. Ising energies match QUBO energies. A separate verifier checks decoded allocations through the allocation-domain validator and recomputes feasible objectives through the classical objective function. Inventory slack equalities are checked separately.',
'- Feasibility here means both inventory/slack and served/unmet equations hold; it is not the fraction of hospital demand satisfied.',
'- Final probabilities below are calculated from the optimized statevector, avoiding finite-shot fluctuations. Raw Aer counts and sampled rates are retained separately. Five optimizer seeds on seven hand-selected, single-blood-group scenarios do not establish population-level performance.',
'- Timings are diagnostic only. Some supplementary checks and experiments overlapped on the same machine, so these are not isolated runtime or speedup benchmarks. No hardware noise, device execution, large-instance scaling, or clinical validation was tested.','',
'## Primary results','',
'Each cell is mean probability of sampling any exact-optimal feasible bitstring, across five optimizer seeds. Warm means the matched warm-start mixer, not ordinary X rotations.','',
'| Scenario | Qubits | Standard X | Warm | XY | Warm plus XY |',
'| --- | ---: | ---: | ---: | ---: | ---: |']
for s,ref in zip(scenarios,refs):
 vals=[f"{100*lookup[s,v]['mean_optimal_probability']:.2f}%" for v in ['standard_x','warm','xy','warm_xy']]
 lines.append(f"| {names[s]} | {ref['qubits']} | "+' | '.join(vals)+' |')
lines+=['','The primary settings intentionally differ from the historical preset (two restarts × 100 evaluations here versus three × 80 there). Their percentages are not directly interchangeable. The historical normal-case preset still gives 54.43% mean optimal shots.','',
'| Method | Runs finding an optimum in 1,024 shots | Runs worse than starting state in optimal probability | Runs worse than starting state in expected energy |',
'| --- | ---: | ---: | ---: |']
for v in ['standard_x','warm','xy','warm_xy']:
 a=[x for x in summary if x['variant']==v]
 lines.append(f"| {v} | {sum(x['best_optimal_runs'] for x in a)}/35 | {sum(x['worse_than_initial_optimal_runs'] for x in a)}/35 | {sum(x['worse_than_initial_energy_runs'] for x in a)}/35 |")
lines+=['','Finding an optimum at least once among many shots is a different metric from probability per shot. The optimizer minimizes mean penalized energy; it does not directly maximize optimal-shot probability. Improvements in one metric do not guarantee improvements in the other.','',
'## Warm start credibility','',
'The bounded-register encoding and affine regularization are implemented consistently with the current audit. Tests verify integer/fractional register expectations and invariance of the prepared state under the matched mixer without cost evolution. Fractional bit marginals form a product state: preserving an expected quantity does not preserve correlations or guarantee a feasible sample.','',
'Every LP seed in these seven cases was integral, feasible, and already globally optimal according to independent Exact enumeration. The deterministic classical seed therefore provides an optimal allocation before QAOA runs. The quantum circuit can increase or decrease the probability of sampling that answer, but cannot improve its objective.','',
'For the normal case, the unoptimized 10-qubit warm state at epsilon=0.1 already samples its unique optimum with probability 0.9^10 = 34.87%. At epsilon=0.05, it starts at 0.95^10 = 59.87%. Higher percentages from lowering epsilon partly reflect retaining more of the classical answer, not additional quantum optimization.','',
'This is consistent with the model structure: each shipment variable enters one supply constraint and one demand constraint. With integer supplies/capacities and linear costs, the current formulation has a transportation/min-cost-flow structure. This structural interpretation, together with the measured optimal LP seeds, makes a strong classical baseline essential. Integral min-cost-flow problems admit integral basic optimal solutions ([MIT network-flow lecture](https://ocw.mit.edu/courses/15-053-optimization-methods-in-management-science-spring-2013/687225c151d8cc8254dcb8b07e5f9ce2_MIT15_053S13_lec16.pdf)). Extensions with additional non-network constraints would need separate analysis.','',
'Warm-start QAOA is an established research approach, but this implementation uses the allocation LP and custom bounded-register encoding, with affine epsilon regularization. It is not a demonstrated reproduction of every assumption or performance guarantee in [Egger, Marecek and Woerner](https://arxiv.org/html/2009.10095v4).','',
'## XY mixer credibility','',
'The two-qubit block RXX(beta) RYY(beta) matches exp[-i beta (XX+YY)/2], verified against an independent matrix exponential. The production ordered sequence over edges preserves Hamming-weight sectors. It should be understood as a product of pair exchanges; overlapping edge generators do not in general commute.','',
'**Hamming-weight preservation is not allocation feasibility preservation.** Exchanging a 1 between binary digits of different weights can change an encoded quantity while keeping the number of 1-bits unchanged. Even exchanging equal-weight bits can violate another supply or demand equation. The global nearest-neighbor ring adds exchanges without a proof that they preserve the feasible allocation subspace. Constraint-preserving XY constructions require an appropriate encoding and mixer design ([Fuchs et al.](https://arxiv.org/abs/2203.06095)).','',
'As a direct test, start the production mixer in a feasible computational-basis state, set the cost angle to zero, and apply beta=0.7. Maximum leakage into invalid QUBO assignments over all feasible starting basis states is:','',
'| Scenario | Maximum infeasible probability after mixer |','| --- | ---: |']
for ref in refs:lines.append(f"| {names[ref['id']]} | {100*ref['max_feasible_state_leakage_beta_0_7'][0]:2.2f}% |")
lines+=['','This is a structural counterexample test, not a measurement of the optimized solver’s typical output. The blocked-route case is special: its feasible state has no excitation exchange available.','',
'XY also freezes the probability mass in each Hamming-weight sector, including during diagonal cost evolution. Consequently, the initial mass in sectors containing optima is an upper bound on eventual optimal probability. The raw records contain that ceiling and numerically verify sector-mass conservation. A uniform or regularized warm product state spans many sectors; it is not a deliberately prepared fixed-feasible-sector state.','',
'## Changes tested for improvement','',
'These tuning results use the same first three seeds for every comparison. Values are mean exact statevector optimal probabilities.','',
'| Scenario | Warm base | Epsilon 0.05 | Epsilon 0.25 | 300 evaluations | Depth 3 | Zero-angle first restart |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for s in ['normal_reference','emergency_16','multi_facility']:
 def mean(v):return statistics.mean(r['final']['optimal_probability'] for r in rows if r['scenario']==s and r['variant']==v and r['seed'] in [7,11,19])
 vals=[mean(v) for v in ['warm','warm_eps_005','warm_eps_025','warm_budget_300','warm_p3']]
 vals.append(statistics.mean(r['optimal_probability'] for r in zero if r['scenario']==s and r['mixer']=='x'))
 lines.append('| '+names[s]+' | '+' | '.join(f'{v*100:.2f}%' for v in vals)+' |')
lines+=['','The zero-angle experiment replaces the first random optimizer start with zero angles at the same evaluation budget; it does not inject a classical answer into measured counts. It can help, but does not universally improve optimal probability.','',
'| Scenario | Warm plus XY base | Warm plus XY with zero-angle first restart |','| --- | ---: | ---: |']
for s in ['normal_reference','emergency_16','multi_facility']:
 a=statistics.mean(r['final']['optimal_probability'] for r in rows if r['scenario']==s and r['variant']=='warm_xy' and r['seed'] in [7,11,19]);b=statistics.mean(r['optimal_probability'] for r in zero if r['scenario']==s and r['mixer']=='xy')
 lines.append(f'| {names[s]} | {a*100:.2f}% | {b*100:.2f}% |')
lines+=['','## Reporting and edge case findings','',
'1. **Warm-start provenance is incomplete.** If both LP and greedy seed preparation fail, initialization becomes uniform, but `warm_start_used` remains true. A characterization test reproduces this. Report requested mode, actual seed source, fallback reason, and seed objective separately.',
'2. **Mixer metadata can mislead.** `warm_start=True, mixer="x"` executes the matched warm mixer while returning `mixer_type="x"`. Expose both requested and effective mixer.',
'3. **Empty XY graphs silently use X rotations.** A valid one-qubit QUBO with `mixer="xy"` has no pairs, falls through to RX, and can change Hamming weight. Reject unsupported XY requests or implement identity mixing for empty graphs, with truthful metadata.',
'4. **The demo UI fixes mixer="x".** It can exercise standard or matched warm mixing, but cannot select XY. The backend schema and direct solver accept XY. This audit tests the solver directly, not a deployed frontend.',
'5. **The older 40% figure remains unidentified.** No literal 40% audit rating was found in the checked local reports. It should not be equated with feasibility, optimal-shot probability, or an overall credibility score.',
'6. **Convergence is separate from best-shot success.** Optimizers may exhaust the evaluation budget while their final finite-shot sample still contains an optimum. Raw messages, success flags, evaluation counts, and every measured count remain available.','',
'## Recommended next changes','',
'1. Fix requested/effective mixer and seed-provenance reporting, plus the empty-XY-graph fallback. These improve audit credibility without claiming an optimization gain.',
'2. Keep the unoptimized warm circuit as a candidate when selecting by expected energy, and include a zero-angle restart. This can prevent expected-energy regression relative to the starting circuit; it does not guarantee monotonic optimal-shot probability. Count its evaluation and expose whether it was selected.',
'3. Evaluate epsilon=0.05 on held-out scenarios and seeds before making it the default. Always show the seed-only distribution beside optimized results. Simply shrinking epsilon toward zero is not evidence of quantum benefit.',
'4. Keep the current XY mixer experimental. If feasibility-preserving mixing is a goal, redesign the encoding and moves to preserve all relevant equations, then verify feasible-subspace invariance and connectivity. Swapping mixer labels or increasing shots will not solve that structural issue.',
'5. For allocation quality in this current linear model, return a validated classical optimum as the operational baseline and present quantum outputs as separately labeled experiments. Do not silently repair samples or mix classical outputs into raw QAOA counts.',
'6. Do not increase an audit percentage by declaration. Update any claim only after defining its metric and linking a fresh reproducible result.','',
'## Reproduction and artifacts','',
'From the project root, use the existing environment `../BloodFlow-Q1/.venv/bin/python`. No packages were installed and no paid services or quantum hardware were used.','',
'```sh\n../BloodFlow-Q1/.venv/bin/python -m unittest discover -s tests\n../BloodFlow-Q1/.venv/bin/python -m experiments.deep_qaoa_audit --output audit/a_new_directory\n```','',
'The benchmark refuses to overwrite its raw run files. The supplementary verifier and zero-start experiment write to fixed paths; use a fresh copy or change those destinations before rerunning.','',
'- `verified/protocol.json`: launch configuration and hashes. Its test-file hash records the initial six-test version; the seventh edge-case test was added during the audit. `manifest.json` records final hashes.',
'- `verified/runs.jsonl`: all 176 primary and tuning runs, including raw counts, complete configurations, starting/final probabilities, optimizer records, sector bounds and timings.',
'- `verified/*_reference.json`: classical baselines, LP seeds, exhaustive reference checks and XY leakage witnesses.',
'- `verified/summary.json` and `verified/summary.csv`: per-scenario aggregates with minima/maxima and convergence counts.',
'- `zero_start.jsonl`: 18 exploratory optimizer-start interventions.',
'- `original_audit_reproduction.json` and `reproduction_check.json`: 36 historical reruns and exact comparisons.',
'- `independent_reference.json`: separate domain-level verification of all assignments and LP optimality.',
'- `full_tests.log` and `structural_tests_final.log`: final test evidence. The tests characterize known limitations rather than marking those limitations as fixed.',
'- The initial benchmark launch failed before collecting a run because the harness assumed GreedyResult had an `objective_value` field. `benchmark.log` preserves that harness error. It was corrected to use `objective_breakdown.total_objective`; all reported results are from `verified/`.',
'',
'Production-source hashes still match the earlier warm-start audit. This checkout has no Git metadata; file hashes provide the recorded source identity.']
(BASE/'CREDIBILITY_REPORT.md').write_text('\n'.join(lines)+'\n')
paths=[p for p in BASE.rglob('*') if p.is_file() and p.name!='manifest.json']
paths += [ROOT/p for p in ['experiments/deep_qaoa_audit.py','experiments/verify_qaoa_reference.py','experiments/check_seed_preserving_start.py','experiments/summarize_deep_qaoa.py','experiments/write_deep_qaoa_report.py','tests/test_xy_credibility.py','quantum/qaoa_solver.py','quantum/qubo.py','quantum/ising.py','optimization/milp.py']]
manifest={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
(BASE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(BASE/'CREDIBILITY_REPORT.md')
