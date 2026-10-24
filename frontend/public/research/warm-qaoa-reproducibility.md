# Reproducing the paired warm-start study

> Integration note (24 October 2026): the 120-run JSON is an unchanged historical snapshot imported from `BloodFlow-Q1-codex-warm-qaoa-integration`. Its source hashes identify that study's original code, not this updated checkout. New runs record current source hashes and must use a fresh run ID. The broader October 23 research remains a separate study.


From the repository root, activate the project's Python environment and run:

```powershell
python -m experiments.run_warm_qaoa_comparison --scenarios 6 --seeds 10 --seed-start 301 --p 1 --shots 64 --max-iterations 8 --run-id warm-qaoa-reproduction
```

Choose a new `--run-id` each time; the runner refuses to overwrite prior results. It writes raw runs under `experiments/results/` and the full settings and synthetic instances under `experiments/configurations/`. The report UI reads the recorded snapshot `frontend/public/warm-qaoa-paired-20261022.json`.

The protocol uses ten paired seeds (301–310) per scenario, six synthetic cases, depth 1, 64 shots, COBYLA, eight optimizer iterations, one restart, and cost normalization. Every run's measured candidates are independently checked; infeasible shots remain in the denominator. Preserve the JSON and configuration together with the code revision and environment versions when reproducing.

See the [experiment report](warm-qaoa-study-report.md) for measured results and limitations. These small local simulator results do not establish quantum advantage, hardware performance, or clinical validity.

The October 24 integration check completed 120 runs with both implementations in the same macOS environment: counts, feasible-shot rates, best feasible objectives, and seed objectives matched for every pair. Against the historical Windows snapshot, 97/120 count histograms matched exactly. Platform/Python differences remain, so bitwise cross-platform reproduction is not claimed. All 60 current warm runs still found an exact optimum.
