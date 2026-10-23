# BloodFlow-Q quantum improvement report

2026-10-23. **The reduced encoding improves optimal-solution sampling on the tested cases; no tested method improves the classical allocation optimum or demonstrates quantum computational advantage.** Production behavior and historical artifacts were preserved.

## Audit and implementation

The audit inspected the domain models, objective and validators, exact/LP/MILP/greedy solvers, QUBO and Ising mapping, QAOA circuit/optimizer/measurement handling, backend reporting, benchmark scripts and historical evidence. The original 164 tests passed. All 36 historical runs reproduced exactly, including counts and reported metrics; see `results/baseline_verification.json`. The prior audit's 230-run and 18,368-assignment figures remain historical evidence, not new experiment counts.

Three reporting defects matter: uniform fallback after LP and greedy seed failure may still be labeled warm-start; requested X with warm start executes the warm mixer while metadata says X; an empty XY graph can fall back to RX. The isolated research implementation records actual seed provenance and circuit behavior and tests fallback explicitly. These production labels were not silently patched. A future production fix needs a separately reviewed compatibility change.

New code implements a shipment-only higher-order phase encoding, exact and sampled CVaR, a provably feasible-subspace Grover mixer, parameter transfer, and a nonvariational threshold-search control. Independent domain checks and Qiskit circuits validate the accelerated NumPy kernels. Fourteen new tests cover state preparation, full/reduced equivalence, constraints, decoding, objectives, CVaR, fallback, sampling, and noise leakage.

The full-text literature review covers 22 primary papers with links, archived sources, access records, and a twelve-field matrix. Targeted methods/results were inspected; this is not a claim to have reproduced those papers' experiments. See [literature review](LITERATURE_REVIEW.md) and [algorithm comparison](ALGORITHM_COMPARISON.md).

## Controlled design

The primary study contains 992 completed records: 112 training/control runs on seven historical scenarios; 640 runs from eight primary methods on eight frozen synthetic held-out scenarios with ten optimizer seeds each; and 240 held-out transfer, random-schedule, and finite-shot CVaR controls. The common budget is depth 2, two restarts, at most 80 evaluations per restart, epsilon 0.1 where applicable, and 1,024 final shots. CVaR alpha is 0.2. This differs from the previous audit's 100-evaluation configuration; historical percentage tables are not direct treatment comparisons.

Exact distribution optimization uses simulator access, not free physical measurements. The finite-shot control instead draws 256 fresh shots per objective call, averaging 15,504 training shots per run. Final measurements are independent seeded multinomial draws. Circuit-level Aer measurements are reported separately. Final-shot success and underlying ideal probabilities are separate fields.

Thirty-two additional controls ran the unmodified production solver, one seed for every held-out case and existing variant. At identical final parameters, accelerated and Qiskit probabilities agree to maximum absolute error 2.67e-15. Independently optimizing in the two numerical engines changes some COBYLA trajectories: optimal-probability differences average 0.208 percentage points and reach 3.814 points. Thus the primary table compares common-engine implementations of production circuits; it is not a claim of bitwise identity with every new production optimization run. The original 36-run historical reproduction remains exact.

## Held-out findings

These are ideal per-shot probabilities, averaged equally over eight instances and ten seeds per instance. The interval is a descriptive bootstrap over instance means, not a guarantee for a real-world population.

| Method | Optimal and feasible | Any feasible | 95% interval for optimal probability |
|---|---:|---:|---:|
| standard | 6.96% | 23.70% | 1.15–15.19% |
| warm | 68.36% | 68.91% | 61.17–75.93% |
| xy | 3.64% | 10.84% | 0.30–9.57% |
| warm_xy | 36.01% | 40.13% | 22.91–49.48% |
| qubo_cvar | 8.06% | 25.51% | 2.12–15.46% |
| reduced | 32.94% | 84.83% | 9.70–62.68% |
| reduced_cvar | 25.56% | 71.69% | 15.27–37.86% |
| feasible_grover | 46.65% | 100.00% | 29.97–65.87% |
| transfer_only | 16.25% | 64.83% | 5.22–30.01% |
| random_schedule | 13.67% | 56.69% | 3.15–28.12% |
| reduced_cvar_shot | 23.03% | 66.58% | 12.26–36.14% |

Every held-out LP solution was integral, feasible, and exactly optimal; MILP and exhaustive reference calculations agreed. LP solve times were roughly 0.56–0.73 ms; MILP about 0.82–8.78 ms in this local run. These are single-run timings on tiny instances, not stable latency benchmarks. Warm-start's high probability largely preserves information supplied by that solved classical problem.

Three prespecified contrasts use instance-level paired seed differences and an exact two-sided sign-flip permutation test, followed by Holm correction across the three contrasts:

| Contrast | Mean change in optimal probability | Holm-adjusted p | Interpretation |
|---|---:|---:|---|
| QUBO CVaR minus standard | +1.10 percentage points | 0.296875 | Improvement not established |
| Reduced encoding minus standard | +25.98 points | 0.0234375 | Improvement supported within this eight-case design |
| Feasible Grover minus reduced | +13.71 points | 0.21875 | Optimal-probability improvement not established |

