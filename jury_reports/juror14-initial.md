# Juror 14 — independent initial ballot: Quantum Literature Reviewer

Sealed initial assessment, 25 October 2026. Repository `/Users/shreeshaks/Documents/BloodFlow-Q-main 3`; verified HEAD `46693f6`, branch `evenmore-fix-and-heartbeat-additon`. No other jury report or existing audit conclusion was read. Inspection was limited to source, tests, configuration, raw result records, and independently retrieved primary literature. Tests were inspected, not executed; no hardware or UI exercise was performed. Only this report was written.

**Overall: 66/100.** A credible, unusually candid small quantum optimization research prototype with stronger classical grounding than quantum necessity. I would support it as an educational/research demonstration, not accept an advantage claim or endorse operational clinical deployment. Confidence: high on inspected quantum mechanisms and literature applicability; medium on experiments; low-to-medium on the broad product categories outside my remit.

| Category | Points | Reason |
|---|---:|---|
| Problem | 6/7 | Clear shortage/allocation objective with urgency, transport and compatibility constraints. |
| User | 5/8 | Operational scenarios exist; real operator validation was not established by inspected evidence. |
| Domain | 5/8 | Explicit simplified ABO red-cell scope; no complete transfusion/inventory lifecycle model. |
| UX | 4/6 | QuantumLab source exposes saved measurements, seed selection and JSON export; not browser-tested. |
| Architecture | 5/6 | Model, solvers, decoder, API and research controls are separable. |
| Testing | 7/9 | Structural unitary and feasibility-leakage tests are substantive; no fresh execution in this review. |
| Data | 5/8 | Synthetic labels and source hashes support reproducibility; realism remains limited. |
| Classical | 8/10 | Exact, MILP, LP and feasible local search controls are present. |
| QuantumCorrect | 8/10 | Genuine circuit/statevector/sampling pipeline with honest limitations; no scalable feasible mixer demonstrated. |
| QuantumContribution | 3/8 | Known methods applied carefully; classical-seed attribution and necessity remain unresolved. |
| Experiments | 4/7 | Paired seeds and raw audits are valuable; headline paired cases have zero or one shipment variable. |
| Performance | 2/4 | Dense simulation cap is explicit; operational scaling not demonstrated. |
| Security | 2/4 | Exact production origins, HTTPS checks and sanitized errors; source explicitly says prototype lacks cookie/session authentication. |
| Adoption | 1/3 | No inspected deployment/user adoption evidence. |
| Pitch | 1/2 | Research story is defensible; stronger quantum claims would exceed evidence. |

## Three strongest points

1. **Quantum semantics are inspectable and guarded.** `quantum/qaoa_solver.py:321-349` constructs RZ/RZZ cost phases and X, biased warm, or RXX/RYY mixers. `tests/test_xy_credibility.py` compares the two-qubit exchange operator against its matrix exponential, verifies Hamming-weight preservation, and deliberately demonstrates allocation-feasibility leakage. This is substantially stronger than merely calling a library QAOA wrapper.
2. **Classical and seed provenance are real.** `optimization/milp.py:104-170` implements the original shipment/unmet linear objective and inventory/demand constraints using HiGHS through SciPy. `quantum/qaoa_solver.py:169-229` uses LP relaxation with validated greedy fallback, explicitly avoiding an optimal MILP fallback. `research/quantum_experiments/classical.py` supplies exact/MILP/LP/greedy and budgeted feasible search. These controls make falsification possible.
3. **Failures remain observable.** `experiments/run_warm_qaoa_comparison.py:_candidate_audit` decodes and validates every measured string. The raw `experiments/results/warm-review-20261024.json` contains 120 runs; its first normal-reference standard run records 17 feasible of 64 shots, despite finding an optimal sample. That distinction prevents best-of-shots success from disguising distribution quality. Paired summaries bootstrap per-seed differences rather than treating shots as independent training runs.

## Three most consequential weaknesses

