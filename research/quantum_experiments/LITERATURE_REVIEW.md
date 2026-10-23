# BloodFlow-Q: critical primary-literature review

Research date: 2026-10-23. This review distinguishes published evidence from project hypotheses. **None of these papers establishes quantum advantage for BloodFlow-Q.** Twenty-two relevant primary papers are indexed below. Bibliographic metadata was retrieved from original arXiv records; original PDFs and extracted text are archived in `literature/sources/`, with hashes and retrieval failures in the access logs. Full-text methods and results were inspected at the page locations recorded in the matrix; this is targeted full-text reading, not a claim that every appendix proof or experiment was independently reproduced. HTML was unavailable for two papers and incomplete for CVaR, so original PDFs were used. PDF extraction may omit figure/form content; original PDFs remain authoritative.

## Search and selection

Searches covered warm-start QAOA, CVaR and ascending CVaR, alternating-operator and constraint-preserving mixers, Grover mixers, discrete encodings, multi-angle and adaptive QAOA, recursive elimination, parameter concentration/transfer, quantum local search, annealing decomposition, stochastic optimization and rigorous speedup benchmarking. Selection required an identifiable primary contribution and a concrete experimental consequence. Citation trails from warm-start, constrained mixers and CVaR were followed to alternatives and limitations. This is a scoped review, not an exhaustive systematic review through 2026; uninspected subsequent work is not represented as checked. No source supports a blanket claim that LP dual information improves this allocation ansatz.

## Immediate implementation implications

