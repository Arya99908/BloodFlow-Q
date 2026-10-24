# Quantum research review and implementation decisions

Assessment: 24 October 2026. Target: `somemore-QAOA-fix`, starting at `ebd8f30`. This document separates published algorithms, repository-specific mathematical deductions, proposed controls, and newly measured project outcomes. The latter belong in the experiment report; this literature review does not fabricate a benchmark result.

## Scope, sources, and what was actually read

This is a targeted primary-literature review, not a systematic claim to have found every paper through 2026. The existing [22-paper review](../research/quantum_experiments/LITERATURE_REVIEW.md), its machine-readable matrix and archived original PDFs were inspected first. This pass reread selected methods/results in the local original-paper text for Zhou, Hadfield, Bärtschi–Eidenbenz, Chancellor, Barkoutsos, Kolotouros–Wallden, Rønnow, Willsch, Gacon, and Galda. It independently opened current arXiv records/full HTML for Egger, Tate, He, Bucher, Fuchs, Galda, and Wang, the original Lucas publisher article, and official Aer/OR-Tools documentation. Citation trails from Egger's warm-start discussion to custom mixers/parameter strategies, and from Bucher's related work to He and weighted one-hot states were followed.

Original papers' methods and findings are summarized; their experiments were not independently reproduced here. The live Nature page for He returned an inaccessible identity-provider redirect, so its arXiv v3 full text was used. Zhou's requested arXiv HTML v3 returned 404; the already archived original PDF text was used. Fuchs's arXiv record links a publication DOI, while the earlier matrix lacked verified venue metadata; this review cites the original paper and DOI without inventing fresh publisher access. The 2026 Bucher paper has journal metadata in the arXiv record and accessible v2 full text; the version labels and July revision date are preserved. Web search results were discovery aids, not substitutes for paper methods.

No source establishes quantum advantage for the actual BloodFlow-Q instance family. Quantum methods here run on classical simulators. A successful circuit, an improved sampling probability, and an improved operational allocation are different outcomes.

## The actual problem determines the appropriate literature

Inspection of `optimization/models.py`, `optimization/milp.py`, `optimization/objective.py`, `quantum/qubo.py`, and `quantum/qaoa_solver.py` gives this model:

- Integer shipment quantities connect compatible bank/donor-group supplies to hospital/recipient-group demands on available routes. Supply is shared across destination shipments. Served quantity plus unmet quantity equals demand; used quantity plus slack equals stock.
- The minimized operational objective is linear: priority-weighted high/critical unmet demand, total unmet demand, quantity-proportional route cost and travel time, plus caller-supplied secondary constants. No vehicle sequencing, expiry scheduling, stochastic demand, clinical matching beyond the coded compatibility map, or fixed-dispatch decision is silently modeled.
- The production QUBO uses shortened weighted binary registers for shipment, shortage, and slack quantities. Representation enforces integer/nonnegative register bounds and omits prohibited shipment variables. Inventory and demand equations are penalized, not invariant under the production X, matched product-state, or XY circuits.
- Changing the sign of supply rows makes each shipment column a network incidence column, with shortage/slack unit columns and bounds. Under the current integer-data linear model, an integral LP optimum exists. This is a deduction from the code and network structure, not a theorem imported from a MaxCut paper. A numerical LP still needs validation; fractional convex combinations of tied integral optima are possible.

A relevant classical comparator is a transportation/min-cost-flow or LP solver, not only Greedy. Google's [official minimum-cost-flow formulation](https://developers.google.com/optimization/flow/mincostflow) supplies an implementation reference for supply, demand, arc costs and capacities. It does not prove that every future BloodFlow-Q extension has this structure. Fixed route charges and shared side constraints would require a new argument.

## Selected production improvement and its precise claim

The highest-confidence change is to retain the unoptimized circuit as an optional incumbent during energy-based selection, and separately test a zero-angle first restart. This is an engineering safeguard derived from the variational formulation, not a claim that a paper discovered a universal new QAOA improvement.

