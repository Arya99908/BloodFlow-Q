# Juror 13 — sealed independent initial assessment

Role: Quantum Algorithm and QAOA Specialist. Scope: production QUBO/Ising/QAOA, warm-start and XY circuits, API reachability, selected research simulator equivalence, accessible branch changes. Primary checkout 46693f6. No other juror report or pre-existing audit conclusion was read. No application source was changed.

**Provisional score: 70/100. Verdict: technically substantial research prototype / credible contender, not a demonstrated winning quantum optimizer. Confidence: high on inspected circuit behavior and executed tiny cases; medium on whole-product score; low on untested UI usability and full experiment claims.**

Category points in required rubric order: [6,5,5,4,5,7,5,8,8,4,5,2,3,2,1] = 70. Scope-distant categories are provisional source-only assessments, not UI verification. Quantum correctness receives 8/10 for faithful encoding/circuit implementation and real executions, reduced for research/production divergence and limited adversarial coverage. Quantum contribution receives 4/8: real algorithms and thoughtful controls, but no independently established advantage.

## Three strongest findings

1. **Verified: genuine local quantum-circuit simulation, not a renamed classical allocator.** `quantum/qaoa_solver.py:303` builds RZ/RZZ cost layers with RX, rotated-Z warm mixer, or paired RXX/RYY exchange gates; `solve:390` evaluates ideal statevectors, then `:437` samples Aer. API tests execute all four visible variants. Shots are final measurements, not noisy optimizer evaluations. No physical hardware or noise model is used.
2. **Verified for tested cases: QUBO/Ising mapping and warm-start mechanics have meaningful verification.** `quantum/qubo.py:300` imposes shipment+unmet=demand and shipment+slack=inventory; incompatible/blocked variables are omitted. `quantum/ising.py:78` accounts for doubled symmetric off-diagonal entries and Qiskit bit order. `quantum/qaoa_solver.py:167` uses LP relaxation, validated greedy fallback, then explicit uniform fallback; no optimum MILP seed is secretly substituted. Integer/fractional register conversion and state-preserving warm mixer tests pass.
3. **Verified: useful scientific provenance and honest limitations are present.** `quantum/qaoa_solver.py:489` reports optimizer nonconvergence, seed provenance, feasible-shot rate, circuit size and overlapping timing fields; README explicitly disclaims quantum advantage. The finite sampled best is not labeled a global optimum. Feasible-subspace Grover research explicitly constructs an enumerated feasible state (`research/quantum_experiments/algorithms.py:76`), so it must remain an exponentially precomputed research comparator.

## Three principal weaknesses

1. **Verified limitation, P1 if marketed otherwise: production XY preserves Hamming weight, not blood-allocation feasibility.** The graph joins different binary weights and constraint groups (`quantum/qaoa_solver.py:259-292`). Independent statevector reproduction from each feasible basis state of the 3-qubit tiny case, gamma=0/beta=.7, gives **0.6577942211334618 probability outside allocation feasibility**. This is already truthfully characterized by `tests/test_xy_credibility.py:test_feasible_basis_state_leaks_out_of_allocation_constraints`. Do not call this a constraint-preserving allocation mixer. A product state spanning weight sectors cannot become feasible merely through excitation-preserving mixing.
2. **Observed defect P2: research and production disagree for an empty XY graph.** `research/quantum_experiments/algorithms.py:72-73` selects X and claims `empty_graph_uses_x_like_production`; production `quantum/qaoa_solver.py:342-345` performs no mixer for empty pairs. Reproduction: derive tiny_qubo scenario with inventory O=0, keep demand 1, full_encoding, Config('xy',p=1), angles [.3,.7]. Research probabilities [0.77821339,0.22178661], production [0.5,0.5]. Thus the research oracle is not universally equivalent to the actual circuit. Add this boundary to parity tests and make research preserve identity, with corrected provenance. No evidence yet that this edge case appears in published tables.
3. **Unverified benefit: warm or quantum quality/time improvements are not established by my runs.** All four methods sampled the same tiny optimum 1.1. Feasible rates differed but one seed is inadequate. Warm regularization is an affine probability shrink (`quantum/qaoa_solver.py:247`), not simple epsilon clipping; report it as the implemented variant and do not assume literature guarantees transfer. The seed already solves a strong classical relaxation; require LP-only/greedy-only seed, sampling-only and equal-budget classical controls. Research reduced encodings enumerate dense 2^n tables (`encodings.py:58`), and feasible Grover precomputes feasibility, so measured speed is not scalable quantum runtime.

