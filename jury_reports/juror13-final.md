# Juror 13 — independent final ballot

**Final score 70/100, unchanged.** Category points in prescribed order: [6,5,5,4,5,7,5,8,8,4,5,2,3,2,1]. Verdict: technically substantial, candid synthetic research prototype / credible contender, not a demonstrated winning quantum optimizer. High confidence in inspected quantum behavior; medium confidence overall.

The initial ballot is retained unchanged. After all initial ballots were sealed, I read the cross-examination docket and Jurors 14/15 initial reports, then independently checked the material points below. No score was aligned to any panel target.

## Cross-examination and resolution

**Challenge to Juror 15:** Does its PASS for the primary study survive the research/production XY mismatch I reproduced? A saved completed record alone cannot prove parity. I rebuilt only QUBO graphs (no expensive optimizer reruns) for all seven training and eight heldout generator cases using current `research/quantum_experiments/instances.py` and production `_compute_xy_pairs`. Every graph is nonempty: training qubits/pairs = 10/12, 7/9, 8/10, 6/6, 9/11, 13/15, 13/21; heldout = 4/5, 8/12, 8/16, 10/18, 13/21, 6/9, 7/13, 12/24. I independently parsed both original `research/quantum_experiments/results/study/runs.jsonl` and later `experiments/results/full_review_20261024/research_study/runs.jsonl`: each contains 188 XY/warm-XY rows, minimum four qubits, zero one-qubit rows.

**Resolution:** The verified empty-graph defect does NOT invalidate those particular study results. It remains a real boundary correctness defect and invalidates a universal simulator-equivalence claim. Juror 15's narrow historical arithmetic/paired-results PASS is compatible with my finding. Recorded Qiskit parity fields are historical evidence, not newly rerun statevectors; broader experimental reproducibility is not certified by checking this edge case.

**Challenge to Juror 14:** Its warm-start discussion says “clipping changes probabilities.” Production `quantum/qaoa_solver.py:247` actually first performs affine shrinkage epsilon + (1−2epsilon)*p, then clips only to numerical [.0001,.9999] bounds. For example epsilon=.1 and raw p=.25 yields .3; ordinary epsilon clipping would leave .25. Thus describe the implementation as affine regularization of binary marginals, not simply epsilon clipping or a literal replication of the literature construction. This correction strengthens, rather than overturns, Juror 14's point that theoretical guarantees do not transfer automatically. Correlation loss and the need for seed-only controls remain.

**Evidence qualification:** My initial statement “no noisy execution” applies to the production solver and my new tests. Juror 15 identified 27 historical supplementary Aer gate-noise records; those must be separately labeled as saved noisy-simulator research, not physical hardware and not my fresh execution. I have not independently rerun them. Do not let my bounded production conclusion erase this separate research path.

## Final independent judgment

Score unchanged because the follow-up narrows the scope of a P2 defect without demonstrating new general quantum benefit or removing the feasibility/method-attribution concerns already priced into the initial score. Keep all initial executed tests, timings, strengths and weaknesses. The production XY gate implementation is mathematically legitimate excitation-preserving mixing; its inability to preserve allocation feasibility is a documented limitation, not itself a broken gate.

Remaining uncertainty: effect of the empty-graph defect on any datasets beyond the two checked study directories; supplementary noisy-run reproducibility; general warm-start benefit after all preprocessing and equal-budget classical controls. Recommended correction: add explicit empty-graph simulator/circuit parity tests and remove the research fallback, and state affine warm regularization precisely. Toughest question remains: what quantum-derived improvement survives a matched classical seed/search replacement and full end-to-end accounting?
