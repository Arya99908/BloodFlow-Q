# BloodFlow Q quantum research plan

This investigation tests whether alternative objectives, encodings, and feasible mixers improve a defined allocation-sampling task, and whether those improvements survive strong classical and preprocessing baselines. Production behavior and historical evidence are immutable. All experiments run locally; no hardware advantage is presumed.

## Audit and source methodology

Inspect optimization/models, objective, constraints, exact, milp, greedy; quantum/qubo, ising, qaoa_solver; backend/services, schemas and demo route; measurement decoder; experiment scripts, saved results, and audit/deep_qaoa_20261023/CREDIBILITY_REPORT.md. Hash sources and historical artifacts before and after. Run 164 legacy tests and re-run the 36-run historical capture. Explicitly investigate warm-seed fallback and requested-versus-effective mixer labels. The research adapter records effective initialization provenance without changing production.

Primary-source literature search spans foundational QAOA, warm starts, CVaR, alternating operators, constrained/Grover/XY mixers, integer encodings, multi-angle/adaptive/recursive variants, parameter transfer, noise-aware optimization, annealing and fair quantum benchmarking. Inspect original methods, equations, baselines, and limitations; retain access logs. A source-derived claim must be separated from our adaptation or hypothesis. Unavailable full texts are labelled.

## Prioritized hypotheses and rejection rules

| ID | Hypothesis and rationale | Competing explanation | Falsification and rejection | Effort/resources |
| --- | --- | --- | --- | --- |
| H1 | Lower-tail CVaR at alpha=0.2 improves optimal sampling versus mean energy with identical circuits/budgets (Barkoutsos et al.). | Tail saturation/local optimization raises score without raising optimum mass; exact probabilities hide shot noise. | Matched seeds and cases, report full distribution; reject general improvement if held-out paired evidence is inconclusive/adverse. Include finite-shot training control. | Low; 2 restarts x 80 evaluations, small statevectors. |
| H2 | Eliminate deterministic unmet/slack variables to reduce qubits while preserving feasible objectives and optima. | Cost is moved to higher-order diagonal oracle synthesis and exhaustive tables. | Exhaustive bijection of feasible allocations/objectives and MILP optimum; compare synthesis counts and table preprocessing with full encoding. Reject scalable efficiency claim if dense exponential oracle dominates. | Moderate; at most 12 reduced qubits for simulation, at most 8 for routine synthesis. |
| H3 | Grover rank-one mixer on uniform feasible shipment states guarantees feasible outputs under ideal gates. | Exhaustive feasible preparation already solves the instance; sampling gains are just feasibility filtering. | Matrix/circuit invariant checks, uniform-feasible baseline, compare enumeration/MILP; independent readout errors test fragility. Reject quantum advantage if preprocessing solves the problem or classical methods dominate. | Moderate; explicitly enumerate <=4096 shipment states. |
| H4 | Shared parameters trained only on historical cases reduce held-out optimizer overhead while retaining useful sampling quality. | Easy instances or train/test overlap explain results. | Separate generated cases; compare transferred zero-evaluation schedule, random zero-evaluation schedule, and per-case optimization. Include training cost both unamortized and disclosed amortization. | Moderate; aggregate training objective, 160 evaluations maximum. |
| H5 | Research metrics can resolve provenance/label ambiguities without changing production. | Flags still report requested rather than executed behavior. | Inject LP and greedy failures, verify uniform fallback; inspect one-qubit XY fallback and warm-X alias. Reject metadata accuracy if actual circuit disagrees. | Low; deterministic tests. |

## Fixed staged design

Training/exploration: seven historical scenarios. Confirmatory-style evaluation: eight generated, saved synthetic scenarios with disjoint identities; generation seed 20261023, replicate optimizer seeds 101..110. Freeze algorithms and defaults before evaluating generated cases. This is a small prospective simulator study, not a clinical or hardware trial.

