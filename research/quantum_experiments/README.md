# BloodFlow-Q quantum research

Start with [the improvement report](QUANTUM_IMPROVEMENT_REPORT.md). The [plan](RESEARCH_PLAN.md), [primary literature review](LITERATURE_REVIEW.md), [algorithm comparison](ALGORITHM_COMPARISON.md), and [next experiments](NEXT_RESEARCH_STEPS.md) separate evidence from proposals. Production files and historical outputs are unchanged.

## Reproduce

Run from the repository root. This machine's existing environment is `../BloodFlow-Q1/.venv/bin/python`; system `python3` lacks Qiskit. Recorded versions: Python 3.14.7, NumPy 2.5.4, SciPy 1.18.1, Qiskit 2.6.0, Qiskit Aer 0.17.2. Use the project's existing dependency installation for a fresh environment and inspect the saved protocol before claiming exact numerical reproduction across versions. No new quantum dependencies were installed for this study.

```sh
../BloodFlow-Q1/.venv/bin/python -m unittest discover -s tests
../BloodFlow-Q1/.venv/bin/python -m unittest discover -s research/quantum_experiments/tests
../BloodFlow-Q1/.venv/bin/python -m research.quantum_experiments.run_study --pilot --output research/quantum_experiments/results/new_pilot
../BloodFlow-Q1/.venv/bin/python -m research.quantum_experiments.run_study --output research/quantum_experiments/results/new_study
../BloodFlow-Q1/.venv/bin/python -m research.quantum_experiments.analyze --input research/quantum_experiments/results/new_study
../BloodFlow-Q1/.venv/bin/python -m research.quantum_experiments.supplementary --output research/quantum_experiments/results/new_supplementary
../BloodFlow-Q1/.venv/bin/python -m research.quantum_experiments.verify_production --output research/quantum_experiments/results/new_production_controls.jsonl
```

Raw-output writers refuse to replace existing files. Use a fresh output directory for each rerun. Analysis regenerates `analysis.json` within its selected study directory. The full primary study took approximately 122 seconds locally; hardware and environment affect this. The plan records caps: original full encodings at most 14 qubits, reduced simulation at most 12, dense reduced synthesis at most eight. Supplementary skips are intentional records, not missing successful experiments.

## Evidence map

- `results/source_snapshot.json`: before-work SHA256 of 113 existing source/evidence files; final integrity checks ensure they are unchanged.
- `results/historical_reproduction.json`, `baseline_verification.json`: reproduced historical records and comparison scope; the original historical runner is under `experiments/`.
- `results/final_legacy_tests.log`, `final_research_tests.log`: 164 existing and 14 added tests.
- `results/study/protocol.json`: versions, original code hashes, methods, seeds, budgets.
- `results/study/*_case.json`: complete instance inputs, classical controls, encoding checks, resource estimates and initial controls.
- `results/study/runs.jsonl`: all 992 per-run records, parameters, measurements, exact metrics, histories and timings.
- `results/study/transfer_training.json`: shared training cost and parameters; include this when comparing transfer methods.
- `results/study/analysis.json`: per-case/aggregate intervals and all three planned corrected contrasts.
- `results/production_controls.jsonl`: 32 calls to unchanged production solver; exact circuit cross-checks, original counts and optimizer output.
- `results/supplementary/grover.jsonl`: 240 fixed-threshold amplitude-amplification measurement records.
- `results/supplementary/scaling.jsonl`: 36 optimized scaling runs and two resource-limit skips.
- `results/supplementary/aer_noise.jsonl`: 27 measured circuit-level gate-noise records.
- `literature/literature_matrix.json`: 22 primary papers; `literature/sources/` and access logs preserve inspected material. Targeted full-text reading is documented per paper.

`encodings.py`, `algorithms.py`, `grover_search.py`, `metrics.py`, and `classical.py` implement the isolated prototypes. `tests/test_research.py` supplies independent circuit and domain checks. Dense enumeration is an explicit research limitation. No hardware advantage, clinical validity, or operational deployment is claimed.
