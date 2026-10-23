# Evidence needed to justify a quantum component

Research note, 2026-10-23. This note supports the new replacement-ablation experiment; it does not claim that a harder synthetic extension is a real BloodFlow-Q requirement. Existing experiment conclusions remain unchanged.

## What the sources establish

1. **Measure the actual task and the strongest relevant replacement.** Rønnow et al., *Defining and detecting quantum speedup*, Science 345, 420–424 (2014), distinguish restricted comparator claims from general speedup and explain how suboptimal tuning, selected instances, and neglected overhead can mislead. Their sections IV–V and Methods distinguish execution time from end-to-end wall time. For BloodFlow-Q, use paired cases, publish losses and failures, and charge preprocessing, optimization, measurement and postprocessing. A simulator wall-clock win would be a classical software result, not hardware quantum speedup. [Original paper and inspected methods](https://arxiv.org/html/1401.2910v1).

2. **A flow solver is a relevant classical baseline.** Google's official OR-Tools documentation defines minimum-cost flow using unit arc costs, capacities and node supplies/demands and supplies a dedicated implementation. This matches the structure worth exploiting before calling the allocation task difficult. Using a generic greedy rule alone would fail to exploit known structure. The documentation is an implementation reference, not a theorem about this repository; the structural proof below is derived from inspected code. [Official minimum-cost-flow documentation](https://developers.google.com/optimization/flow/mincostflow).

3. **Feasible Grover mixing assumes affordable state preparation.** Bärtschi and Eidenbenz, *Grover Mixers for QAOA: Shifting Complexity from Mixer Design to State Preparation*, IEEE QCE (2020), require efficient preparation of the feasible superposition for an efficient algorithm. Their construction and examples do not provide a generic efficient blood-allocation preparer. A dense list of feasible allocations is therefore an explicit cost, and its minimum is an essential classical replacement. Source methods were inspected in the previously archived PDF, particularly the framework and state-preparation discussion. [Original paper](https://arxiv.org/abs/2006.00354).

4. **Amplitude amplification is not automatically a MILP speedup.** Gilliam, Woerner and Gonciulea, *Grover Adaptive Search for Constrained Polynomial Binary Optimization*, Quantum 5, 428 (2021), describe threshold search and coherent objective/constraint evaluation. The quadratic search improvement is against brute-force search, with oracle construction, ancillas, precision and depth still relevant. Sections 3.1–3.3 explain value registers, predicate checks and uncomputation. A truth table created by exhaustively evaluating the candidate neighborhood does not establish a cheap quantum oracle. [Original paper and inspected methods](https://arxiv.org/html/1912.04088v3).

5. **Fixed dispatch costs define a different, established model.** Paul Gray, *Technical Note—Exact Solution of the Fixed-Charge Transportation Problem*, Operations Research 19(6), 1529–1538 (1971), associates a route-opening fee with a route in addition to quantity-proportional costs. The publisher abstract describes a classical integer master with transportation subproblems. Thus a fixed-charge extension is credible mathematical research, but already has strong classical decomposition baselines. Only the publisher abstract/metadata were read here; the PDF was accessible but not fully inspected, so no claim about its detailed algorithm or present performance is made. [Primary publisher source](https://doi.org/10.1287/opre.19.6.1529).

## Structural result from current source code

**Verified by inspection and mathematical reasoning, conditional on the present model:** `optimization/milp.py` constructs one demand equality per hospital/recipient group and one inventory inequality per bank/donor group. Each shipment column has one coefficient in each category. Multiply inventory rows by −1: shipment columns have one +1 and one −1, while unmet-demand columns are unit columns. Adding inventory slack and variable bounds preserves total unimodularity of this network matrix. Integer supplies, demands and bounds therefore give integral LP vertices. A finite linear objective has an integral optimal vertex whenever the feasible bounded region is nonempty. This does not say every optimal point is integral; fractional convex combinations of tied optima can exist, and numerical solvers still need validation.

Compatibility and unavailable routes remove shipment variables rather than adding cross-variable constraints. The current secondary objective amounts are caller-provided constants and do not change this matrix. Consequently, merely adding more hospitals, banks or blood groups within the present structure does not create a general integer-programming barrier. Fixing some shipment variables to integer incumbent values also leaves the residual flow structure intact. This argument must be revisited if shared dispatch capacities, activation decisions, nonlinear costs or other coupled constraints are added.

## A precise optional fixed-charge extension

If a hypothetical experiment uses dispatch fees, define one binary activation y_r for each physical route r=(bank,hospital), shared across the blood groups carried on that route. Add f_r*y_r to the true objective and impose sum of shipment quantities on route r <= M_r*y_r, with a documented valid capacity bound M_r. Positive fees make unused activations unattractive; an additional lower linking bound can enforce the desired semantics if needed. Charging each blood-allocation variable separately is a different model. Fixed-charge fees do not represent vehicle sequencing, vehicle counts, cold-chain validity, temporal demand uncertainty, or clinical utility. These are synthetic modeling assumptions until backed by application evidence.

The extension removes the simple flow-only argument, but harder formulation does not imply hard tested instances or quantum suitability. Benchmark the complete MILP before spending substantial work on its quantum subproblem. Keep an otherwise matched zero-fee flow control so the effect of adding activation choices is visible.

## Concrete replacement-ablation experiment

Use the same generated instance, initial incumbent, chosen neighborhood, feasibility function and cost function for each subsolver. Save the neighborhood indices and inputs so the comparison can be replayed. Compare at least:

- Full-model LP/flow for the unchanged allocation problem, or full-model MILP for the fixed-charge extension.
- The hybrid scaffold with an exact classical neighborhood replacement.
- The same scaffold with a stochastic classical replacement and recorded evaluation budget.
- The same scaffold with the quantum sampler, recording optimizer calls, all training/final shots and complete local runtime.
- Classical table minimum whenever quantum preparation has already constructed a complete cost/feasibility table.

Freeze method configurations and primary comparisons before measuring held-out cases. A common number of objective calls is an algorithmic accounting control, not equal computational work: one quantum expectation call may simulate every candidate and invoke many circuit gates. Report matched workload and total wall-clock comparisons separately. If exact classical replacement finishes before the budget, let it return its result; do not force it to discard useful information or waste its remaining time. Retain the input incumbent on failure or non-improvement. Validate every returned candidate independently.

## Verdict gates

| Gate | Evidence required | Conclusion if it fails |
|---|---|---|
| Application relevance | Actual requirement or explicitly labeled hypothetical extension | No claim of operational necessity |
| Classical difficulty | Strong classical solver demonstrably misses a frozen quality/time target | Quantum is not justified by difficulty on tested cases |
| Quantum contribution | Quantum hybrid improves over the otherwise identical classical replacement, with corrected paired analysis on held-out instances | Benefit is attributable to decomposition/classical scaffold, or unestablished |
| Honest preparation | Objective oracle/state preparation costs included; table minimum benchmark retained | Sampling improvements do not establish search benefit |
| Scalability | Circuit/ancilla/depth resource growth and classical scaling measured beyond a few tiny cases | Only small-instance evidence |
| Hardware claim | Actual hardware execution or explicitly scoped fault-tolerant resource analysis | Simulator research only |

Passing one gate is not passing all. A lower sample failure rate can be useful circuit research even when quantum is unnecessary for allocation. The defensible present statement remains: the current allocation task has a strong classical solution; this experiment tests whether the quantum component adds value under precisely stated alternatives.