The sign-flip test assumes symmetry of instance differences under the null. The cases are heterogeneous synthetic constructions rather than a representative random sample. A positive descriptive bootstrap interval for the third contrast does not override its non-significant prespecified test. All other comparisons are exploratory. There is no multiplicity-adjusted evidence of general superiority over warm-start.

**Experimentally observed:** feasible Grover produces 100% feasible probability in ideal simulation. **Verified:** its ideal invariant-subspace argument and small-instance exhaustive checks support all modeled constraints, not just Hamming weight. **Experimentally observed:** reduced-register sampling beats original standard QAOA under this design. **Unverified:** extrapolation to larger realistic instances or quantum hardware benefit.

## Nonvariational, scaling and noise checks

The supplementary threshold-search experiment stores 240 records (eight cases, three fixed iteration counts, ten measurement seeds). Only three cases have any feasible allocation strictly better than greedy. Across all eight cases, probability of beating greedy rises from 3.91% initially to 25.44% at one iteration and 34.99% at two, then drops to 20.27% at three. This is bounded amplitude amplification with observed overshoot, not an adaptive algorithm that knows the best iteration count. Repeated measurement seeds do not constitute independent circuit optimization replications. The enumerated oracle already reveals the classical answer, so this is a mechanism demonstration, not search advantage.

Scaling adds 36 optimized records over four completed sizes and two explicit skipped sizes. Representative full/reduced qubit counts are 15/9, 20/12, 24/16, and 64/48. The 16- and 48-qubit reduced cases exceed the declared 12-qubit statevector cap. Their classical LP/MILP controls still run. A complex128 statevector alone for 48 qubits requires 4 PiB, before other arrays. Dense phase tables and generic state preparation prevent a scalable interpretation of these prototypes.

Twenty-seven Aer runs test one small inventory-shortage circuit family at three homogeneous depolarizing strengths and three sampling seeds, 2,048 shots each. Feasible Grover uses 13 CX gates versus four for the reduced X circuit in this case. Its observed optimal probability falls from about 95.3% without gate noise to 85.6% with CX error 0.01 and single-qubit sx/x error 0.001; feasibility falls from 100% to about 96.7%. This supports sensitivity to gate noise, not a hardware performance forecast. There is no device calibration, routing, or quantum hardware execution. Separate independent readout-flip sensitivity is saved per primary run.

## Cost and metrics

Mean primary pipeline times excluding representative synthesis were approximately 0.292 s (standard), 0.309 s (warm), 0.081 s (reduced), and 0.081 s (feasible Grover). They include charged table preparation and optimization, but are classical simulation timings and cannot be converted into hardware time-to-solution. Transfer's tiny held-out evaluation time excludes shared training; `transfer_training.json` records that additional work. Representative synthesis is a structural estimate, not actual compilation of every optimized circuit. No speedup claim follows from these numbers.

Each record separates optimal-feasible probability, any-feasible probability, their conditional ratio, penalized expected energy, conditional feasible objective/gap, sampled best feasible allocation, histogram, infeasible count, configurations, optimizer evaluation count, training/final shots, resource estimates, and timing. Optimizer iterations unavailable from the API are null, not invented. Invalid states have no meaningful allocation-objective gap; their penalty energy is reported separately. Degenerate optima are all counted. Reference optima are proven by exhaustive evaluation/MILP on these small cases.

For independent shots p, success by N is 1-(1-p)^N; n99 is the smallest N reaching 99%, with p=0 handled as unattainable. Wilson intervals quantify finite-shot sample uncertainty; seed and instance variation are separate. These independent-sampling expressions are not asserted for correlated hardware samples. More favorable per-shot probability is not end-to-end speedup.

## Decisions and limitations

- **Retain as research prototypes:** shipment-only encoding and feasible-subspace mixer; they answer falsifiable encoding and feasibility questions.
- **Retain as production baseline:** existing behavior unchanged. Classical LP/MILP remains the justified allocation engine for the tested task.
- **Reject under tested conditions:** the claim that XY alone preserves allocation feasibility, and any claim of demonstrated quantum advantage from these experiments.
- **Not supported in this design:** a convincing benefit from fixed-alpha QUBO CVaR; do not confuse absence of evidence with universal failure of CVaR.
- **Investigate next:** scalable cost/state-preparation constructions and realistic residual-flow hybrid tasks, before spending more on shallow-circuit tuning.

All cases are synthetic and small. Ten optimizer seeds do not turn eight cases into 80 independent problem instances. Simulator objectives are idealized. Exhaustive preprocessing solves the small problems it encodes. No clinical efficacy, operational deployment, general asymptotic improvement, or hardware advantage is established. Negative results and explicit skips remain in the machine-readable artifacts.

Reproduction instructions and artifact index are in [README.md](README.md); ranked follow-ups are in [NEXT_RESEARCH_STEPS.md](NEXT_RESEARCH_STEPS.md).
