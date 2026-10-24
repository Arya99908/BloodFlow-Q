# Paired LP warm-start QAOA study

> Integration note (24 October 2026): the 120-run JSON is an unchanged historical snapshot imported from `BloodFlow-Q1-codex-warm-qaoa-integration`. Its source hashes identify that study's original code, not this updated checkout. New runs record current source hashes and must use a fresh run ID. The broader October 23 research remains a separate study.


## Question and scope

Does a continuous LP-derived warm-start state increase the probability that a small, depth-1 local QAOA run measures an operationally feasible allocation, compared with standard uniform-start QAOA under the same seed and optimizer budget? This is a six-case synthetic simulator study. It is not a hardware benchmark or evidence of quantum advantage.

## Model and validation

For each eligible compatible bank-to-hospital shipment, the model has a bounded integer variable `x[b,h,g,r]`. It also has unmet-demand variables `u[h,r]` and inventory slack variables `s[b,g]`. Incompatible and unavailable-route shipments are omitted. The QUBO enforces `sum(x into h,r) + u[h,r] = demand[h,r]` and `sum(x from b,g) + s[b,g] = inventory[b,g]` with squared penalties. Each bounded integer uses the repository's shortened binary weights, whose total equals its upper bound.

The operational minimization objective is the sum of priority-weighted high/critical unmet demand, total unmet demand, per-unit transport cost, per-unit travel time, and configured secondary penalties. The experiment uses weights `(10, 5, 1, 0.1, 0)`, with both equality penalties at `10,000`. QUBO penalty energy is not reported as operational cost. Aer's measured strings are reversed from Qiskit's display order, mapped through the variable map, decoded, and independently checked against inventory, demand accounting, route, compatibility, and objective rules. Raw measured results are never repaired.

## Warm-start method

SciPy HiGHS solves a continuous LP relaxation. Each relaxed bounded integer value is mapped to marginals by interpolating the valid encodings of its adjacent integers. Integral values therefore use deterministic valid encodings; fractions preserve expected value before affine epsilon regularization (`epsilon = 0.25`). The circuit prepares each qubit with `Ry(theta)`, where `theta = 2 asin(sqrt(p))`, and applies the matching product-state mixer `Ry(theta) Rz(2 beta) Ry(-theta)` (rightmost operation first). This custom mixer preserves the prepared product state when the cost phase is zero. It is not feasibility-preserving: product preparation loses cross-register correlations, and measured samples may violate the model.

If LP initialization fails, the implementation uses only a deterministic greedy allocation that passes the independent validator; if that also fails, it records a uniform-state fallback. It does not use an exact MILP optimum to seed QAOA. Cost coefficients are divided by a positive maximum coefficient scale for the optimizer; reported energies and objective metrics are returned in original units. A single restart is used in this comparison.

## Protocol and results

Six cases were evaluated: normal reference, inventory shortage, demand below inventory, transport disruption, critical shortage, and the actual backend emergency demand-spike event (demand raised to 16 synthetic units). The first five reuse the existing compact one-bank/one-hospital templates. All instances fit the configured 16-qubit simulator limit; the emergency case uses 13 qubits. For each scenario, standard and warm-start QAOA share seeds 301–310, `p=1`, 64 shots, COBYLA, eight optimizer iterations, one restart, and cost normalization. Thus 120 runs were attempted; all 120 completed. Exact enumeration supplied independently validated references for all six tiny cases.

Feasible-shot rates are averaged across the ten paired seeds. The 95% interval is a deterministic 10,000-resample paired bootstrap percentile interval for the warm-minus-standard difference, keeping the seed pair intact. The objective column counts how many per-run best feasible samples equaled the exact reference. Runtime is the median QAOA end-to-end time, including classical LP setup for the warm variant.

