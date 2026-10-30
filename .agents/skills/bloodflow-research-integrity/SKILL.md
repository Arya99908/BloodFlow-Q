---
name: bloodflow-research-integrity
description: Verify BloodFlow-Q scientific claims, paired statistics, experiment provenance, and simulator-versus-hardware interpretations before publishing research numbers or changing evidence adapters.
---

# BloodFlow-Q research integrity

Treat reports as claims to verify against code and raw artifacts. Locate the current repository root before resolving the following paths.

## Trace a metric

1. Read the displayed metric's adapter and its source locator. The primary observatory source is `experiments/results/full_review_20261024/production_v2/runs.jsonl`; `experiments/build_observatory_evidence.py` exports raw observations and SHA-256 source fingerprints to `frontend/public/observatory-evidence.json`.
2. Check the source row's scenario, family, solver, seed, status, configuration, objective basis and timing scope. Recompute from raw observations. A summary-only dataset cannot support new paired distributions or confidence intervals.
3. Pair on experiment family, scenario and seed with matching relevant controls. Report unmatched/failed observations rather than silently dropping them from success denominators. Compare feasible objective values only; missing objectives and undefined relative gaps stay null. A zero reference with nonzero absolute gap has undefined relative gap.
4. Report mean, median, interquartile range, sample size and per-scenario results when relevant. State the confidence-interval method and statistical unit. Across-seed variability on fixed synthetic cases does not estimate clinical effectiveness or generalize to new scenarios. Shot-level binomial uncertainty and across-run uncertainty are distinct.
5. Regenerate derived evidence and run evidence/adapter tests after changing extraction or interpretation. Confirm source hashes and locators still match the checked-in artifact.

## Historical warm-start claim

`audit/warm_qaoa_verified_results.json` contains multiple variants and penalties. The reported comparison selects penalty **248**, variants `tuned_standard_more_compute` and `tuned_warm_more_compute`: three paired seeds, 512 shots each, p=2, three restarts, at most 80 optimizer iterations, warm epsilon 0.1. Read the actual configuration before reusing these conditions.

Compute means from `optimal_shot_rate`, not `feasible_shot_rate`; derive percentage-point difference and ratio from unrounded means. The approximately 0.78% versus 54.43% result concerns one synthetic case and optimal-bitstring shot density. Its LP seed already attains the reference objective. It is not quantum computational advantage, speedup, or evidence of better clinical outcomes.

## Mathematical and hardware claims

- Verify integrality against the precise allocation constraints in `optimization/models.py`, `optimization/milp.py` and the independent validator. Total unimodularity of the stated bipartite flow formulation does not automatically extend to future coupling, routing, expiry or capacity constraints.
- Distinguish operational allocation feasibility from strict QUBO equalities, sampled counts from exact statevector probabilities, and QAOA layer parameter p from compiled circuit depth.
- `execution_examples` exposes measured Aer compilation metadata. `basis_resources` originates from separate `research/quantum_experiments/results/study/*_case.json` fixtures; its basis/connectivity/status fields define its scope. All-to-all, unrouted basis synthesis is not a device-specific transpilation certificate.
- `scaling` originates from `research/quantum_experiments/results/supplementary/scaling.jsonl`. Analytical statevector bytes are estimates, while recorded peak process RSS is a measured high-water mark. Keep those separate and retain skipped-size reasons.
- Physical hardware execution requires a verifiable backend/job result. Without it, say local simulation; hardware-compatible gates alone do not establish QPU execution. Draw a circuit only from recorded operations; counts and depth do not determine its wiring.

Preserve contributor attribution and raw artifacts. Complete a claim review with its source locator, calculation, scope, and limitations, including contradictory or unfavorable observations.