1. **CVaR is a measured-distribution objective change, not a new allocation problem.** For sorted distinct energies e_j and probability masses p_j, let q_j = min(p_j, max(0, alpha - sum_{k<j}p_k)). Define lower-tail CVaR = sum_j q_j e_j / alpha. This handles ties by partial boundary mass and reduces exactly to the mean at alpha=1. It is the project's explicit discrete tail-integral convention; the Barkoutsos paper's empirical expression rounds the selected sample count. Finite-shot training must apply the declared convention consistently. Test alpha=.2 against the same circuit and evaluation/shot budgets. If the optimum already has mass alpha, the objective may have reached its floor while most measurements remain nonoptimal. Ascending CVaR is a future falsifiable response, not an automatic improvement. Sources: [Barkoutsos et al.](https://arxiv.org/abs/1907.04769), [Kolotouros and Wallden](https://arxiv.org/abs/2105.11766).

2. **Feasible Grover mixing has a precise invariant.** Let |F> = |F|^(-1/2) sum_{x in F}|x>, prepared by U_S|0>. Then U_M(beta) = exp(-i beta |F><F|) = I + (exp(-i beta)-1)|F><F| = U_S [I+(exp(-i beta)-1)|0><0|] U_S†. Apply U_S†, the zero-state phase, then U_S chronologically. For any vector supported on F, both the identity term and projection term remain supported on F; a diagonal phase separator preserves that support too. This proves all constraints used to define F in ideal arithmetic, not robustness to readout or gate errors. Every feasible basis state pair has nonzero mixer coupling for beta not a multiple of 2pi. Sources: [Bärtschi and Eidenbenz](https://arxiv.org/abs/2006.00354), [Fuchs et al.](https://arxiv.org/abs/2203.06095).

3. **Enumeration makes the feasible mixer a tiny-instance research instrument.** Preparing a generic list of feasible amplitudes and synthesizing a dense diagonal truth table require data scaling with 2^n in the implemented approach. A simulator array multiplication is not a constant-cost hardware oracle. Report enumeration wall time, memory, state-preparation synthesis and transpiled depth/two-qubit gates. The Grover paper explicitly requires efficient feasible-state preparation for an efficient algorithm. Its permutation-state construction does not provide a polynomial blood-flow state preparer.

4. **Shipment-only encoding is a mathematical redesign to validate independently.** Eliminating deterministic unmet-demand and unused-stock variables can preserve feasible allocation objectives, but a squared hinge over invalid over-allocation is generally not the same QUBO polynomial. It can require high-order diagonal terms or reversible arithmetic. Ordinary binary domains can contain overflow codes. Verify the feasible objective bijection, overflow penalties, ground-state feasibility and degeneracy exhaustively; report changed off-feasible landscape. Domain-wall/one-hot encodings improve some locality tradeoffs but do not enforce coupled flow constraints by themselves. Source: [Chancellor](https://arxiv.org/abs/1903.05068).

5. **The classical problem structure matters more than a quantum percentage.** A single-period linear transportation problem with integral supplies/demands, arc bounds, and shortage arcs admits an integral network-flow formulation: each shipment arc contributes one incoming and one outgoing incidence, and capacities bound those flows. This is a structural mathematical argument to verify against the actual formulation, not a finding of the quantum papers. It fails to establish integrality if extra non-network constraints or nonlinear objectives are added. A fractional LP vertex is therefore not expected merely by increasing the size of the same network model. Use min-cost flow/LP and MILP as strong baselines; do not manufacture NP-hardness by describing all allocation as combinatorial. Quantum methods cannot improve an already proven optimum's objective.

6. **Transfer and hybrid decomposition need controls that expose classical work.** Use disjoint donor/training and test instances, save training cost, freeze transfer choices before test evaluation, and include demand/cost/topology shifts. MaxCut concentration does not imply transfer for a dense shipment oracle. For neighborhood search, hold neighborhood selection and acceptance rules fixed while replacing only the subsolver with quantum, exact/MILP, and strong local-search variants. Sources: [Zhou et al.](https://arxiv.org/abs/1812.01041), [Galda et al.](https://arxiv.org/abs/2307.05420), [Tomesh et al.](https://arxiv.org/abs/2107.04109), [Bass et al.](https://arxiv.org/abs/2001.06079).

## Nonvariational threshold search

[Gilliam, Woerner and Gonciulea](https://arxiv.org/abs/1912.04088) give reversible polynomial value/constraint oracles for Grover adaptive search, while [Dürr and Høyer](https://arxiv.org/abs/quant-ph/9607014) prove minimum-finding bounds in a coherent query model. A fixed 1/2/3-iteration experiment marks feasible E below a prespecified greedy incumbent. It is **bounded threshold amplitude amplification**, not an implementation of full GAS or the minimum-finding theorem. For initial marked mass a, ideal success after r Grover iterations is sin²((2r+1) asin(sqrt(a))). More iterations can overshoot; a=0 must yield zero improvement. Do not choose r using the known optimum or marked count in the benchmark. A dense marking table already evaluates all candidate energies, so any sampling improvement comes after exhaustive classical work and is not end-to-end search advantage.

A directly relevant [2026 primary preprint by Hess et al.](https://arxiv.org/abs/2602.08418) was inspected through its full methods/results. It studies problem-informed GAS, termination and unknown marked counts, but its local TSP neighborhood changes had limited success on the tested cases. The authors use CP-SAT to enumerate better tours and analytic amplitude-amplification probabilities; claims involving over 100 binary encoding variables must not be described as 100-qubit state-vector or hardware experiments. This is useful methodological precedent and a negative result, not evidence that quantum neighborhood search beats strong classical optimization.

## Evaluation and decision rules

Optimal-feasible probability sums probability over **all** feasible globally optimal assignments. Feasibility is a separate denominator; conditional optimum probability is their ratio only when feasibility probability is positive. Report allocation-space degeneracy separately from multiple auxiliary encodings. With independent shots and fixed trained circuit, probability of at least one optimum in N shots is 1-(1-p)^N; repetitions for target t are ceil(log(1-t)/log(1-p)), with p=0 and p=1 handled separately. Optimizer-driven successive evaluations are not repeated independent shots from one stationary distribution. Shots reduce binomial measurement uncertainty, whereas independent training seeds probe optimizer variation; neither substitutes for independent instances.

Confidence intervals and paired seed/instance comparisons should accompany point estimates. Prespecify primary comparisons or adjust exploratory multiplicity. Include circuit construction, classical relaxation, oracle/feasible enumeration, optimization, all training shots and final sampling in end-to-end costs. Simulator timing describes this classical simulation environment only. Strong classical solvers must receive the same available information. Negative and shifted-distribution results must remain in the record. [Rønnow et al.](https://arxiv.org/abs/1401.2910) explains how subset selection and fixed, suboptimal runtimes can create apparent speedup; [Willsch et al.](https://arxiv.org/abs/1907.02359) shows why energy and optimum probability need separate reporting.

## Prioritized research decisions

Retain as immediately testable: full-encoding CVaR control; reduced shipment encoding with independent feasibility oracle; feasible Grover mixer with explicit enumeration costs; held-out parameter transfer; finite-shot training and noisy readout checks. Treat these as hypotheses until the project results establish their scope.

Investigate next if justified: scalable reversible shipment-cost arithmetic and feasible-state preparation; residual-flow/cycle mixers with a connectivity proof; prespecified ascending-CVaR; matched classical/quantum neighborhood subsolvers. Flow-cycle moves require slack/shortage arcs and bounds to preserve the actual feasible set; a generic XY exchange is insufficient.

Defer broader multi-angle, ADAPT, recursive elimination and QN-SPSA until their extra parameter/gradient/fidelity overhead is justified by a controlled failure of simpler methods. Annealing is literature-supported as a formulation/decomposition direction, but no backend or hardware result is established here. Quantum-inspired methods belong among classical controls, not hardware quantum evidence.

## Follow-up evidence and access limits

A later primary follow-up, **Performance analysis of multi-angle QAOA for p > 1**, Igor Gaidai and Rebekah Herrman, Scientific Reports 14, 18911 (2024), [DOI and publisher text](https://doi.org/10.1038/s41598-024-69643-6), was screened after the original multi-angle study. Its accessible results/methods describe classical state-vector simulation on seven datasets of 1,000 graphs and compare approximation ratios against brute-force optima. The authors report lower required depth but find multi-angle QAOA unfavorable for minimizing total QPU time. This directly cautions against treating fewer layers as lower total cost. Full subsequent-section access encountered a publisher redirect error, so this follow-up is not counted among the 22 fully archived primary sources or used for uninspected details. Its result motivates a future matched-evaluation multi-angle control, not a BloodFlow-Q performance claim.

Publication metadata for the original multi-angle and adaptive-QAOA papers was additionally checked against their publisher pages. The Fuchs publisher page returned HTTP 429; its DOI is verified in arXiv metadata, and the archived original arXiv PDF provides the inspected methods. The known DOI must not be mistaken for a separately inspected version of record.

## Detailed literature matrix

The machine-readable version is `literature/literature_matrix.json`. Citation metadata lists every author supplied by the original record. An unverified venue is explicitly left unverified; publication year is available in the venue string where supplied, separate from first preprint year.

### 1. A Quantum Approximate Optimization Algorithm

**Authors:** Farhi, Edward; Goldstone, Jeffrey; Gutmann, Sam. **First preprint:** 2014. **Venue:** Publication venue not independently verified; cited as arXiv preprint. [Primary record](https://arxiv.org/abs/1411.4028); [full paper](https://arxiv.org/pdf/1411.4028).

- **Contribution:** Alternating diagonal cost and transverse-X evolution; fixed-depth local-subgraph analysis.
- **Assumptions:** Local diagonal clauses; global variational optimum is distinct from a practical optimizer result.
- **Evidence:** Theory, including bounded-degree MaxCut guarantees.
- **Authors’ baseline and metrics:** Expected cut approximation ratio; exact optimum for special graph classes.
- **Limitations:** Asymptotic improvement with depth is not efficient parameter discovery or blood-allocation advantage.
- **BloodFlow-Q implication and experiment:** Retain standard QAOA as the controlled baseline and validate signs and cost spectra.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Asymptotic improvement with depth is not efficient parameter discovery or blood-allocation advantage.
- **Inspection:** PDF pages 1, 2, 3; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 2. Warm-starting quantum optimization

**Authors:** Egger, Daniel J.; Marecek, Jakub; Woerner, Stefan. **First preprint:** 2020. **Venue:** Quantum 5, 479 (2021). [Primary record](https://arxiv.org/abs/2009.10095); [full paper](https://arxiv.org/pdf/2009.10095); [DOI](https://doi.org/10.22331/q-2021-06-17-479).

- **Contribution:** Prepare LP/QP-informed product amplitudes and use a rotated mixer sharing that initial ground state; also rounded warm recursive variants.
- **Assumptions:** Relaxed c in [0,1], theta=2 asin sqrt(c); clip endpoints to epsilon and 1-epsilon to avoid frozen bits.
- **Evidence:** Theory and numerical optimization examples.
- **Authors’ baseline and metrics:** Cold versus warm QAOA and classical relaxation/rounding; objective quality and optimum sampling.
- **Limitations:** MaxCut rounding guarantees do not transfer to arbitrary allocation. Already optimal integral seeds leave no allocation objective improvement available.
- **BloodFlow-Q implication and experiment:** Compare initial product distribution, zero-layer seed, rotated-mixer QAOA, and classical seed. Verify affine-versus-clipped preprocessing.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. MaxCut rounding guarantees do not transfer to arbitrary allocation. Already optimal integral seeds leave no allocation objective improvement available.
- **Inspection:** PDF pages 3, 4, 5; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 3. Improving Variational Quantum Optimization using CVaR

**Authors:** Barkoutsos, Panagiotis Kl.; Nannicini, Giacomo; Robert, Anton; Tavernelli, Ivano; Woerner, Stefan. **First preprint:** 2019. **Venue:** Quantum 4, 256 (2020). [Primary record](https://arxiv.org/abs/1907.04769); [full paper](https://arxiv.org/pdf/1907.04769); [DOI](https://doi.org/10.22331/q-2020-04-20-256).

- **Contribution:** Optimize the lower-energy CVaR tail instead of the mean; demonstrate a different landscape.
- **Assumptions:** Diagonal classical Hamiltonian; minimization uses lowest alpha mass, not upper-risk tail.
- **Evidence:** Simulations on six optimization families; hardware portfolio experiment is CVaR-VQE.
- **Authors’ baseline and metrics:** COBYLA with mean versus multiple alpha values; ground-state sampling probability versus normalized optimization iterations.
- **Limitations:** Once optimum mass exceeds alpha, the objective can saturate. Small tails are noisy; no strong-classical speedup established.
- **BloodFlow-Q implication and experiment:** Matched full-encoding mean versus alpha=.2 CVaR; exact and shot-based training. Independently evaluate feasibility and optimum probability.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Once optimum mass exceeds alpha, the objective can saturate. Small tails are noisy; no strong-classical speedup established.
- **Inspection:** PDF pages 4, 5, 6, 7, 8; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 4. From the Quantum Approximate Optimization Algorithm to a Quantum Alternating Operator Ansatz

**Authors:** Hadfield, Stuart; Wang, Zhihui; O'Gorman, Bryan; Rieffel, Eleanor G.; Venturelli, Davide; Biswas, Rupak. **First preprint:** 2017. **Venue:** Algorithms 12.2 (2019): 34. (Special issue "Quantum Optimization Theory, Algorithms, and Applications"). [Primary record](https://arxiv.org/abs/1709.03489); [full paper](https://arxiv.org/pdf/1709.03489); [DOI](https://doi.org/10.3390/a12020034).

- **Contribution:** General alternating-operator framework with problem-specific feasible transitions and encodings.
- **Assumptions:** Initial feasible state, invariant feasible span, and enough connectivity to explore that span.
- **Evidence:** Constructive theory and mappings for constrained optimization.
- **Authors’ baseline and metrics:** Resource and operator constructions rather than an end-to-end blood-allocation benchmark.
- **Limitations:** A mixer protecting one-hot/cardinality does not automatically preserve coupled inventory and demand constraints.
- **BloodFlow-Q implication and experiment:** Specify each invariant, test all tiny feasible states, and separate Hamming-weight preservation from full feasibility.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. A mixer protecting one-hot/cardinality does not automatically preserve coupled inventory and demand constraints.
- **Inspection:** PDF pages 5, 6; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 5. Constrained mixers for the quantum approximate optimization algorithm

**Authors:** Fuchs, Franz G.; Lye, Kjetil Olsen; Nilsen, Halvor Møll; Stasik, Alexander J.; Sartor, Giorgio. **First preprint:** 2022. **Venue:** Publication venue not independently verified; cited as arXiv preprint. [Primary record](https://arxiv.org/abs/2203.06095); [full paper](https://arxiv.org/pdf/2203.06095); [DOI](https://doi.org/10.3390/a15060202).

- **Contribution:** Systematic feasible-subspace mixer construction from Hermitian transition matrices; connectivity and decomposition analysis.
- **Assumptions:** Hamiltonian supported on feasible basis states; transition powers must connect the desired states.
- **Evidence:** Theory and constructed examples.
- **Authors’ baseline and metrics:** Feasible reachability, mixer decomposition, and circuit resources.
- **Limitations:** Trotter partitioning can alter reachability; formal invariant subspaces do not guarantee efficient implementation.
- **BloodFlow-Q implication and experiment:** Exhaustively test reduced-state feasible mixer invariance, unitarity, and reachability before benchmarking.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Trotter partitioning can alter reachability; formal invariant subspaces do not guarantee efficient implementation.
- **Inspection:** PDF pages 2, 3, 4, 5; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 6. Grover Mixers for QAOA: Shifting Complexity from Mixer Design to State Preparation

**Authors:** Bärtschi, Andreas; Eidenbenz, Stephan. **First preprint:** 2020. **Venue:** IEEE International Conference on Quantum Computing and Engineering, QCE'20, 72-82, 2020. [Primary record](https://arxiv.org/abs/2006.00354); [full paper](https://arxiv.org/pdf/2006.00354); [DOI](https://doi.org/10.1109/QCE49297.2020.00020).

- **Contribution:** Rank-one Grover mixer built from preparation of the uniform feasible superposition; equal-cost amplitude symmetry.
- **Assumptions:** Efficient exact feasible-superposition preparation is needed for efficient execution.
- **Evidence:** Theory and constructions including permutation-state preparation.
- **Authors’ baseline and metrics:** Gate/depth resources and comparison with problem-specific mixers.
- **Limitations:** Arbitrary feasible-state enumeration can be exponential. No Trotter error is not absence of hardware noise.
- **BloodFlow-Q implication and experiment:** Use U_S inverse, zero-state phase, U_S; report enumeration, state preparation and oracle synthesis costs separately.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Arbitrary feasible-state enumeration can be exponential. No Trotter error is not absence of hardware noise.
- **Inspection:** PDF pages 2, 3, 4, 8, 9; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 7. Domain wall encoding of discrete variables for quantum annealing and QAOA

**Authors:** Chancellor, Nicholas. **First preprint:** 2019. **Venue:** Quantum Sci. Technol. 4 045004 (2019). [Primary record](https://arxiv.org/abs/1903.05068); [full paper](https://arxiv.org/pdf/1903.05068); [DOI](https://doi.org/10.1088/2058-9565/ab33c2).

- **Contribution:** Encode a d-valued discrete variable in d-1 domain-wall qubits; arbitrary pairwise energies use two-body Ising terms.
- **Assumptions:** Single-wall logical subspace and suitable penalties or mixers; bounded discrete domains.
- **Evidence:** Analytical construction and numerical minor-embedding comparisons.
- **Authors’ baseline and metrics:** One-hot versus domain-wall on scheduling/coloring with Chimera/Pegasus embeddings.
- **Limitations:** Improvement is structure dependent and relative to one-hot, not logarithmic binary. Encoding validity is not global allocation feasibility.
- **BloodFlow-Q implication and experiment:** Compare qubit counts and locality for shipment integer domains; defer full implementation unless gate resource savings justify extra qubits.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Improvement is structure dependent and relative to one-hot, not logarithmic binary. Encoding validity is not global allocation feasibility.
- **Inspection:** PDF pages 1, 2, 4, 7; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 8. Quantum Approximate Optimization Algorithm: Performance, Mechanism, and Implementation on Near-Term Devices

**Authors:** Zhou, Leo; Wang, Sheng-Tao; Choi, Soonwon; Pichler, Hannes; Lukin, Mikhail D.. **First preprint:** 2018. **Venue:** Phys. Rev. X 10, 021067 (2020). [Primary record](https://arxiv.org/abs/1812.01041); [full paper](https://arxiv.org/pdf/1812.01041); [DOI](https://doi.org/10.1103/PhysRevX.10.021067).

- **Contribution:** Identify parameter patterns and propose interpolation/Fourier initialization and nonadiabatic QAOA schedules.
- **Assumptions:** Empirical patterns on studied regular weighted/unweighted MaxCut families.
- **Evidence:** Simulation and proposed near-term resource analysis.
- **Authors’ baseline and metrics:** Random initialization, structured schedules and quantum annealing; approximation ratio and optimization effort.
- **Limitations:** Polynomial heuristic optimization behavior in tested families is not a universal theorem. Hard adiabatic instances are not necessarily hard for classical optimization.
- **BloodFlow-Q implication and experiment:** Transfer only from held-out training instances, include training cost, and compare with fresh optimization under fixed evaluation budgets.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Polynomial heuristic optimization behavior in tested families is not a universal theorem. Hard adiabatic instances are not necessarily hard for classical optimization.
- **Inspection:** PDF pages 1, 2, 3, 4; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 9. Multi-angle Quantum Approximate Optimization Algorithm

**Authors:** Herrman, Rebekah; Lotshaw, Phillip C.; Ostrowski, James; Humble, Travis S.; Siopsis, George. **First preprint:** 2021. **Venue:** Scientific Reports 12, 6781 (2022). [Primary record](https://arxiv.org/abs/2109.11455); [full paper](https://arxiv.org/pdf/2109.11455); [DOI](https://doi.org/10.1038/s41598-022-10555-8).

- **Contribution:** Give cost terms and mixer terms independent angles, increasing expressivity at fixed circuit layers.
- **Assumptions:** Same diagonal clause decomposition; larger continuous parameter space.
- **Evidence:** Star-graph analysis and simulations; large triangle-free p=1 graphs use analytic expectation formulas.
- **Authors’ baseline and metrics:** Standard p=1..3 QAOA, approximation ratio and removable zero-angle gates.
- **Limitations:** Increased parameter search cost; 50/100-vertex analytic evaluation is not general full-state simulation or hardware demonstration.
- **BloodFlow-Q implication and experiment:** Defer full multi-angle search; first test a grouped-angle variant with matched circuit evaluations and count optimization overhead.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Increased parameter search cost; 50/100-vertex analytic evaluation is not general full-state simulation or hardware demonstration.
- **Inspection:** PDF pages 1, 2, 3, 4; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 10. An adaptive quantum approximate optimization algorithm for solving combinatorial problems on a quantum computer

**Authors:** Zhu, Linghua; Tang, Ho Lun; Barron, George S.; Calderon-Vargas, F. A.; Mayhall, Nicholas J.; Barnes, Edwin; Economou, Sophia E.. **First preprint:** 2020. **Venue:** Physical Review Research 4, 033029 (2022). [Primary record](https://arxiv.org/abs/2005.10258); [full paper](https://arxiv.org/pdf/2005.10258); [DOI](https://doi.org/10.1103/PhysRevResearch.4.033029).

- **Contribution:** ADAPT-QAOA greedily selects mixer operators using gradients and reoptimizes an incrementally grown ansatz.
- **Assumptions:** Chosen operator pool, measurable gradients and nonzero phase initialization; pool defines reachable states.
- **Evidence:** Simulations of small weighted MaxCut instances and mechanism analysis.
- **Authors’ baseline and metrics:** Standard QAOA versus single/multi-qubit pools; energy error, parameter and CNOT counts.
- **Limitations:** Pool-selection measurement overhead must be included. Generic pools need not preserve blood constraints.
- **BloodFlow-Q implication and experiment:** Candidate for a future feasible-transition operator pool after scalable transitions are derived; count every pool-gradient circuit.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Pool-selection measurement overhead must be included. Generic pools need not preserve blood constraints.
- **Inspection:** PDF pages 1, 2, 3, 4; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 11. Obstacles to State Preparation and Variational Optimization from Symmetry Protection

**Authors:** Bravyi, Sergey; Kliesch, Alexander; Koenig, Robert; Tang, Eugene. **First preprint:** 2019. **Venue:** Phys. Rev. Lett. 125, 260505 (2020). [Primary record](https://arxiv.org/abs/1910.08980); [full paper](https://arxiv.org/pdf/1910.08980); [DOI](https://doi.org/10.1103/PhysRevLett.125.260505).

- **Contribution:** Prove locality/symmetry obstructions for shallow QAOA and propose correlation-based recursive variable elimination.
- **Assumptions:** Specific symmetric graph Hamiltonians for the bounds; RQAOA enforces a selected spin correlation at each recursion.
- **Evidence:** Theory and numerical frustrated-Ising comparisons.
- **Authors’ baseline and metrics:** QAOA, RQAOA and classical algorithms; approximation quality.
- **Limitations:** Bounds are not a universal impossibility theorem; recursive constraints may exclude the true optimum.
- **BloodFlow-Q implication and experiment:** Treat recursion as optional hybrid heuristic with reconstruction and classical correlation-elimination control; recheck allocation feasibility.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Bounds are not a universal impossibility theorem; recursive constraints may exclude the true optimum.
- **Inspection:** PDF pages 1, 3, 4; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 12. For Fixed Control Parameters the Quantum Approximate Optimization Algorithm's Objective Function Value Concentrates for Typical Instances

**Authors:** Brandao, Fernando G. S. L.; Broughton, Michael; Farhi, Edward; Gutmann, Sam; Neven, Hartmut. **First preprint:** 2018. **Venue:** Publication venue not independently verified; cited as arXiv preprint. [Primary record](https://arxiv.org/abs/1812.04170); [full paper](https://arxiv.org/pdf/1812.04170).

- **Contribution:** Explain concentration of fixed-parameter QAOA objective functions for typical random instances through local neighborhoods.
- **Assumptions:** Fixed depth and specified random graph ensembles; expectation concentration differs from guaranteed optimum-angle transfer.
- **Evidence:** Theory with ensemble analysis.
- **Authors’ baseline and metrics:** Instance-to-instance objective landscapes at fixed parameters.
- **Limitations:** Does not justify transfer between arbitrary penalty scales or different allocation topologies.
- **BloodFlow-Q implication and experiment:** Normalize phase units consistently and report training versus test topology; test transfer degradation under demand and cost shifts.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Does not justify transfer between arbitrary penalty scales or different allocation topologies.
- **Inspection:** PDF pages 3, 4; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 13. Benchmarking the Quantum Approximate Optimization Algorithm

**Authors:** Willsch, Madita; Willsch, Dennis; Jin, Fengping; De Raedt, Hans; Michielsen, Kristel. **First preprint:** 2019. **Venue:** Quantum Inf. Process. 19, 197 (2020). [Primary record](https://arxiv.org/abs/1907.02359); [full paper](https://arxiv.org/pdf/1907.02359); [DOI](https://doi.org/10.1007/s11128-020-02692-8).

- **Contribution:** Benchmark different QAOA performance metrics, parameter initialization and practical devices.
- **Assumptions:** Small encoded problem instances; exact ground energy known for benchmarking.
- **Evidence:** Simulation plus IBM parameter-grid measurements and D-Wave experiments.
- **Authors’ baseline and metrics:** Ground-state probability, energy and scaled approximation measure; initialization/optimization variants.
- **Limitations:** IBM experiment is grid search, not full on-device optimization. Energy improvement need not imply optimum-probability improvement.
- **BloodFlow-Q implication and experiment:** Report separate energy, feasible probability, exact-optimum probability and all optimization counts; do not infer hardware runtime from simulation.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. IBM experiment is grid search, not full on-device optimization. Energy improvement need not imply optimum-probability improvement.
- **Inspection:** PDF pages 4, 8; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 14. Similarity-Based Parameter Transferability in the Quantum Approximate Optimization Algorithm

**Authors:** Galda, Alexey; Gupta, Eesh; Falla, Jose; Liu, Xiaoyuan; Lykov, Danylo; Alexeev, Yuri; Safro, Ilya. **First preprint:** 2023. **Venue:** Publication venue not independently verified; cited as arXiv preprint. [Primary record](https://arxiv.org/abs/2307.05420); [full paper](https://arxiv.org/pdf/2307.05420).

- **Contribution:** Relate donor/acceptor parameter transfer to local graph neighborhoods and parity.
- **Assumptions:** Unweighted MaxCut and relevant local subgraph structure; donor similarity matters.
- **Evidence:** QTensor simulation and exact Gurobi references.
- **Authors’ baseline and metrics:** Transferred versus optimized parameters; approximation ratios and structural similarity.
- **Limitations:** MaxCut-locality conclusions do not directly apply to dense nonlinear shipment truth-table costs.
- **BloodFlow-Q implication and experiment:** Use explicit training-only donor selection and reject a universal transfer claim if held-out shifted instances fail.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. MaxCut-locality conclusions do not directly apply to dense nonlinear shipment truth-table costs.
- **Inspection:** PDF pages 4, 5; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 15. Defining and detecting quantum speedup

**Authors:** Rønnow, Troels F.; Wang, Zhihui; Job, Joshua; Boixo, Sergio; Isakov, Sergei V.; Wecker, David; Martinis, John M.; Lidar, Daniel A.; Troyer, Matthias. **First preprint:** 2014. **Venue:** Science 345, 420 (2014). [Primary record](https://arxiv.org/abs/1401.2910); [full paper](https://arxiv.org/pdf/1401.2910); [DOI](https://doi.org/10.1126/science.1252319).

- **Contribution:** Define several forms of quantum speedup and demonstrate pitfalls in time-to-solution scaling.
- **Assumptions:** Same target success threshold; repeat-success model and properly optimized runtimes.
- **Evidence:** Theory and D-Wave Two random spin-glass hardware benchmarking.
- **Authors’ baseline and metrics:** Simulated classical/quantum annealing versus hardware; repeat-adjusted time to solution.
- **Limitations:** No overall speedup in the tested dataset; subset selection and nonoptimal runtimes can manufacture apparent scaling gains.
- **BloodFlow-Q implication and experiment:** Use ceil(log(1-target)/log(1-p)) only for independent repetitions; include preprocessing and optimizer costs and strong classical solvers.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. No overall speedup in the tested dataset; subset selection and nonoptimal runtimes can manufacture apparent scaling gains.
- **Inspection:** PDF pages 1, 2, 3, 4; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 16. An evolving objective function for improved variational quantum optimisation

**Authors:** Kolotouros, Ioannis; Wallden, Petros. **First preprint:** 2021. **Venue:** Phys. Rev. Research 4, 023225 (2022). [Primary record](https://arxiv.org/abs/2105.11766); [full paper](https://arxiv.org/pdf/2105.11766); [DOI](https://doi.org/10.1103/PhysRevResearch.4.023225).

- **Contribution:** Ascending-CVaR changes alpha during optimization to alter the landscape and escape saturation/local minima.
- **Assumptions:** Tail objectives for diagonal costs; attainable optimal overlap depends on ansatz.
- **Evidence:** Emulation on MaxCut, number partitioning and portfolio.
- **Authors’ baseline and metrics:** Mean, fixed-CVaR and evolving-CVaR; optimal-state overlap and optimization progress.
- **Limitations:** Schedule choice matters, and broad performance statements are limited to tested instances. Printed Proposition 2 wording and subsequent explanation require care.
- **BloodFlow-Q implication and experiment:** Future prespecified alpha schedule, equal total shots, and fixed-alpha controls; reject if gains disappear after accounting for extra stages.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Schedule choice matters, and broad performance statements are limited to tested instances. Printed Proposition 2 wording and subsequent explanation require care.
- **Inspection:** PDF pages 4, 5, 7, 8; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 17. Quantum Local Search with the Quantum Alternating Operator Ansatz

**Authors:** Tomesh, Teague; Saleem, Zain H.; Suchara, Martin. **First preprint:** 2021. **Venue:** Quantum 6, 781 (2022). [Primary record](https://arxiv.org/abs/2107.04109); [full paper](https://arxiv.org/pdf/2107.04109); [DOI](https://doi.org/10.22331/q-2022-08-22-781).

- **Contribution:** Quantum local search solves constrained neighborhoods and updates a global independent set.
- **Assumptions:** Neighborhood mixers and boundary conditions must preserve global MIS feasibility.
- **Evidence:** Simulations on graph families up to 100 nodes.
- **Authors’ baseline and metrics:** Classical and quantum local-search variants; independent-set sizes and limited quantum neighborhoods.
- **Limitations:** MIS construction is not directly a flow mixer; a large global graph does not mean a large quantum circuit.
- **BloodFlow-Q implication and experiment:** Develop allocation residual-capacity neighborhoods, replace the subsolver with MILP/exhaustive/local search controls, and charge neighborhood construction.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. MIS construction is not directly a flow mixer; a large global graph does not mean a large quantum circuit.
- **Inspection:** PDF pages 1, 2, 4, 5; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 18. Optimizing the Optimizer: Decomposition Techniques for Quantum Annealing

**Authors:** Bass, Gideon; Henderson, Max; Heath, Joshua; Dulny III, Joseph. **First preprint:** 2020. **Venue:** Publication venue not independently verified; cited as arXiv preprint. [Primary record](https://arxiv.org/abs/2001.06079); [full paper](https://arxiv.org/pdf/2001.06079).

- **Contribution:** Compare decomposition/embedding and influence-propagation choices for quantum annealing hybrid optimizers.
- **Assumptions:** QUBO subproblems, fixed boundary variables and embedding constraints.
- **Evidence:** D-Wave 2000Q hybrid experiments on 104 benchmark instances.
- **Authors’ baseline and metrics:** Multiple decomposition methods including Qbsolv and random reference; quality, violations and time.
- **Limitations:** Explicitly not a comparison against state-of-the-art classical solvers. Some domain preprocessing discards candidates.
- **BloodFlow-Q implication and experiment:** Test identical allocation neighborhoods with quantum and strong classical subsolvers before attributing a hybrid gain to quantum sampling.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Explicitly not a comparison against state-of-the-art classical solvers. Some domain preprocessing discards candidates.
- **Inspection:** PDF pages 1, 2, 5, 10; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 19. Simultaneous Perturbation Stochastic Approximation of the Quantum Fisher Information

**Authors:** Gacon, Julien; Zoufal, Christa; Carleo, Giuseppe; Woerner, Stefan. **First preprint:** 2021. **Venue:** Quantum 5, 567 (2021). [Primary record](https://arxiv.org/abs/2103.09232); [full paper](https://arxiv.org/pdf/2103.09232); [DOI](https://doi.org/10.22331/q-2021-10-20-567).

- **Contribution:** Stochastically approximate quantum Fisher information using four fidelity evaluations per estimate.
- **Assumptions:** Parameterized pure states, fidelity estimation and regularized metric inversion.
- **Evidence:** Numerical ground-state/learning examples and LiH IBM hardware experiment.
- **Authors’ baseline and metrics:** SPSA, analytic gradients and quantum natural gradients; energy convergence and circuit evaluations.
- **Limitations:** Constant circuit evaluations per metric estimate is not constant classical linear-algebra or shot cost; not specific evidence for CVaR allocation.
- **BloodFlow-Q implication and experiment:** Use SPSA/QN-SPSA only as a noisy-objective follow-up, accounting for fidelity circuits, metric solves and shot budgets.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Constant circuit evaluations per metric estimate is not constant classical linear-algebra or shot cost; not specific evidence for CVaR allocation.
- **Inspection:** PDF pages 1, 2, 4, 7; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 20. Grover Adaptive Search for Constrained Polynomial Binary Optimization

**Authors:** Gilliam, Austin; Woerner, Stefan; Gonciulea, Constantin. **First preprint:** 2019. **Venue:** Quantum 5, 428 (2021). [Primary record](https://arxiv.org/abs/1912.04088); [full paper](https://arxiv.org/pdf/1912.04088); [DOI](https://doi.org/10.22331/q-2021-04-08-428).

- **Contribution:** Grover adaptive search with efficient polynomial key-value oracles, signed value registers and constraint indicators.
- **Assumptions:** Known polynomial coefficients, enough value-register precision to prevent overflow; randomized iteration schedule when marked count is unknown.
- **Evidence:** Circuit constructions, tiny portfolio simulations and a small IBM Toronto hardware demonstration.
- **Authors’ baseline and metrics:** Sample distributions and oracle resources; no strong classical allocation benchmark.
- **Limitations:** Quadratic query savings assume usable coherent oracles; finite precision, ancillas, uncomputation and repeated queries cost gates. No advantage over min-cost flow established.
- **BloodFlow-Q implication and experiment:** Fixed 1/2/3 threshold amplification is a bounded control, not full GAS. Mark feasible allocations strictly better than a classical incumbent and charge dense oracle construction.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Quadratic query savings assume usable coherent oracles; finite precision, ancillas, uncomputation and repeated queries cost gates. No advantage over min-cost flow established.
- **Inspection:** PDF pages 2, 3, 4, 5, 6, 7; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 21. A Quantum Algorithm for Finding the Minimum

**Authors:** Durr, Christoph; Hoyer, Peter. **First preprint:** 1996. **Venue:** Publication venue not independently verified; cited as arXiv preprint. [Primary record](https://arxiv.org/abs/quant-ph/9607014); [full paper](https://arxiv.org/pdf/quant-ph/9607014).

- **Contribution:** Quantum minimum finding iteratively lowers a random incumbent using exponential search with unknown marked count and a bounded timeout.
- **Assumptions:** Coherent table access/comparison oracle; O(sqrt(N)) query model, success amplified by repeats; ties also handled.
- **Evidence:** Theoretical algorithm and probability/query bound; no hardware evidence.
- **Authors’ baseline and metrics:** Classical unstructured minimum search takes linear probes; quantum algorithm has constant-success square-root query scaling.
- **Limitations:** The oracle model omits application-specific data/oracle construction and is not a comparison against structured network-flow algorithms.
- **BloodFlow-Q implication and experiment:** Separate a demonstration of threshold amplitude amplification from actual minimum finding; retain zero-mark cases, overshoot, oracle cost and fixed iteration budgets.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. The oracle model omits application-specific data/oracle construction and is not a comparison against structured network-flow algorithms.
- **Inspection:** PDF pages 1, 2; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

### 22. Grover Adaptive Search with Problem-Specific State Preparation

**Authors:** Hess, Maximilian; Palackal, Lilly; Awasthi, Abhishek; Eder, Peter J.; Schnaus, Manuel; Demmler, Laurin; Wintersperger, Karen; Doetsch, Joseph. **First preprint:** 2026. **Venue:** Publication venue not independently verified; cited as arXiv preprint. [Primary record](https://arxiv.org/abs/2602.08418); [full paper](https://arxiv.org/pdf/2602.08418).

- **Contribution:** Problem-specific GAS state preparation for TSP exchange neighborhoods, with comparisons of iteration schedules and termination rules.
- **Assumptions:** Efficient neighborhood preparation and evaluable costs; simulations require classical enumeration of better tours.
- **Evidence:** 2026 preprint: classical analytic amplitude-amplification simulation on 15 TSP instances of 8/10/12 cities, not quantum execution.
- **Authors’ baseline and metrics:** Greedy incumbent and alternative GAS schedules; objective deviation and Grover iteration count.
- **Limitations:** Local-neighborhood improvements were limited on tested small cases. CP-SAT compiles better tours for analytic simulation; 64–144 encoding variables do not mean full quantum circuit simulation. No demonstrated strong-classical speedup.
- **BloodFlow-Q implication and experiment:** Use a bounded threshold experiment and document analytic simulation/quantum circuit equivalence. For future neighborhood GAS, compare strong classical subsolvers and count all preparation and enumeration costs.
- **Verification concern:** Original primary PDF archived and selected methods inspected; paper experiments were not independently rerun. Local-neighborhood improvements were limited on tested small cases. CP-SAT compiles better tours for analytic simulation; 64–144 encoding variables do not mean full quantum circuit simulation. No demonstrated strong-classical speedup.
- **Inspection:** PDF pages 1, 2, 3, 4, 5, 6, 7, 8; Verified primary-source methods; applicability and proposed experiments are theoretically motivated.