1. **A large binary state space does not establish a hard allocation problem.** `experiments/configurations/warm-review-20261024.json:scenario_sizes` has six cases, all one bank/one hospital/one blood group, with zero or one allocation variable, yet 6–13 qubits. Exact enumeration visits only 1–13 allocation candidates. These are useful encoding sanity checks, not evidence of useful quantum search. The matrix in `optimization/milp.py` is a bipartite shipment/incidence structure with unmet variables; this strongly motivates a network-flow/integrality proof and a specialized classical baseline before arguing necessity. That structural observation is my inference from code, not a claim borrowed from a project report.
2. **The XY mixer preserves the wrong invariant for full feasibility.** `_compute_xy_pairs` links bits of unequal register weight and completes a global ring (`quantum/qaoa_solver.py:259-293`). Hamming weight preservation does not preserve weighted shipment quantities, inventory or demand equalities. The test suite explicitly characterizes leakage. Uniform or product-biased starts also distribute mass across weight sectors whose total masses XY cannot change. Calling this excitation-preserving is correct; calling it an allocation-feasible mixer would be incorrect.
3. **Ideal training and classical preprocessing limit attribution.** `quantum/qaoa_solver.py:395-399` optimizes exact statevector expectations, with finite shots only for final sampling. `research/quantum_experiments/encodings.py:full_encoding/reduced_encoding` enumerates all bitstrings and computes feasibility/objective tables. `run_study.py:69` labels its perturbation readout-only noise. These are legitimate small-model experiments, but neither shot-limited training, general device noise nor efficient oracle/state preparation follows from them. A win over unseeded QAOA can come from classical relaxation, and retained-zero-angle controls can preserve classical information without establishing quantum improvement.

## Ranked primary literature, with applicability and limits

Ranked by immediate value for this repository, not by historical importance. Bibliographic metadata and stated results below were checked against primary arXiv records, publishers or author institutions. They do not certify the repository's implementation.

### 1. Warm-starting quantum optimization

