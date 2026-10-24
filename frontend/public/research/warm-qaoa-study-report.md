# Warm-Start QAOA — Paired Experiment

> Integration note (24 October 2026): the 120-run JSON is an unchanged historical snapshot imported from `BloodFlow-Q1-codex-warm-qaoa-integration`. Its source hashes identify that study's original code, not this updated checkout. New runs record current source hashes and must use a fresh run ID. The broader October 23 research remains a separate study.


This report describes the recorded six-case, synthetic local-simulator study. It is not a hardware benchmark and does not establish quantum advantage.

## Protocol

Standard uniform-start and LP warm-start QAOA were run with paired seeds 301–310, depth `p=1`, 64 shots, COBYLA, eight optimizer iterations, one restart, and cost normalization. Both variants used the same synthetic instances and budgets. All 120 method-runs completed, producing 60 matched seed pairs. Feasible-shot rate counts every measured shot in its denominator; candidates are independently decoded and validated and are not repaired.

## Measured outcomes

| Synthetic case | Standard feasible shots | LP warm-start | Paired change (95% bootstrap interval) | Exact optimum runs, standard / warm |
|---|---:|---:|---:|---:|
| Normal reference | 25.6% | 37.8% | +12.2 pp [6.7, 17.0] | 8/10 / 10/10 |
| Inventory shortage | 14.2% | 28.6% | +14.4 pp [12.0, 16.7] | 9/10 / 10/10 |
| Demand below inventory | 39.1% | 42.5% | +3.4 pp [−4.4, 10.9] | 10/10 / 10/10 |
| Transport disruption | 10.0% | 45.8% | +35.8 pp [25.3, 47.5] | 7/10 / 10/10 |
| Critical shortage | 10.6% | 24.8% | +14.2 pp [10.5, 18.0] | 7/10 / 10/10 |
| Emergency demand spike | 6.6% | 12.8% | +6.2 pp [3.4, 9.2] | 4/10 / 10/10 |

All six point estimates favor warm-start, but the demand-below-inventory paired interval crosses zero. The LP preprocessing itself is a strong classical method and often finds the exact solution; these measurements show sampling behavior after that classical preprocessing, not quantum advantage. Warm-start does not beat the exact reference on these cases.

The [raw recorded results](/warm-qaoa-paired-20261022.json) and [reproduction instructions](warm-qaoa-reproducibility.md) are available with this report.

The October 24 integration check completed 120 runs with both implementations in the same macOS environment: counts, feasible-shot rates, best feasible objectives, and seed objectives matched for every pair. Against the historical Windows snapshot, 97/120 count histograms matched exactly. Platform/Python differences remain, so bitwise cross-platform reproduction is not claimed. All 60 current warm runs still found an exact optimum.