Let `a` denote the prepared initial state and `H` the same penalized Ising cost used in optimization. All cost and mixer angles zero produce `a`; define `E0 = <a|H|a>`. If candidates include this circuit and every completed optimized circuit, selecting the minimum of their exactly evaluated expectations gives `E_selected <= E0`, up to stated floating-point tolerance. No assumption about the classical optimizer finding a global optimum is needed. The proof also works for experimental XY when all angles are zero, although an arbitrary nonzero XY mixer need not preserve the prepared product state.

This guarantee is **only about the selected circuit's expected penalized energy**. It does not imply monotonic feasible-shot rate, optimal-shot probability, best finite-shot allocation, clinical utility, or runtime. Mean energy can improve while probability on an optimum falls. If expectations are estimated with shots/noise, the inequality holds for the estimates used to select, not automatically for the unknown true expectations; independent validation/confidence bounds are then necessary.

Implement as explicit configuration while preserving historical defaults. Charge the extra reference expectation and its circuit/simulation time. Record the starting energy, optimized candidate energies, selected source, actual evaluation count and all parameter vectors. The measured histogram must come from the selected circuit, never by inserting a classical allocation into counts. Keep LP and greedy preprocessing provenance and cost visible.

Replacing the first random optimizer start by zero is a different experiment. It preserves the number of restarts but changes the search trajectory, can start at a stationary point, and may help or hurt sampling. An exact identity circuit is useful as an incumbent even when it is an unproductive optimization start. A credible factorial comparison is random starts, random starts plus incumbent, zero first start, and zero first start plus incumbent, using identical instances/seeds and explicit budgets.

## Warm-state and sign conventions

BloodFlow-Q's bounded-register interpolation maps each relaxed integer value to bit marginals of adjacent valid encodings. That preserves the expected register value **before** regularization; tensor-product preparation discards correlations. Its affine map `p = epsilon + (1 - 2 epsilon) * marginal` differs from the endpoint clipping used by Egger. Both regularize integral bits identically, but fractional values differ. Preserve and name this choice instead of claiming a literal reproduction of that paper.

The production matched mixer uses chronological `RY(-theta), RZ(+2 beta), RY(theta)`. Egger writes the opposite `RZ` sign for its Hamiltonian convention. The two variational circuit families are related by `beta -> -beta`; their initialization distributions and optimizer trajectories need not agree under unchanged seeded starts. Do not change the sign silently to improve a historical table. Test prepared-state invariance and declare the sign convention.

## Candidate literature and applicability matrix

Each entry gives the exact source, assumptions and evidence, then a repository-specific decision. The latter is our assessment, not a result claimed by the authors.

### 1. A Quantum Approximate Optimization Algorithm

