# Juror 11 — independent final vote after cross-examination

**68/100, unchanged.** Verdict: credible synthetic research demonstrator; insufficient evidence of operational patient benefit or quantum advantage. Category points, shared order: **[6,5,5,4,5,7,6,8,7,3,5,3,2,1,1]**, sum 68.

| Category | Points |
|---|---:|
| Problem | 6/7 |
| User | 5/8 |
| Domain | 5/8 |
| UX | 4/6 |
| Architecture | 5/6 |
| Tests | 7/9 |
| Data | 6/8 |
| Classical | 8/10 |
| QuantumCorrect | 7/10 |
| QuantumContribution | 3/8 |
| Experiments | 5/7 |
| Performance | 3/4 |
| Security | 2/4 |
| Adoption | 1/3 |
| Pitch | 1/2 |

Read released cross-examination docket, Juror 15 initial, and Juror 12 final only after initial ballots were collected. Initial report remains unchanged. No score synchronization.

## Actual challenge and resolution

**Challenge to J15's scope wording: “Eight synthetic cases are independent units” must not be read as eight representative independent operational deployments.** I independently rechecked the raw primary study: eight heldout case IDs, 88 method/case cells, every cell exactly ten seeds, seeds 101–110. Thus each method has 80 runs but only eight case-level contrasts; treating 80 optimizer repeats as independent problem instances would be pseudoreplication. J15's denominator is correct. Independence is a modeling assumption for the case-level sign-flip test, not a demonstrated property of sampled hospital operations: `research/quantum_experiments/instances.py` uses a prespecified small template list and adjacent fixed generation seeds, with common assumptions. `analyze.py` appropriately states symmetry under sign flip and descriptive small-case bootstrap scope. Resolution: retain J15's arithmetic and narrow inference, reject any stronger deployment/generalization interpretation. This distinction reinforces, rather than reduces, my original data score.

**Challenge to any reading of J15's historical “six infeasible MILP records” as a current solver bug.** Independently parsed both saved raw files. `experiments/results/full_review_20261024/production_v2/runs.jsonl` contains 1,410 rows, 1,377 completed, 33 skipped and six `feasibility:false`. `boundary_corrected/runs.jsonl` contains 81 rows, 66 completed, 15 skipped, zero `feasibility:false`. J15 explicitly distinguishes the corrected artifacts and does not establish a current defect; I agree. This fresh check verifies saved status counts, not fresh solver execution. It does not certify that all skipped boundary cases now execute. J12's distinction between hypothetical fixed-dispatch scaling and current production formulation is also material: I do not import the hypothetical nonoptimal solve as a production optimality failure.

## Rationale for no score change

Cross-examination corroborates my strongest findings: strict synthetic inputs, correct main aggregate arithmetic, transparent failed/skipped outcome accounting, and a specific README overcount (three exact matches, not four). Broader experimental controls are favorable, but eight tiny generated cases still cannot validate clinical usefulness, realistic logistics robustness or quantum contribution. The new checks resolve attribution, not a previously scored current defect. My original score did not penalize the six historical boundary records, so no reversal is needed.

## Verification and uncertainty

New command: `PYTHONDONTWRITEBYTECODE=1 ../BloodFlow-Q1/.venv/bin/python` with standard-library JSON/Counter checks of heldout cells and the two boundary artifacts. Exit 0; tool wall time 0.087 seconds. No optimizer benchmark, frontend or server rerun. No application/test/config/result changes. Wrote this new report only.

Confidence high in record counts, denominator distinctions, fixture limitations and README discrepancy; moderate overall. Remaining uncertainties include actual operational provenance, institution/user validation, representative demand and expiry distributions, fair full-cost runtime comparisons, and whether current skipped quantum boundaries are intentional or repairable. Other jurors' live checks remain their evidence, not my execution.

Tough question remains: what independently sourced and prespecified operational workload shows a meaningful improvement over the classical reference after accounting for expiry, correlated demand, institutional variation, preprocessing and all quantum-related costs?
