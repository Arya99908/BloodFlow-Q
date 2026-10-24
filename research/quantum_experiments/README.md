# BloodFlow-Q quantum research

Start with [the improvement report](QUANTUM_IMPROVEMENT_REPORT.md). The [plan](RESEARCH_PLAN.md), [primary literature review](LITERATURE_REVIEW.md), [algorithm comparison](ALGORITHM_COMPARISON.md), and [next experiments](NEXT_RESEARCH_STEPS.md) separate evidence from proposals. Production files and historical outputs are unchanged.

## Reproduce

Run from the repository root. Use the project environment and dependencies documented in the repository startup guide. Recorded versions: Python 3.14.7, NumPy 2.5.4, SciPy 1.18.1, Qiskit 2.6.0, Qiskit Aer 0.17.2. Use the project's existing dependency installation for a fresh environment and inspect the saved protocol before claiming exact numerical reproduction across versions. No new quantum dependencies were installed for this study.

```sh
python -m unittest discover -s tests
python -m unittest discover -s research/quantum_experiments/tests
python -m research.quantum_experiments.run_study --pilot --output research/quantum_experiments/results/new_pilot
python -m research.quantum_experiments.run_study --output research/quantum_experiments/results/new_study
python -m research.quantum_experiments.analyze --input research/quantum_experiments/results/new_study
python -m research.quantum_experiments.supplementary --output research/quantum_experiments/results/new_supplementary
python -m research.quantum_experiments.verify_production --output research/quantum_experiments/results/new_production_controls.jsonl
```

Raw-output writers refuse to replace existing files. Use a fresh output directory for each rerun. Analysis regenerates `analysis.json` within its selected study directory. The full primary study took approximately 122 seconds locally; hardware and environment affect this. The plan records caps: original full encodings at most 14 qubits, reduced simulation at most 12, dense reduced synthesis at most eight. Supplementary skips are intentional records, not missing successful experiments.

## Evidence map

- `experiments/results/full_review_20261024/`: recorded experiment runs, protocols and analysis summaries for the October 24 review.
- The archived October 24 output directory retains failed, skipped and completed runs alongside their protocol metadata.
- Run regression tests separately; the experiment validation artifacts do not replace software tests.
- `experiments/results/full_review_20261024/research_study/protocol.json`: versions, original code hashes, methods, seeds, budgets.
- `experiments/results/full_review_20261024/research_study/*_case.json`: complete instance inputs, classical controls, encoding checks, resource estimates and initial controls.
- `experiments/results/full_review_20261024/research_study/runs.jsonl`: all 992 per-run records, parameters, measurements, exact metrics, histories and timings.
- `experiments/results/full_review_20261024/research_study/transfer_training.json`: shared training cost and parameters; include this when comparing transfer methods.
- `experiments/results/full_review_20261024/research_study/analysis.json`: per-case/aggregate intervals and all three planned corrected contrasts.
- `experiments/results/full_review_20261024/production/runs.jsonl`: 32 calls to unchanged production solver; exact circuit cross-checks, original counts and optimizer output.
- `experiments/results/full_review_20261024/supplementary/grover.jsonl`: 240 fixed-threshold amplitude-amplification measurement records.
- `experiments/results/full_review_20261024/supplementary/scaling.jsonl`: 36 optimized scaling runs and two resource-limit skips.
- `experiments/results/full_review_20261024/supplementary/aer_noise.jsonl`: 27 measured circuit-level gate-noise records.
- `research/quantum_experiments/literature/literature_matrix.json`: 22 primary-paper references and access logs; downloaded paper copies were deliberately excluded, and the matrix links to the primary sources. Targeted full-text reading is documented per paper.

`encodings.py`, `algorithms.py`, `grover_search.py`, `metrics.py`, and `classical.py` implement the isolated prototypes. `tests/test_research.py` supplies independent circuit and domain checks. Dense enumeration is an explicit research limitation. No hardware advantage, clinical validity, or operational deployment is claimed.
