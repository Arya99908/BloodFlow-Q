# Juror 14 — independent final ballot

**66/100, unchanged.** Category points in prescribed order: **[6,5,5,4,5,7,5,8,8,3,4,2,2,1,1]**. Sum 66. Verdict: credible synthetic quantum-optimization research demonstration; quantum necessity and advantage are not established. Confidence remains high for inspected quantum/literature applicability, medium for experiments, lower for product categories outside my remit.

After the initial ballot was sealed, I read the cross-examination docket and J13-final/J12-final. I then independently inspected `quantum/qaoa_solver.py:235-255`, `optimization/milp.py:221-349`, `optimization/objective.py:227-247`, and `research/quantum_experiments/supplementary.py`. No application file was changed, and no new optimizer, hardware or browser test was run. Other jurors' executions remain their evidence, not mine. The initial report and its seven verified primary citations remain intact.

## Correction accepted from Juror 13

My initial warm-start description “clipping changes probabilities” was imprecise. Production first applies **affine shrinkage**:

`regularized = clip(epsilon + (1 - 2*epsilon)*bit_probabilities, 1e-4, 1 - 1e-4)`

At epsilon=.1, raw probability .25 becomes .3, whereas ordinary clipping to [.1,.9] leaves .25 unchanged. The outer clip is a numerical safeguard; the affine map is the systematic modification. Extremely small permitted epsilon can also activate the safeguard at endpoints. The correct description is **affine-regularized binary marginals followed by numerical clipping**, not a literal epsilon-clipped replication of the warm-start paper. Correlation loss and nonautomatic transfer of guarantees remain valid findings. This precision correction does not change the assigned quantum-correctness or contribution points.

## Challenge to Juror 12: how far does “already optimal LP solution” go?

I challenged the scope of the final claim that quantum must add value beyond an already optimal LP solution: does the current formulation genuinely retain an integral network structure, and would that establish that quantum advantage is impossible?

Independent source inspection confirms each shipment column participates in one supply row and one recipient-demand row. Multiplying supply rows by minus one gives incidence-style columns; unmet variables add unit columns, inventory slack can add unit columns, and shipment bounds are integral. The linear objective includes transport, unmet penalties and a constant secondary term. No fixed-charge dispatch coupling appears in this production relaxation. Therefore an integral optimal vertex exists for valid integer data, consistent with J12's careful formulation. This is mathematical source reasoning; I did not repeat J12's reported 100-case test.

**Resolution:** J12's structural conclusion is well founded for this model. It does **not** mean every point on a degenerate optimal face is integral, every solver output is automatically numerically valid, or every possible quantum speed improvement has been ruled out. The decisive distinction is that optimal objective quality cannot be improved beyond a certified classical optimum; a speed/resource claim would require its own scaling and end-to-end evidence. Polynomial classical solvability makes the motivation harder, but is not a universal impossibility theorem for quantum speedup. The conclusion does not extend automatically to hypothetical fixed-charge or other added coupling constraints.

This sharpens my initial recommendation: establish and exploit the network-flow structure before enlarging the quantum benchmark. “No demonstrated advantage” is warranted; “quantum advantage is mathematically impossible” is not.

## Challenge to the noisy-experiment interpretation

J13 correctly qualifies production ideal execution separately from historical supplementary gate-noise records. I challenged whether those records, as referenced in the docket, support noisy **training** rather than merely noisy final execution.

Independent inspection of `research/quantum_experiments/supplementary.py` resolves it: `angles,opt=optimize(a)` precedes circuit compilation and the loop constructing Aer depolarizing noise models. Optimized angles are then reused across error rates and sampling seeds. The path implements circuit-level gate-noise sampling of an ideally trained circuit, not noise-aware variational optimization. Its note also explicitly says homogeneous toy noise, no hardware calibration and no routing.

**Resolution:** The repository does contain a meaningful separate gate-noise experimental path. My initial reference to readout-only perturbations applies to the primary `run_study.py` metrics and must not be read as a repository-wide absence claim. But neither those readout perturbations nor the supplementary final-execution gate-noise path establishes noisy-training robustness. I verified the code path, not the reported count of 27 saved records or their reproducibility. The recommendation to measure finite-shot/noisy training still stands.

## Why the score stays unchanged

The corrections improve attribution and precision without resolving the principal contribution gap. Genuine QAOA, explicit excitation-only XY behavior, classical references and raw feasibility accounting remain strengths. Tiny paired cases, substantial classical information in warm starts, table-based research preparation and the gap between ideal training and hardware cost remain limitations. I have not independently re-audited enough of the broader held-out results to raise the experiment score based solely on peers' successful checks.

The literature's valid scope remains unchanged: Egger et al. motivates carefully attributed warm starts; Hadfield et al. requires encoding-specific feasibility/reachability; Bärtschi–Eidenbenz makes efficient feasible preparation an assumption; Wang et al. concerns stated noise/depth assumptions rather than blanket shallow-circuit failure; Rønnow et al. motivates fair advantage definitions rather than a categorical no-go theorem. No citation in my initial report proves advantage for this application.

**Final toughest question:** What quantum-derived improvement survives replacing the quantum stage with the available LP/network-flow solution or an equal-budget classical sampler/search, when preparation, training, sampling and decoding are all charged on held-out operationally meaningful instances?
