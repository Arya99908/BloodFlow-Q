# Does BloodFlow-Q need quantum optimization?

2026-10-23 follow-up. **No quantum contribution was demonstrated in the replacement experiment. The current allocation model has a structural classical solution, and replacing the tested quantum search with classical optimization preserved final solution quality on all 60 paired runs.** This is a bounded negative result, not a theorem about every future quantum algorithm.

## What was implemented

The new `necessity/` package tests the component rather than only a circuit's optimal-sample percentage. It builds an identical hybrid wrapper around four subsolvers: restricted MILP, classical minimum of an enumerated neighborhood, bounded adaptive amplitude amplification, and uniform random candidate sampling. The initial allocation, variable neighborhood schedule, objective, feasibility definition, and nominal round budget are shared. Later incumbents can diverge because each method keeps its own improvements.

Six frozen synthetic scenarios each have two formulations: the unchanged allocation objective and an explicitly hypothetical fixed-dispatch-cost extension. The extension charges a route once across all blood groups, using a binary activation variable and a valid shipment upper bound. It does not claim vehicle scheduling, uncertain demand, expiry, or a requirement supplied by an operational blood bank. All objective coefficients and fees are saved.

The complete follow-up contains an eight-run pilot, 240 main hybrid runs, 960 neighborhood rounds, and 16 larger classical scaling cases with both LP and MILP. Seven new tests plus the previous 14 research tests and 164 production tests pass. All prior research artifacts and snapshotted production/evidence files remain unchanged.

## Why the original task favors classical methods

Code inspection gives a stronger explanation than the earlier small-instance observations. After changing the sign of supply rows, each shipment column has one +1 and one −1: a network incidence structure. Unmet-demand/slack columns and variable bounds preserve total unimodularity. With integer stocks and demands, the bounded feasible LP has an integral optimal vertex. Compatibility and unavailable routes remove variables; they do not break this structure. Fixing integer shipments in a neighborhood also preserves it.

This does not imply every optimal LP point is integral: tied integral optima can have fractional convex combinations. Nor does it apply automatically to a model with route activation or arbitrary additional constraints. The source-code reasoning and primary sources are documented in [NECESSITY_EVIDENCE.md](NECESSITY_EVIDENCE.md).

**Verified implication:** making the existing flow problem bigger does not by itself create a reason to use quantum integer optimization. Strong classical LP/flow methods remain essential comparators.

## Frozen design and budget interpretation

Each formulation uses six independent case seeds and five matched sampler/schedule seeds, four rounds, at most ten neighborhood bits, and a 0.1-second soft round budget. The quantum and uniform controls have a 64-work-unit cap: oracle iterations plus measured-candidate checks for quantum, scalar candidate evaluations for uniform. These units are not physically equal costs; actual elapsed time and preprocessing are separately recorded.

Quantum search adapts its iteration range without access to marked-state counts or the optimum. Each attempt draws an iteration count, applies an ideal oracle/reflection sequence, measures once, and updates the threshold only on an observed improvement. Tests compare this kernel with actual Qiskit circuit probabilities. No QPU ran these experiments. This bounded implementation is not a claim to realize a general asymptotic adaptive-search theorem.

Both quantum and classical-table methods pay to construct their complete neighborhood table. Full-model MILP and LP each have a two-second solver cap. All small-case references were certified optimal. Failures and time limits retain explicit status and bounds. Nominal limits are soft because solver calls and table creation are not arbitrarily interruptible; the main hybrid study had no round overruns. Scaling has one recorded solver overrun of roughly 18 milliseconds.

**Protocol bookkeeping correction:** the pre-run text mistakenly called the scaling design 32 rows. Four sizes × two seeds × two formulations is 16 rows, with 32 LP/MILP calls. No cases were dropped or added in response to outcomes. The original protocol and hash remain intact.

## Replacement results

Each row summarizes 30 runs (six instances × five seeds). Gap is the allocation objective minus its certified full-model optimum; lower is better. Times include the shared task/initial-incumbent setup charged once per run and all four rounds, but exclude offline exact reference solving.

| Formulation | Neighborhood method | Mean objective gap | Runs reaching global optimum | Mean local simulation time |
|---|---|---:|---:|---:|
| Original | MILP | 1.7333 | 15/30 | 11.82 ms |
| Original | Classical table minimum | 1.7333 | 15/30 | 33.20 ms |
| Original | Quantum amplitude sampling | 1.7333 | 15/30 | 36.68 ms |
| Original | Uniform random | 1.7333 | 15/30 | 5.33 ms |
| Hypothetical dispatch fees | MILP | 1.7367 | 25/30 | 13.01 ms |
| Hypothetical dispatch fees | Classical table minimum | 1.7367 | 25/30 | 32.83 ms |
| Hypothetical dispatch fees | Quantum amplitude sampling | 1.7367 | 25/30 | 36.58 ms |
| Hypothetical dispatch fees | Uniform random | 1.8167 | 25/30 | 5.21 ms |