## Executed evidence

Environment: macOS local machine; Python 3.14.7, Qiskit 2.6.0, Aer 0.17.2, borrowed existing interpreter ../BloodFlow-Q1/.venv/bin/python. Default python3 cannot import Qiskit (BLOCKED for default interpreter only); no installation performed.

Command: `PYTHONDONTWRITEBYTECODE=1 ../BloodFlow-Q1/.venv/bin/python -m pytest -q -p no:cacheprovider tests/test_xy_credibility.py tests/test_warm_qaoa_audit.py tests/test_independent_qubo_proof.py tests/test_qaoa_solver.py`

Result: **23 passed, 4 subtests passed in 2.06s**, exit 0. This includes API execution of four variants; does not prove whole application passes.

Additional direct runs: `tests.test_qaoa_solver.tiny_qubo()`, one bank, one hospital, one blood group, stock=demand=1, 3 qubits, p=1, 128 shots, COBYLA max_iterations=15, seed=7, default epsilon=.25, normalization on, one restart. All PASS for returning measured candidate and metadata, all optimizer success flags false due bounded optimization; this is not convergence certification.

| Variant | Best Qiskit bitstring | QUBO energy | Feasible shot rate | Solver wall seconds | Compilation seconds | Final Aer seconds |
|---|---|---:|---:|---:|---:|---:|
| Standard X | 001 | 1.099999999999909 | .8515625 | .089525375 | .057225917 | .001885125 |
| Warm X | 001 | 1.099999999999909 | .9296875 | .071310792 | .050967583 | .000886667 |
| XY | 001 | 1.099999999999909 | .4921875 | .068506583 | .050274458 | .000947167 |
| Warm XY | 001 | 1.099999999999909 | .5546875 | .070195125 | .051647833 | .000789208 |

Warm source was lp_relaxation. Timings are one local sequential run, include simulator overhead, and are not hardware times or comparative performance evidence. Optimizer-inclusive seconds respectively .024623958/.016187708/.016377958/.015863750, with statevector sub-times .007714126/.006907459/.006205375/.006188210; do not add overlapping fields.

Production branch history inspected non-destructively: main/origin/main 50c3b24; origin/quantum-optimizer-fix 0f13187; fixing-warm-QAOA/origin alias 0d66dce; quantum-warm-optimization-fix/origin alias 345a42a; current and somemore-QAOA-fix/origin aliases 46693f6. Read diffs from historical quantum branches to HEAD and selected implementation changes; no old-branch runtime executions. Current quantum changes versus main: 2 files, +407/-50. Historical implementations must not be conflated with current results.

## Challenge and next evidence

Toughest question: **What quantum-produced improvement remains after charging LP seed preparation, exact statevector optimization, sampling and postprocessing, compared with using that classical seed and a matched classical search budget directly?** Current answer: not established by my independent tests.

Cross-examination target (to be assigned after independent reports): challenge any claim that XY guarantees valid allocations, or that research simulator parity holds for every admitted scenario. Request reproducible parity and boundary data. Also ask experimental-design juror whether claimed warm-start improvement survives seed-only and zero-layer ablations.

Independent personal verdict: preserve the real QAOA demonstration and its honest negative results. Showcase transparent feasibility comparisons, not quantum advantage. Fix the research boundary mismatch before claiming exact production/research equivalence. This is stronger as an auditable synthetic optimization laboratory than as a hospital-ready allocator.