| Synthetic case | Standard feasible shots | LP warm-start feasible shots | Paired change (95% bootstrap interval) | Seeds warm better / tied / worse | Exact objective found, standard / warm | Median runtime, standard / warm |
|---|---:|---:|---:|---:|---:|---:|
| Normal reference | 25.6% | 37.8% | +12.2 pp [6.7, 17.0] | 9 / 0 / 1 | 8 / 10 | 107.8 / 110.6 ms |
| Inventory shortage | 14.2% | 28.6% | +14.4 pp [12.0, 16.7] | 10 / 0 / 0 | 9 / 10 | 127.4 / 127.2 ms |
| Demand below inventory | 39.1% | 42.5% | +3.4 pp [−4.4, 10.9] | 5 / 1 / 4 | 10 / 10 | 139.4 / 139.7 ms |
| Transport disruption | 10.0% | 45.8% | +35.8 pp [25.3, 47.5] | 10 / 0 / 0 | 7 / 10 | 122.2 / 129.4 ms |
| Critical shortage | 10.6% | 24.8% | +14.2 pp [10.5, 18.0] | 10 / 0 / 0 | 7 / 10 | 134.9 / 136.6 ms |
| Emergency demand spike | 6.6% | 12.8% | +6.2 pp [3.4, 9.2] | 8 / 2 / 0 | 4 / 10 | 209.4 / 219.8 ms |

All six point estimates favor LP warm-start, although the small demand-below-inventory case has an interval crossing zero. LP warm-start found the exact objective in 10/10 runs in every case, while standard QAOA found it in 4–10 runs depending on the case. This should be interpreted cautiously: the LP preprocessing solves a strong classical relaxation and often supplies the optimal allocation itself, so the result measures how strongly a biased circuit samples a good classical seed. Warm-start runtime is generally slightly higher, especially for the emergency case. On these tiny cases, the measured gain is feasibility/solution-sampling reliability; it does not show a better objective than the trusted exact solver or any quantum advantage.

The result file keeps each seed, raw count histogram, candidate-level operational validation, feasible-shot numerator/denominator, seed source and objective, exact gap, optimizer evaluations and compiled circuit depth/two-qubit gate count. Failures would remain rows with null metrics rather than being imputed. There were no failed or size-skipped runs in this set. This experiment does not test larger multi-bank/multi-hospital scaling, penalty sensitivity, XY/CVaR mixers, hardware, or parameter transfer.

## Artifacts and reproduction

- Raw results: [`experiments/results/warm-qaoa-paired-20261022.json`](../experiments/results/warm-qaoa-paired-20261022.json)
- Full configuration and synthetic instances: [`experiments/configurations/warm-qaoa-paired-20261022.json`](../experiments/configurations/warm-qaoa-paired-20261022.json)
- Browser research snapshot: [`frontend/public/warm-qaoa-paired-20261022.json`](../frontend/public/warm-qaoa-paired-20261022.json)
- Runner: [`experiments/run_warm_qaoa_comparison.py`](../experiments/run_warm_qaoa_comparison.py)

Reproduce from the repository root in the project Python environment:

```powershell
python -m experiments.run_warm_qaoa_comparison --scenarios 6 --seeds 10 --seed-start 301 --p 1 --shots 64 --max-iterations 8 --run-id warm-qaoa-reproduction
```

The runner refuses to replace existing files with the same run ID. It records the actual simulator, dependency versions, input instances, objective and penalty weights, exact references, and SHA-256 hashes of the relevant source and data files. The browser snapshot is intentionally a separate consumer artifact copied from the raw experiment output.

## Research sources and next steps

The warm-start state and mixer follow the product-state construction discussed by Egger, Mareček, and Woerner, *Warm-starting quantum optimization* ([Quantum, 2021](https://quantum-journal.org/papers/q-2021-06-17-479/)). This implementation adapts the initialization to bounded integer registers; it does not claim their binary-variable approximation theorem transfers to the complete allocation problem. A future constraint-preserving mixer must preserve the model's inventory and demand equalities and connect the relevant feasible states; a plain Hamming-weight-preserving XY exchange is insufficient. Next experiments should isolate LP initialization from greedy, parameter initialization, penalty choice, and circuit depth on held-out larger instances, while comparing against serious MILP and exact baselines under matched budgets.

The October 24 integration check completed 120 runs with both implementations in the same macOS environment: counts, feasible-shot rates, best feasible objectives, and seed objectives matched for every pair. Against the historical Windows snapshot, 97/120 count histograms matched exactly. Platform/Python differences remain, so bitwise cross-platform reproduction is not claimed. All 60 current warm runs still found an exact optimum.