Farhi, Edward; Goldstone, Jeffrey; Gutmann, Sam. First preprint 2014; Publication venue not independently verified; cited as arXiv preprint. [Original paper](https://arxiv.org/pdf/1411.4028).

**Decision: Retain standard baseline.** Diagonal objective with alternating cost and X evolutions; theoretical QAOA framework. Increasing depth concerns the best attainable variational value, not guaranteed output of a finite-budget local optimizer. BloodFlow-Q can use the same structure, but its dense penalty encoding and linear-flow baseline change the computational question. Cost: statevector memory grows exponentially here. Failure: optimizer failure, finite-shot misses, and infeasible samples must remain distinct.

### 2. Warm-starting quantum optimization

Egger, Daniel J.; Marecek, Jakub; Woerner, Stefan. First preprint 2020; Quantum 5, 479 (2021). [Original paper](https://arxiv.org/pdf/2009.10095); [DOI](https://doi.org/10.22331/q-2021-06-17-479).

**Decision: Retain and audit LP warm-state/matched mixer; test incumbent safeguard.** Relaxation-derived product states and matching rotated mixers are studied with numerical portfolio and rounded MaxCut examples. Assumptions include appropriate continuous probabilities and regularization to avoid frozen endpoints. The MaxCut rounding guarantees do not transfer to the complete bounded-integer allocation model. Benefit: bias toward a good classical solution; cost: solving the relaxation and preparing rotations. Failure: correlation loss, already-optimal LP seeds, epsilon sensitivity, and mismatch between mean energy and optimum sampling.

### 3. From the Quantum Approximate Optimization Algorithm to a Quantum Alternating Operator Ansatz

Hadfield, Stuart; Wang, Zhihui; O'Gorman, Bryan; Rieffel, Eleanor G.; Venturelli, Davide; Biswas, Rupak. First preprint 2017; Algorithms 12.2 (2019): 34. (Special issue "Quantum Optimization Theory, Algorithms, and Applications"). [Original paper](https://arxiv.org/pdf/1709.03489); [DOI](https://doi.org/10.3390/a12020034).

**Decision: Require invariance and connectivity before a new feasibility claim.** Constructive alternating-operator framework replaces the universal mixer with feasible transitions. A feasible initial state, invariant feasible span and useful reachability are separate requirements. Its mappings support constrained optimization but do not give a ready-made coupled blood-flow mixer. Benefit: avoid infeasible states when assumptions hold. Cost: encoding, controlled transitions and connectivity proof. Failure: preserving one constraint while breaking another; an isolated feasible component can prevent reaching the optimum.

### 4. Constrained mixers for the quantum approximate optimization algorithm

Fuchs, Franz G.; Lye, Kjetil Olsen; Nilsen, Halvor Møll; Stasik, Alexander J.; Sartor, Giorgio. First preprint 2022; Algorithms 15(6), 202 (2022); DOI identified by original arXiv record; publisher full text not rechecked in this pass. [Original paper](https://arxiv.org/pdf/2203.06095); [DOI](https://doi.org/10.3390/a15060202).

**Decision: Retain structural tests; defer general feasible flow mixer.** Hermitian transition matrices and their decompositions provide a framework for feasible-subspace mixers, including generalized XY. Theory and examples connect invariance, reachability and gate costs; Trotter decomposition requires care. BloodFlow-Q should test every tiny feasible basis state, not just a single favorable state. Benefit: precise guarantees when the transition graph is valid. Cost: constructing/checking it may itself enumerate solutions. Failure: overlapping gates, incorrect partitions, disconnected sectors or exponential preparation.

### 5. Grover Mixers for QAOA: Shifting Complexity from Mixer Design to State Preparation

Bärtschi, Andreas; Eidenbenz, Stephan. First preprint 2020; IEEE International Conference on Quantum Computing and Engineering, QCE'20, 72-82, 2020. [Original paper](https://arxiv.org/pdf/2006.00354); [DOI](https://doi.org/10.1109/QCE49297.2020.00020).

**Decision: Keep existing feasible-Grover implementation as a bounded research prototype.** The mixer reflects/phases around an efficiently preparable equal superposition of feasible assignments. Theory and problem-specific constructions establish ideal feasible support. BloodFlow-Q currently enumerates that support, so its state preparation already pays exponential work. Benefit: exact ideal feasibility and a useful structural control. Cost: full feasible enumeration, generic state preparation and synthesis. Failure: mistaking a dense simulator projection for a scalable oracle; hardware noise breaks the ideal invariant.

### 6. Domain wall encoding of discrete variables for quantum annealing and QAOA

Chancellor, Nicholas. First preprint 2019; Quantum Sci. Technol. 4 045004 (2019). [Original paper](https://arxiv.org/pdf/1903.05068); [DOI](https://doi.org/10.1088/2058-9565/ab33c2).

**Decision: Defer domain-wall/one-hot production rewrite.** Domain-wall encoding represents discrete choices using an Ising chain and supplies logical-subspace-preserving mixers; encoding/embedding experiments compare tradeoffs with one-hot. It can reduce some couplings but increases qubits relative to compact binary quantities. Keeping each quantity register valid does not conserve shared bank inventory or hospital demand. Benefit: more local logical transitions. Cost: many extra qubits and redesigned constraints. Failure: claiming local register validity as full allocation feasibility.

### 7. Quantum Approximate Optimization Algorithm: Performance, Mechanism, and Implementation on Near-Term Devices

Zhou, Leo; Wang, Sheng-Tao; Choi, Soonwon; Pichler, Hannes; Lukin, Mikhail D.. First preprint 2018; Phys. Rev. X 10, 021067 (2020). [Original paper](https://arxiv.org/pdf/1812.01041); [DOI](https://doi.org/10.1103/PhysRevX.10.021067).

**Decision: Test interpolation/parameter strategies as charged ablations.** MaxCut simulations identify smooth optimized parameter patterns and motivate INTERP and Fourier initialization. INTERP solves shallower depths and interpolates parameters to the next; Fourier uses a lower-dimensional smooth representation. These observations need not hold for BloodFlow-Q penalty spectra. Benefit: better starts or fewer expensive searches. Cost: all preceding-depth optimization and tuning must be charged. Failure: extrapolating graph-specific patterns, comparing total budgets unfairly, or conflating state preparation with parameter initialization.

### 8. Similarity-Based Parameter Transferability in the Quantum Approximate Optimization Algorithm

Galda, Alexey; Gupta, Eesh; Falla, Jose; Liu, Xiaoyuan; Lykov, Danylo; Alexeev, Yuri; Safro, Ilya. First preprint 2023; Publication venue not independently verified; cited as arXiv preprint. [Original paper](https://arxiv.org/pdf/2307.05420).

**Decision: Retain held-out transfer control; no default transfer claim.** The paper studies MaxCut parameter transfer using graph-local structure and degree parity. Its numerical evidence is source/target-class dependent; the accessible record is treated as a preprint. BloodFlow-Q graph topology, penalties and coefficient normalization differ. Benefit: reuse training. Cost: donor selection, training and possible fine-tuning. Failure: training/test leakage, changing normalization without rescaling cost angles, or reporting only target evaluation time.

### 9. Improving Variational Quantum Optimization using CVaR

Barkoutsos, Panagiotis Kl.; Nannicini, Giacomo; Robert, Anton; Tavernelli, Ivano; Woerner, Stefan. First preprint 2019; Quantum 4, 256 (2020). [Original paper](https://arxiv.org/pdf/1907.04769); [DOI](https://doi.org/10.22331/q-2020-04-20-256).

**Decision: Keep CVaR as a separate measured ablation.** Lower-tail CVaR replaces the mean-energy optimization objective for diagonal Hamiltonians. Simulations cover multiple combinatorial families; the hardware portfolio experiment is CVaR-VQE, not proof of hardware BloodFlow-Q QAOA benefit. Benefit: focus on low-energy samples. Cost: tail estimates need enough samples and separate validation. Failure: objective saturation after optimum probability reaches alpha, noisy tiny tails, and incomparable objective values across methods. Reuse the existing research implementation rather than duplicate production classes.

### 10. An evolving objective function for improved variational quantum optimisation

Kolotouros, Ioannis; Wallden, Petros. First preprint 2021; Phys. Rev. Research 4, 023225 (2022). [Original paper](https://arxiv.org/pdf/2105.11766); [DOI](https://doi.org/10.1103/PhysRevResearch.4.023225).

**Decision: Defer ascending-CVaR until a frozen schedule is budgeted.** An evolving CVaR level aims to overcome limitations of a fixed tail objective. The paper reports comparative experiments and also problem-dependent failures. A schedule is a new hyperparameter and changes the training target. Benefit: retain pressure after low-tail saturation. Cost: schedule tuning and extra iterations/shots. Failure: choosing the schedule after seeing held-out outcomes, or assuming published selected-problem gains apply to this linear allocation encoding.

### 11. Simultaneous Perturbation Stochastic Approximation of the Quantum Fisher Information

Gacon, Julien; Zoufal, Christa; Carleo, Giuseppe; Woerner, Stefan. First preprint 2021; Quantum 5, 567 (2021). [Original paper](https://arxiv.org/pdf/2103.09232); [DOI](https://doi.org/10.22331/q-2021-10-20-567).

**Decision: Defer QN-SPSA; consider ordinary stochastic optimizer control for noisy training.** Stochastic approximation estimates quantum Fisher information with a constant number of circuit evaluations per iteration rather than explicitly evaluating every parameter pair. Evidence concerns variational ground-state preparation and learning, not allocation supremacy. Benefit: handle noisy high-dimensional objectives. Cost: fidelity evaluations, calibration, sampling and stochastic variance. Failure: evaluating iterations instead of actual circuits/shots, or using ideal exact expectations to justify noisy-hardware optimizer superiority.

### 12. Benchmarking the Quantum Approximate Optimization Algorithm

Willsch, Madita; Willsch, Dennis; Jin, Fengping; De Raedt, Hans; Michielsen, Kristel. First preprint 2019; Quantum Inf. Process. 19, 197 (2020). [Original paper](https://arxiv.org/pdf/1907.02359); [DOI](https://doi.org/10.1007/s11128-020-02692-8).

**Decision: Use energy and success probability as separate outcomes.** QAOA benchmarking on small SAT/MaxCut problems compares energy-based metrics and optimum probability using simulations and devices. Outcomes depend strongly on the instance. BloodFlow-Q should similarly retain raw counts, exact references and infeasible shots, but its LP comparator is additionally essential. Benefit: detects misleading single-metric success. Cost: exact references on bounded cases. Failure: calling a finite-shot best candidate a certificate or equating feasibility with fraction of demand satisfied.

### 13. Defining and detecting quantum speedup

Rønnow, Troels F.; Wang, Zhihui; Job, Joshua; Boixo, Sergio; Isakov, Sergei V.; Wecker, David; Martinis, John M.; Lidar, Daniel A.; Troyer, Matthias. First preprint 2014; Science 345, 420 (2014). [Original paper](https://arxiv.org/pdf/1401.2910); [DOI](https://doi.org/10.1126/science.1252319).

**Decision: Adopt fair end-to-end benchmark accounting.** The work defines different speedup claims and studies pitfalls in annealing comparisons, including solver tuning, hardware resources and programming overhead. Its device-specific experiments do not prove a QAOA result. BloodFlow-Q should compare identical instances against strong LP/MILP, charge preprocessing and all training, and report distributions and failures. Benefit: falsifiable claims. Cost: additional controls and repeated runs. Failure: labeling classical simulator speed as hypothetical QPU speedup or selecting only favorable seeds/sizes.

### 14. Quantum Local Search with the Quantum Alternating Operator Ansatz

Tomesh, Teague; Saleem, Zain H.; Suchara, Martin. First preprint 2021; Quantum 6, 781 (2022). [Original paper](https://arxiv.org/pdf/2107.04109); [DOI](https://doi.org/10.22331/q-2022-08-22-781).

**Decision: Keep hybrid replacement controls; defer production quantum local search.** Quantum local search combines a classical neighborhood framework with an alternating-operator subroutine. Any applicability depends on neighborhood encoding, feasible initial state and implementable moves. BloodFlow-Q already has bounded research controls that can replace the quantum subsolver with classical methods. Benefit: isolate a small quantum role. Cost: neighborhood construction, oracle work and repeated calls. Failure: crediting improvements from the classical wrapper to quantum sampling, or omitting an exact table-minimum comparator when enumeration already reveals all costs.

### 15. Grover Adaptive Search for Constrained Polynomial Binary Optimization

Gilliam, Austin; Woerner, Stefan; Gonciulea, Constantin. First preprint 2019; Quantum 5, 428 (2021). [Original paper](https://arxiv.org/pdf/1912.04088); [DOI](https://doi.org/10.22331/q-2021-04-08-428).

**Decision: Defer scalable GAS; retain honest tiny oracle mechanism check.** Grover adaptive search uses coherent polynomial objective/constraint evaluation and threshold updates. Query-model improvements are relative to the specified search model, not automatically to strong MILP. Benefit: nonvariational threshold search. Cost: reversible arithmetic, ancillas, uncomputation, oracle synthesis and unknown success probability. Failure: claiming advantage after building a complete classical cost table, ignoring overshoot, or selecting iterations using the known optimum.

### 16. Warm-Started QAOA with Custom Mixers Provably Converges and Computationally Beats Goemans-Williamson's Max-Cut at Low Circuit Depths

Reuben Tate; Jai Moondra; Bryan Gard; Greg Mohler; Swati Gupta. Quantum 7, 1121 (2023). [DOI](https://doi.org/10.22331/q-2023-09-26-1121); [original v4 full text](https://arxiv.org/html/2112.11354v4).

**Decision: retain aligned product mixer, reject transferred approximation guarantees.** Custom mixers matched to separable initial states support convergence analysis and numerical MaxCut comparisons; SDP projections provide problem-specific warm states. Theory in the adiabatic limit does not guarantee finite-budget optimizer success. Benefit: shows why changing only the state can be insufficient. Cost: relaxation and custom preparation. Failure: importing MaxCut factors into a minimization flow model or confusing low-depth quality with total runtime. This supports explicit initial-state and mixer tests, not a claim that the current warm+XY option is the paper's algorithm.

### 17. Alignment between Initial State and Mixer Improves QAOA Performance for Constrained Optimization

Zichang He; Ruslan Shaydulin; Shouvanik Chakrabarti; Dylan Herman; Changhao Li; Yue Sun; Marco Pistoia. npj Quantum Information (2023). [DOI](https://doi.org/10.1038/s41534-023-00787-5); [original v3 full text](https://arxiv.org/html/2305.03857v3).

**Decision: require alignment evidence; keep arbitrary warm+XY experimental.** The paper studies cardinality-constrained portfolio instances, comparing initial states with exact and Trotterized mixers, and includes a trapped-ion experiment. Its numerical results favor alignment with the mixer ground state. Benefit: directly motivates testing prepared-state invariance. Cost: preparing the correct mixer eigenstate may be nontrivial. Failure: the production product-biased state spans Hamming sectors, unlike the paper's fixed-cardinality setup. Preserving global Hamming weight cannot enforce BloodFlow-Q's multiple weighted flow equalities.

### 18. Constrained Quantum Optimization via Iterative Warm-Start XY-Mixers

David Bucher; Maximilian Janetschek; Michael Poppel; Jonas Stein; Claudia Linnhoff-Popien; Sebastian Feld. New Journal of Physics 28, 084501 (2026), journal metadata checked in arXiv. [DOI](https://doi.org/10.1088/1367-2630/ae8ea2); [original v2 full text](https://arxiv.org/html/2604.02083v2).

**Decision: defer production adoption; useful future one-hot prototype.** Weighted W states are paired with adapted XY blocks whose ground-state properties hold within the one-excitation subspace; iterative sample-derived bias updates form the hybrid method. Max-k-Cut/TSP simulations and hardware-tailored experiments are reported, with classical repair explicitly present in the hardware pipeline. The construction assumes suitable one-hot groups; the paper explicitly excludes direct enforcement of constraints sharing binary variables. Benefit: aligned biased exploration within each valid group. Cost: changed encoding, probability updates, extra samples and mixer gates. Failure: relabeling existing warm+XY as this algorithm, or hiding repair in raw counts. Independent unit-flow choices would still share bank capacities, so merely one-hot-encoding each shipment quantity is insufficient.

### 19. Ising formulations of many NP problems

Andrew Lucas. Frontiers in Physics 2, 5 (2014). [Original publisher article and DOI](https://doi.org/10.3389/fphy.2014.00005); [arXiv record](https://arxiv.org/abs/1302.5843).

**Decision: retain proved penalty bounds and audit scale separately.** The work collects explicit Ising reductions with ancillary encodings and relative energy scales. It illustrates why a valid ground-state reduction requires penalty dominance. Benefit: precise separation of feasibility and optimization costs. Cost: more bits/couplings and potentially difficult coefficient ranges. Failure: calling every encoded task NP-hard; this particular linear-flow subset remains classically structured. A sufficiently large penalty protects a global minimum, not every QAOA sample. Positive uniform Hamiltonian scaling preserves energy order but changes the parameter landscape under fixed initialization.

### 20. Noise-Induced Barren Plateaus in Variational Quantum Algorithms

Samson Wang; Enrico Fontana; M. Cerezo; Kunal Sharma; Akira Sone; Lukasz Cincio; Patrick J. Coles. Nature Communications 12, 6961 (2021). [DOI](https://doi.org/10.1038/s41467-021-27045-6); [original v4 full text](https://arxiv.org/html/2007.14384v4).

**Decision: require finite-shot/noisy controls and actual compiled resources.** Under specified local noise and depth scaling, the work proves suppressed gradients and supplies numerical QAOA evidence. It does not say every shallow circuit fails. Benefit: motivates restrained depth and hardware-aware compilation. Cost: noise-model calibration, additional shots, and routing/compilation. Failure: assuming ideal feasible-subspace invariance survives physical errors, or reporting logical QAOA layer count as physical device depth. Homogeneous depolarizing noise is a sensitivity experiment, not a forecast for an unspecified machine.

### 21. On the Instance Dependence of Parameter Initialization for the Quantum Approximate Optimization Algorithm: Insights via Instance Space Analysis

Vivek Katial; Kate Smith-Miles; Charles Hill; Lloyd Hollenberg. Published online 2024; INFORMS Journal on Computing 37(1), 146–171. [Publisher record](https://doi.org/10.1287/ijoc.2024.0564); [authors' associated code](https://github.com/INFORMSJoC/2024.0564).

**Decision: use instance-disjoint transfer validation; do not import a classifier.** The accessible publisher abstract/metadata describes varied MaxCut graph classes, weighted distributions and instance-based initialization. Full article methods were not inspected in this pass, so this is a screened follow-up, not a reproduced implementation recipe. Benefit: cautions against universal parameter concentration. Cost: donor selection/model training and transfer validation. Failure: optimizing initialization choices on evaluation instances. The existing repo transfer control should remain explicitly scoped to its own frozen donors and held-out synthetic cases.

## Additional screened directions and disposition

The previous review also covers multi-angle QAOA (Herrman et al., 2022), ADAPT-QAOA (Zhu et al., 2022), recursive QAOA/symmetry limits (Bravyi et al., 2020), concentration (Brandão et al., 2018 preprint), annealing decomposition (Bass et al., 2020 preprint), minimum finding (Dürr–Høyer, 1996 preprint), and problem-specific GAS (Hess et al., 2026 preprint). Their exact bibliographies, scope and archived sources remain in the [existing detailed matrix](../research/quantum_experiments/literature/literature_matrix.json). They were screened through that review in this pass, not freshly fully reread. Defer production expansion: more angles/adaptive operators add optimization/gradient costs; annealing lacks a configured backend; recursive fixing risks eliminating the true optimum; dense GAS preparation already computes the answers it encodes. They remain documented research alternatives rather than hidden unimplemented solver choices.

A new search also surfaced Obst, Truger, Barzen and Leymann's *Parameter Transfers for Warm-Started QAOA* (2025), [original conference PDF](https://www.scitepress.org/Papers/2025/135393/135393.pdf). Only its abstract was screened: it combines biased-state warm starts and parameter transfer on random MaxCut graphs. Defer algorithm adoption until its detailed budget, donor-selection and negative-transfer analysis is inspected; no performance claim from it is used here.

## Feasibility-aware alternatives: what would constitute a proof

For a feasible basis set F, an initial vector supported on F, and a diagonal cost operator, a mixer of the form `I + (exp(-i beta)-1)|F><F|` cannot create support outside F. This is the algebraic reason the existing tiny feasible-Grover prototype is valid in ideal arithmetic. It says nothing about efficiently preparing F. A scalable flow mixer would instead need local residual-cycle/path moves that preserve all inventory and demand equations, honor bounds, and connect the intended feasible set (including shortage/slack arcs). That connectivity claim must be proved or exhaustively checked for the declared family. No such scalable construction is asserted by this review.

A product of one-hot registers guarantees one selected value per register. It does not impose coupling among registers, such as two hospitals drawing from one stock. The current weighted binary XY exchanges preserve excitation count, not quantity or conservation. These are mathematical incompatibilities, not defects fixed by increasing shots or tuning beta.

## Reproducible evaluation roadmap

| Priority | Change/control | Required evidence before any improvement claim | Disposition |
|---|---|---|---|
| 1 | Existing standard, LP warm, XY, warm+XY plus exact/LP/MILP/Greedy | Independent decoding/objective checks; raw finite-shot counts; truthful seed/mixer metadata | Baselines retained |
| 1 | Initial-circuit incumbent retention | Compare selected expectation with starting expectation; count extra evaluation/time; report whether selected | Implement configurable safeguard |
| 1 | Zero-angle first restart | Matched total restart budget; distinct optimizer seeds; report losses as well as gains | Implement ablation, preserve old default |
| 1 | Seed-only distribution and deterministic seed | Same epsilon/encoding; charge LP time; distinguish seed objective from noisy sample objective | Mandatory attribution control |
| 2 | Depth, epsilon, shots, optimizer settings | Paired comparisons; frozen configs; all evaluations/shots and wall time; exact small references | Measure bounded matrix |
| 2 | Existing reduced/CVaR/feasible-Grover/transfer prototypes | Charge enumeration/training; test invariants and held-out quality; preserve separate study identity | Retain research controls |
| 2 | Finite-shot and noisy circuit evaluation | Independent final shots; declared noise channels, seed, compiled basis/connectivity | Sensitivity only |
| 3 | Interpolation/instance-informed transfer | All lower-depth/donor costs; disjoint train/test cases; same normalization conventions | Bounded experiment if budget permits; otherwise explicit defer |
| 3 | Weighted-W warm XY / flow-conserving moves | Appropriate new encoding and coupling proof; reachability; hardware-resource estimate | Defer production |
| 3 | ADAPT, multi-angle, QN-SPSA, iterative CVaR | Matched total evaluation/circuit/shot budget and controlled advantage over simpler methods | Defer expansion |

The official [AerSimulator documentation](https://qiskit.github.io/qiskit-aer/stubs/qiskit_aer.AerSimulator.html) distinguishes simulator methods, noise models, shot sampling and backend configuration. The web documentation currently identifies a newer Aer release than the installed historical environment; benchmark records must report the actual installed package version rather than copying documentation version labels. Pin simulator seeds and compilation settings where supported. Unsupported noise/circuit/size combinations must be status rows, not missing observations.

Report each operational objective only for a validated allocation; keep penalized energy separate. For every method retain attempted/completed/failed/skipped counts, wall-time distribution, evaluation counts, final sampling uncertainty, and seed/instance variability. Charge initial/reference evaluations, LP preparation, optimizer calls, construction/transpilation, simulation and decoding. Separate exact-expectation optimization from finite-shot training. An optimizer may exhaust its budget and still sample an optimum; neither fact should erase the other.

Pair identical problem instances and seeds, but do not count multiple seeds as independent problem instances. Freeze primary contrasts before measurements; label post-hoc tuning exploratory. A positive small-sample difference is evidence about the declared matrix only. Exact references and LP/MILP should remain available as operational comparators. Classical table minimum is mandatory whenever quantum preprocessing enumerates an entire neighborhood. A simulator timing comparison is a classical computational measurement, never a measurement of hypothetical hardware speedup.

## Boundaries of this review

The literature justifies the circuit constructions and the tests above; it does not pre-authorize a positive performance statement. The initial-incumbent safeguard has a narrow mathematical guarantee, whereas zero starts, transfer, deeper circuits and alternative objectives require actual paired results. Current allocation structure supplies a strong classical solution. The defensible deliverable is better correctness, provenance, controlled sampling experiments and transparent limits, not quantum necessity by declaration.