Primary circuits: standard X, matched warm (epsilon .1), XY, warm+XY, full-QUBO CVaR (.2), shipment-only X, shipment-only CVaR (.2), feasible Grover mean. Controls: uniform full/reduced/feasible distributions, seed-only warm distribution, and transferred/random schedules. Full QUBO simulations capped at 14 qubits; reduced simulations at 12. Explicitly record skips rather than discarding hard instances. Penalty is ceil(1.5 * conservative nonnegative objective bound), at least 1. No objective weights are tuned to favor a method.

Primary matched variational budget: p=2, COBYLA, two restarts, at most 80 function evaluations per restart, 1024 final independent ideal shots. Statevector objective evaluations are noiseless and use zero physical shots. A separate finite-shot CVaR arm uses 256 fresh samples per evaluation, accounted separately. Sampling uses a seeded multinomial of the computed ideal state; Qiskit circuit equivalence and Aer samples validate selected cases. This is not hardware execution. Report iterations as unavailable if COBYLA does not expose them; use evaluation counts.

Estimate: historical reproduction ~30 seconds; primary statevector arithmetic approximately 800-1200 runs x160 evaluations, expected minutes, bounded by per-case qubit caps. Start with structural tests and a one-case pilot. Synthesis is bounded to <=8 reduced qubits for routine records, with analytical/logical resources and explicit uncompiled status for larger ones. No unbounded backend jobs.

Classical comparators: exact enumeration for tiny cases, validated LP/MILP, greedy, and a feasible coordinate/multistart search with comparable candidate-evaluation budgets. Enumeration used to build a candidate oracle is itself timed and reported as an exact classical method. Include preparation, objective table, classical seed, optimization simulation time, metric evaluation, final sampling, synthesis (when measured), and end-to-end wall time. Resource analysis extends to 3x3 and 4x4 facilities and multiple blood groups without simulating beyond caps.

## Metrics and statistics

Report p_optimal_feasible, p_feasible, p_optimal_given_feasible (null if no feasible mass), expected penalized energy, conditional feasible objective/gap, best feasible observed allocation/objective, distribution/histogram, infeasible count, degeneracy, qubits, logical and basis circuit depth/gate counts, evaluations, optimizer status, training and final shots, and timing components. Objective values on invalid assignments are not called valid allocation objectives.

For fixed-circuit ideal IID shots use 1-(1-p)^N and ceil(log(.01)/log(1-p)) for 99% sampling success, with p=0/1 handled explicitly. Do not call that end-to-end time-to-solution; include training/preprocessing costs separately. Conditional/marginal denominators are explicit. Wilson intervals describe shot uncertainty; seed-bootstrap intervals describe optimizer variation. Test three preselected comparisons on per-instance seed means: full CVaR vs standard; reduced X vs standard; feasible Grover vs reduced X. Paired exact sign-permutation tests and Holm correction control this family. Report effect sizes/CIs and all negative findings; no population-wide claim from eight small cases.

## Decision log

- The current model is a linear capacitated bipartite allocation/flow model. Bigger linear instances do not automatically create a hard classical problem. Do not weaken LP/MILP.
- Shipment elimination preserves the original feasible optimization task but makes the phase cost generally higher-order. Dense diagonal tables are prototypes, not efficient quantum oracles.
- Feasible preparation by enumeration is knowingly exponential. It tests mixer mechanics and sampling, not speedup.
- No production defaults or existing outputs will be replaced. No new production dependencies planned.

## Execution amendments and decisions

The planned primary study completed with 992 records and no skipped primary runs. A bounded supplementary threshold-amplitude-amplification experiment was added to test a nonvariational alternative; fixed 1/2/3 iteration comparisons are exploratory and outside the three-contrast confirmatory family. Scaling and gate-noise checks are also exploratory. Statevector caps and uncompiled resource cases remain explicit. Direct production controls were added to quantify floating-point optimizer trajectory sensitivity; circuit equivalence does not imply identical independently optimized parameters. CLI output-path options were added after experiments without changing algorithms or saved raw outputs.
