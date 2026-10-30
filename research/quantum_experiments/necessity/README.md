# Does the quantum component contribute?

Read [WHY_QUANTUM_REPORT.md](../WHY_QUANTUM_REPORT.md) for the outcome and [NECESSITY_EVIDENCE.md](../NECESSITY_EVIDENCE.md) for the structural argument and primary-source checks. This follow-up preserves all prior artifacts and production files.

## Reproduce from the repository root

Use the existing environment; system Python lacks Qiskit.

```sh
.venv/bin/python -m unittest research.quantum_experiments.tests.test_necessity -v
.venv/bin/python -m research.quantum_experiments.necessity.run --pilot --output experiments/results/fresh_necessity_pilot
.venv/bin/python -m research.quantum_experiments.necessity.run --output experiments/results/fresh_necessity
.venv/bin/python -m research.quantum_experiments.necessity.analyze --input experiments/results/fresh_necessity
```

Raw files require a fresh output directory. Analysis writes analysis.json in its selected directory. The saved study can be audited with `.venv/bin/python -m research.quantum_experiments.necessity.validate --input experiments/results/full_review_20261024/necessity`; this checks the recorded allocations. Recorded Python/dependency versions and code hashes are in each protocol.json. Wall-clock limits can change results across machines; evaluate reproducibility with saved decisions and actual timings rather than promising identical outcomes across platforms.

## Artifacts

- `PROTOCOL.md`: pre-run design. An arithmetic error in its scaling row count is corrected explicitly in the report: four sizes × two seeds × two variants = 16 cases, each with LP and MILP (32 solver calls).
- `model.py`: equivalent linear shipment formulation; isolated optional fixed route fee. Every returned allocation is validated against production constraints/objective plus an independent active-route fee calculation.
- `ablation.py`: identical variable neighborhood selection and wrapper; MILP, classical table minimum, uniform sampling, bounded adaptive amplitude sampling. Tests compare actual Qiskit circuit probabilities with the simulator kernel.
- `run.py`: frozen synthetic instances, budgets, seeds, paired formulations, global controls and scaling.
- `analyze.py`: case-level descriptive intervals and all paired outcomes. No significance or equivalence claim from repeated seeds.
- `experiments/results/full_review_20261024/necessity/cases.jsonl`: 12 complete synthetic cases and global references.
- `experiments/results/full_review_20261024/necessity/runs.jsonl`: 240 hybrid runs; all 960 rounds include selected variables, allocations, search attempts, work counters, costs and budget overruns.
- `experiments/results/full_review_20261024/necessity/scaling.jsonl`: 16 larger cases; full LP/MILP status, lower bounds, incumbent allocations and input data. A time-limited solution is not labeled optimal.
- `experiments/results/full_review_20261024/necessity/analysis.json`: machine-readable aggregates and paired differences.

This is ideal circuit simulation with dense table construction, not a scalable oracle or hardware demonstration. Fixed fees describe an explicitly hypothetical research extension. Positive objective gaps for the hybrid reflect its limited neighborhood schedule; full-model classical optimization is included and may outperform every hybrid method.
