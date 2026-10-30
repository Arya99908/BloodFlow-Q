# Juror 12 — independent final vote

**Final score 67/100, unchanged.** Category points in shared order: [6,5,5,3,5,7,4,9,7,3,4,3,3,2,1]. Sum 67. Personal verdict remains: strong classical optimization prototype and credible research comparator; contender, not demonstrated overall winner. High confidence in classical mathematics and tested behavior; medium overall. Initial scorecard remains intact in juror12-initial.md.

## Actual cross-examination and resolution

Read released docket, Juror 3 initial and Juror 15 initial only after all initial ballots were collected.

**Challenge to J3: does deliberately leaving critical demand unmet mean the solver is incorrect, or does it expose an operational-policy gap?** Independently reran the exact proposed one-bank/hospital/group case: stock=demand=1, critical priority=1, available route time=120 minutes, transport cost=100, ObjectiveConfig(10,5,1,.1,0). Current MILP returns objective15, unmet1, feasibleTrue; greedy112, unmet0, feasibleTrue. These are new executions by this juror. Source optimization/objective.py:227–239 and optimization/milp.py:115–124 defines shortage price15 and transport112; thus MILP is mathematically correct. J3 explicitly described both as correct, and I confirm that distinction. Feasibility means modeled constraints hold, not emergency-service acceptability. Priority is not a lexicographic guarantee. A requirement to serve critical demand first must be a separately specified policy and its shortage infeasibility handled explicitly. It should not be patched by silently declaring current results invalid.

**Challenge to J15: is the saved >2-second unproved MILP solve evidence against the production formulation's optimality claim?** Directly parsed research/quantum_experiments/results/necessity/scaling.jsonl. The 2.017905750006321-second status1/nonoptimal row is fixed_dispatch_hypothesis, scenario scale_24_9100. It is not the production formulation. All eight original rows say proven_optimal=true; original scale_24_9100 takes .01626837499497924 seconds, which is an actual same-formulation counterexample to unqualified '<15ms', but not an optimality failure. Sent J15 this correction. The hypothetical extension timeout remains important research evidence but must not be presented as a current production failure. These are saved-artifact checks, not fresh scaling executions.

The original network-flow integrality reasoning remains valid: sign-flipped supply incidence and demand incidence, unit unmet/slack columns, and integer bounds yield an integral optimal vertex. It does not imply every optimal LP point is integral, nor does it extend to fixed-dispatch activation variables. In the saved hypothetical scale_24_9100 record, LP objective385.597619 vs MILP incumbent449.8 illustrates why integer shipment values alone do not certify the fixed-charge relaxation's exactness.

## Why score stays unchanged

New evidence confirms the already-scored policy transparency weakness and classical correctness. J15's distinction improves attribution but does not change my original score: my initial finding was an unsupported universal latency promise, not an observed production optimality failure. No score was changed to match another juror. Broader research rigor reported by J15 is positive but I have not independently re-audited enough of that work to adjust my bounded category assessment.

## Remaining uncertainty and recommendations

Unresolved: operational approval of objective weights; end-user understanding of feasible-but-unserved outputs; any repeatable quantum benefit after charging LP/classical preprocessing; broad performance beyond measured local examples. I did not newly execute UI, hardware, or the full experimental matrix. No source/test/config/data/result mutation.

Keep shared-objective comparisons against LP/MILP; describe greedy as fulfillment-first heuristic; align front-door claims with actual flow model; add objective decomposition and clear critical-shortage policy descriptions; use sparse matrices, solve limits, and certificate metadata. Toughest question remains: what incremental value does quantum supply beyond the already optimal LP solution on this model?