**Experimentally observed:** quantum final objective tied its MILP replacement in all 60 matched runs and its table-minimum replacement in all 60. It beat uniform random in two dispatch-fee runs, but both strong classical replacements achieved those same improvements. That is not a quantum advantage.

The random small neighborhoods were largely unproductive: no method improved the initial solution in the original-model runs; MILP/table/quantum each improved two dispatch-fee runs. Exact full-model optimization still found better solutions on cases where the wrapper stalled. This diagnoses a limitation of the chosen neighborhood schedule and provides weak discrimination among good local subsolvers. It does not establish that all neighborhood algorithms are equivalent. A future structural neighborhood design must be given equally to classical and quantum methods.

Five seeds per case do not supply 30 independent instances. Analysis saves all paired differences and descriptive case-bootstrap intervals. Zero observed differences do not prove statistical equivalence or rule out improvements elsewhere. No significance claim is made from these exploratory results. Timing is local classical simulation timing, not a hardware speedup estimate.

## Larger classical controls and the one unresolved optimum

Scaling uses 4, 8, 16 and 24 banks/hospitals, two blood groups and two seeds. The largest instances contain 1,728 shipment variables, far beyond the small full-state quantum simulations previously run. No statevector simulation of all these variables was attempted.

- Original formulation: all eight larger MILPs certified optimality within the two-second cap; the slowest measured solve was about 16.3 ms. LP returned integral shipment solutions and the same objective.
- Dispatch-fee formulation: seven of eight MILPs certified optimality within the cap. One 24-by-24 case returned a feasible objective of 449.8 with a certified lower bound of 448.9, a remaining absolute certificate gap of 0.9 (about 0.20% of the incumbent). Its optimum is **not** asserted to be 449.8.
- In the fixed-fee extension, integral LP shipment quantities do not certify the LP allocation objective: route activations can be fractional. A dedicated regression test verifies a case where the LP shipment values are integral but the relaxed fee objective is below the true integer optimum.

The time-limited case is a reproducible future stress case, not proof that classical algorithms are practically inadequate. A 0.20% certificate gap may already meet an application's quality target, and no actual target has been supplied. The tiny-neighborhood quantum runs were not performed on this large instance, so they provide no evidence of improving it.

## Necessity verdict

| Requirement for a quantum justification | Evidence here | Status |
|---|---|---|
| Real operational need for a harder model | Fixed fees are a hypothetical extension | Unverified |
| Classical difficulty on current formulation | Structural flow argument; larger classical controls solve readily | Not supported |
| Quantum contribution beyond its wrapper | Same final quality as exact classical replacement on every pair | Not observed under tested conditions |
| Affordable quantum input/oracle construction | About 3,755 table entries evaluated per run on average | Not satisfied by this implementation |
| End-to-end hardware advantage | Local simulator only | Unverified |

For a fixed incumbent and neighborhood, once all candidate objective values have been computed, classical table minimum is at least as good as any sampled candidate from that table. This is a direct mathematical obstruction to claiming an optimization benefit from the current dense-oracle prototype. Improving the amplitude-amplification percentage cannot remove it.

## What should change next

1. Keep the existing allocation path classical. A clear LP/flow formulation is the strongest explanation of the current task, not a weakness to hide.
2. If an operational partner confirms route activation decisions or another genuinely coupled requirement, obtain realistic inputs and acceptable time/quality targets. Benchmark strong classical decomposition and tuned solvers before declaring difficulty.
3. Before further quantum advantage testing, replace dense truth tables with coherent cost/constraint arithmetic and an explicit resource estimate. This is a prerequisite, not evidence that the resulting circuit will win.
4. Develop meaningful coupled neighborhoods and compare them with the same classical replacements. The current random schedule's lack of improvement should not be blamed solely on the sampler.
5. Only after a scalable oracle and a genuinely challenged task exist, test noise, physical circuit resources and end-to-end benefit. Preserve the large time-limited case without treating it as a selected quantum success.

A defensible presentation statement is:

> Quantum is not necessary for our current allocation model. We tested whether a quantum search component improves a hybrid solver, and replacing it with classical optimization preserved solution quality on every tested pair. Our research identifies what must change before a quantum advantage claim becomes testable: a relevant difficult task, affordable quantum oracles, and measured benefit over the strongest classical replacement.

Reproducible commands and all artifacts are indexed in [necessity/README.md](necessity/README.md).