Daniel J. Egger, Jakub Marecek, Stefan Woerner. **Quantum 5, 479 (2021)**; arXiv:2009.10095; DOI **10.22331/q-2021-06-17-479**. [Primary record](https://arxiv.org/abs/2009.10095).

The paper initializes quantum optimization from classical relaxations and studies associated guarantees; low-depth portfolio experiments and warm recursive MaxCut illustrate benefits. The guarantees depend on the particular relaxation/rounding construction. They are not a generic promise that any LP-bit-marginal state improves allocation or outperforms its classical seed.

**Here:** `_prepare_warm_start` is directly relevant, but interpolating quantity encodings into independent bit marginals loses correlations and clipping changes probabilities. **Experiment:** compare direct LP/greedy decisions, identical initial-state sampling at zero angles, optimized warm circuits, and unseeded circuits with matched total budgets. Separate integral and genuinely fractional LP instances; report improvement over the seed, not merely over uniform QAOA.

### 2. From the Quantum Approximate Optimization Algorithm to a Quantum Alternating Operator Ansatz

Stuart Hadfield, Zhihui Wang, Bryan O'Gorman, Eleanor G. Rieffel, Davide Venturelli, Rupak Biswas. **Algorithms 12(2), 34 (2019)**; arXiv:1709.03489; DOI **10.3390/a12020034**. [Primary record](https://arxiv.org/abs/1709.03489).

Generalizes phase/mixer alternation to broader unitary families and gives design criteria and mappings for constrained problems. Feasible-subspace invariance and adequate reachability are properties to establish for the specific encoding and initial state; arbitrary XY exchange does not provide them.

**Here:** directly explains why the tested Hamming-weight invariant is insufficient. **Experiment:** on a tiny one-hot quantity representation, construct only allocation-feasible transitions, enumerate the transition graph to check connectivity, and calculate leakage after every layer. Count extra qubits and compiled two-qubit gates. Keep this distinct from the existing binary-register XY variant.

### 3. Defining and detecting quantum speedup

Troels F. Rønnow, Zhihui Wang, Joshua Job, Sergio Boixo, Sergei V. Isakov, David Wecker, John M. Martinis, Daniel A. Lidar, Matthias Troyer. **Science 345, 420 (2014)**; arXiv:1401.2910; DOI **10.1126/science.1252319**. [Primary record](https://arxiv.org/abs/1401.2910).

Distinguishes speedup questions and benchmarking pitfalls. Its D-Wave random-spin-glass study found no overall speedup and inconclusive subset comparisons. That empirical result is about its benchmark and devices, not a theorem excluding QAOA.

**Here:** ideal simulator runtimes cannot establish quantum-device advantage. **Experiment:** predeclare held-out multi-facility families and success thresholds; compare end-to-end time-to-target against LP/MILP/network flow and tuned local search. Include relaxation, encoding, training, sampling and decoding. Report failures, distributions and confidence intervals, and separate measured wall time from hardware projections.

### 4. Grover Mixers for QAOA: Shifting Complexity from Mixer Design to State Preparation

Andreas Bärtschi, Stephan Eidenbenz. **IEEE International Conference on Quantum Computing and Engineering, QCE 2020, pp. 72–82**; arXiv:2006.00354; DOI **10.1109/QCE49297.2020.00020**. [Primary record](https://arxiv.org/abs/2006.00354).

GM-QAOA uses selective-phase mixing and applies when an equal superposition of feasible solutions can be prepared efficiently. It preserves equal amplitudes for equal-cost solutions and reports improvements over other QAOA approaches for studied problems. Efficient preparation is a crucial assumption, not a consequence of having a feasibility predicate.

**Here:** exhaustive feasible tables offer a small exact reference but do not solve the preparation problem. **Experiment:** compare ideal feasible-uniform/Grover results with explicit compiled preparation and its inverse at 4–10 qubits. Publish preparation gates and classical preprocessing separately. Use a feasible-uniform classical sampler as a control. Abandon scalability claims unless preparation has an efficient construction for this allocation family.

### 5. Parallelizing the dual revised simplex method

Qi Huangfu, J. A. J. Hall. **Mathematical Programming Computation 10, 119–142 (2018)**; arXiv:1503.01889; DOI **10.1007/s12532-017-0130-5**. [Author institution record](https://www.research.ed.ac.uk/en/publications/parallelizing-the-dual-revised-simplex-method/).

Develops PAMI and SIP parallel dual-simplex strategies and evaluates sparse LP performance. It is a classical LP algorithm paper, not a universal MILP complexity guarantee and not a proof about this application's integrality.

**Here:** LP is a serious optimization method in its own right, not merely a cheap warm-start accessory. **Experiment:** compare LP and MILP objectives/integrality over increasing multi-bank/multi-group cases, independently validate rounded allocations, and derive the current constraint matrix's integrality conditions. Use sparse matrices for larger cases; document solver/version/threads. If LP already solves the operational model, research should acknowledge that result.

### 6. Noise-Induced Barren Plateaus in Variational Quantum Algorithms

Samson Wang, Enrico Fontana, M. Cerezo, Kunal Sharma, Akira Sone, Lukasz Cincio, Patrick J. Coles. **Nature Communications 12, 6961 (2021)**; arXiv:2007.14384; DOI **10.1038/s41467-021-27045-6**. [Publisher](https://www.nature.com/articles/s41467-021-27045-6).

Proves exponentially vanishing gradients with qubit count under the local Pauli-noise model when ansatz depth grows linearly with qubit count; discusses alternating-operator ansätze and noisy numerical evidence. It does not prove every shallow noisy QAOA circuit is untrainable.

**Here:** final readout perturbations cannot represent gate/decoherence effects during optimization. **Experiment:** at fixed tiny instances, compare ideal training, finite-shot training and noisy finite-shot training across depth. Add two-qubit depolarizing and readout channels separately; report optimizer variability, total shots, feasible sample probability and success-to-budget curves. Do not extrapolate a 1–3% readout experiment into a device robustness claim.

### 7. A Quantum Approximate Optimization Algorithm

Edward Farhi, Jeffrey Goldstone, Sam Gutmann. **arXiv preprint (2014)**, arXiv:1411.4028; identifier DOI **10.48550/arXiv.1411.4028**. No journal venue asserted. [Primary record](https://arxiv.org/abs/1411.4028).

Introduces QAOA and analyzes regular-graph MaxCut, including a p=1 guarantee of at least 0.6924 of optimum for 3-regular graphs. That guarantee does not transfer to a penalized blood-allocation QUBO, and ideal optimized-depth improvements do not ensure a finite-budget optimizer improves every run.

**Here:** the circuit is a recognizable QAOA implementation. **Experiment:** exhaustive tiny-QUBO checks of Ising energies and phase conventions, then a p=1/2/3 sweep with equal evaluation/shot budgets and independent seeds. Measure raw feasibility, feasible objective and probability of a target solution separately from penalized energy.

## Toughest question and verdict

**Toughest question:** When the original allocation model is a linear bipartite flow problem and the LP seed may already be an optimal integer allocation, what measurable benefit does the quantum stage add after charging its full preparation, training and sampling cost—and what held-out experiment could falsify that benefit?

**Personal verdict:** Keep the honest research framing and the structural tests. The highest-value next step is an integrality/network-flow baseline and seed-only ablation, followed by genuine multi-facility held-out instances. The inspected code justifies studying quantum behavior; it does not establish that blood allocation needs quantum computation, nor any quantum advantage. This ballot is independent and remains provisional for cross-examination.
