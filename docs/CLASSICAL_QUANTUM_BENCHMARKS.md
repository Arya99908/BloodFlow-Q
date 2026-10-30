# BloodFlow-Q: Classical and Quantum Benchmark Evidence

Version 2.0 — verified observation-level interpretation.
Contributor history remains in [CONTRIBUTOR_ATTRIBUTION.md](CONTRIBUTOR_ATTRIBUTION.md).

## Reproducible evidence sources

`python3 experiments/build_observatory_evidence.py` produces `frontend/public/observatory-evidence.json` directly from saved experiments. Each source has a SHA-256 checksum. Every normalized observation has its original file and JSONL line, or JSON run index. This generation does not run solvers or manufacture results.

The principal source is `experiments/results/full_review_20261024/production_v2/runs.jsonl`: 1,410 recorded outcomes, including 1,377 completed and 33 skipped. Families remain separate: primary, boundary, full dataset, historical inputs, and demo before/after. Primary methods and ablations have different coverage, so pooled rankings are inappropriate. Pair by scenario, family, and seed; inspect per-scenario results and failures.

`frontend/public/comparative-evidence.json` remains an aggregate historical summary. It cannot by itself support observation-level distributions or paired statistical tests.

## Historical warm-start comparison

Source: `audit/warm_qaoa_verified_results.json`, penalty 248, variants `tuned_standard_more_compute` and `tuned_warm_more_compute`. The fixture is synthetic: one bank, one hospital, group O, inventory 12, demand 4, transport cost 4.5 and travel time 18 minutes. The bounded formulation contains 10 qubits. Its demand register has 3 bits, shipment register 3 bits, and inventory slack register 4 bits.

Both variants use p=2, three restarts, COBYLA capped at 80 evaluations per restart, normalized Hamiltonian, and 512 final shots per run. Warm epsilon is 0.1. Final sampling uses local Aer; the LP seed already has the exact optimal objective 25.2.

| Seed | Standard optimal shots | Warm optimal shots |
|---|---:|---:|
| 7 | 1 / 512 | 275 / 512 |
| 11 | 7 / 512 | 301 / 512 |
| 19 | 4 / 512 | 260 / 512 |
| Mean probability | 0.78125% | 54.427083% |

The absolute difference is **53.645833 percentage points**. The ratio computed before rounding is **69.666667×**. The approximate 69.8× headline results from dividing rounded display percentages 54.43/0.78 and is not the precise observation-derived ratio.

Both presets found the same optimal objective in all three runs. This is an improvement in optimal-shot density over another quantum initialization, not an objective improvement over the classical optimum or a quantum speedup. Three seeds on one hand-selected synthetic instance support a narrow demonstration, not a population-level superiority claim. Show each paired observation; any across-seed interval describes optimizer variability, not clinical effectiveness. Do not pool these rows with other protocols.

## Classical baselines and timing

In the full-review primary family, 75 LP observations have wall times 0.485–1.015 ms (mean 0.771 ms). The 75 MILP observations span 0.588–8.721 ms (mean 2.759 ms). Both have zero recorded objective gap against available exact references. Therefore a blanket claim that every HiGHS MILP run finishes below 3 ms is unsupported. Timing applies to the saved machine and protocol.

`wall_seconds` includes QUBO construction and the solver pipeline where applicable; independent analysis is explicitly excluded. Some solver timing fields overlap and must not be summed. Skipped-row elapsed bookkeeping is retained separately, never plotted as a completed solve. The separate research study distinguishes cached-run timing from a standalone pipeline including synthesis.

## Feasibility and objective metrics

- Returned-solution feasibility is a Boolean validation of the allocation returned by the run.
- `feasible_shot_rate` in the full review is operational allocation/shortage feasibility.
- `final_feasible_probability` is the exact statevector probability under strict encoded equality masks.
- `optimal_shot_rate` uses the strict optimal encoded mask on recorded counts.

These definitions differ; they are not interchangeable estimates of one quantity. Finding one optimum within many shots also differs from per-shot optimal probability.

Objective gaps are computed only for feasible results with an exact reference. Relative gaps divide by the absolute reference objective; nonzero gaps at a zero reference are undefined. Missing measurements remain null. Charts must display units and sample size, preserve unfavorable results, and identify the selected scenario and protocol.

## Conditional integrality result

Source inspection of `optimization/milp.py` shows one demand equality and one inventory inequality per appropriate hospital/group and bank/group. Negating inventory rows gives each shipment column one +1 and one −1. Shortage and slack columns are signed unit columns; integer variable bounds preserve the integral flow polytope. Compatibility and unavailable routes remove variables.

With integer supplies, demands and bounds, this network matrix is totally unimodular and a nonempty bounded feasible LP has an integral optimal vertex for the linear objective. Not every optimal point must be integral: tied vertices can have fractional convex combinations. Numerical solutions still require validation.

This establishes a strong classical LP baseline for the current single-period model. It does not prove that quantum algorithms can never have any theoretical advantage, nor justify the previously stated generic O(V²E) runtime for simplex/interior-point methods. Adding coupled activation constraints, nonlinear terms, or other model changes requires a new structural analysis. Harder models alone do not establish quantum utility.

## Scaling and physical hardware

Supplementary scaling retains actual tested sizes, classical timings, completed quantum runs, and explicit skips. Analytical statevector storage estimates are labeled separately from measured process RSS. No extrapolated runtime is supplied. Basis-decomposed resource measurements are all-to-all and unrouted; they do not establish physical device compatibility or execution. See [Quantum Hardware Readiness](QUANTUM_HARDWARE_READINESS.md).

All conclusions concern synthetic computational experiments. They do not validate clinical effectiveness or demonstrate physical quantum advantage.
