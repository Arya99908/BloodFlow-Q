# Juror 12 — sealed initial assessment

Role: Classical optimization and operations research. Primary: BloodFlow-Q-main 3, commit 46693f6. Independent investigation; no other juror report read. Assessment emphasizes mathematical model, baseline equivalence, small-instance reproduction and QUBO energy checks. UI, production security, and most quantum circuit execution were not independently tested by this juror.

## Score and verdict

Provisional **67/100**. Strong classical optimization prototype and credible research comparator; contender, not demonstrated overall winner. Confidence high for classical correctness on tested cases and model structure; medium overall because non-specialist categories have limited evidence.

Categories in shared rubric order: **[6,5,5,3,5,7,4,9,7,3,4,3,3,2,1]** (sum 67), maxima [7,8,8,6,6,9,8,10,10,8,7,4,4,3,2].

Reasons: meaningful synthetic allocation problem (6); understandable allocation outputs but workflow not live-tested (5); explicit compatibility/inventory/demand but single-period simplification (5); UI untested/source-level provisional (3); clear solver/model/objective split (5); 37 relevant tests and independent enumeration checks pass, not whole-app assurance (7); synthetic examples are controlled, not operationally validated (4); exact/MILP/LP equivalence convincingly verified locally (9); QUBO/Ising test checks pass, full QAOA not tested here (7); no evidence of useful quantum advantage (3); reproducible local controls but limited independent quantum repetition (4); fast measured classical runs but dense matrix/no explicit MILP time limit (3); synthetic-data boundaries, security untested (3); plausible prototype adoption only (2); README overstates hardness/constraints and universal latency (1).

## Three strongest findings

1. **Verified:** MILP and exact solve the same well-defined weighted shortage-plus-logistics objective. Inventory inequalities and served+unmet equalities are explicit; unknown/incompatible allocations cannot receive finite shared objective scores. Evidence: optimization/milp.py:115–169, optimization/objective.py:calculate_objective, optimization/exact.py:solve_exact; 100 independent tiny-instance enumerations below matched MILP, exact, and LP objectives with zero mismatches.
2. **Verified:** The classical baseline is strong, not merely a straw-man heuristic. Bundled 3-bank/3-hospital/4-group scenario with 72 shipment variables: MILP objective 202.70000000000002; LP 202.7; greedy 230.6, both integer solver outputs feasible. Weights (10,5,1,0.1,0). Measured wall seconds MILP .007820, LP .001488, greedy .000197 (single local run; not performance guarantee).
3. **Verified on bounded checks:** QUBO uses bounded quantity encodings, explicit constants, and penalties exceeding a conservative objective spread. Relevant QUBO consistency/independent-energy tests pass. Evidence quantum/qubo.py:_binary_weights, compute_conservative_objective_bound, build_qubo (lines 215,272,300); selected 37-test suite below. This supports encoding correctness on checked cases, not universal circuit or advantage claims.

## Three most important weaknesses

1. **P1, contradicted pitch implication:** Current production constraints have a transportation/network-flow structure; an exponentially large enumeration space is not evidence of computational hardness. Changing sign of supply rows gives each shipment column one +1 and one -1; unmet columns are unit columns, and integer bounds retain an integral optimal vertex. Thus LP/flow is a central baseline, and increasing this model's size alone does not establish quantum need. Evidence optimization/milp.py:129–169 and solve_relaxation, models.py:346–383; all 100 random test LP outputs integral and optimal. README.md:13 invokes ABO/Rh and golden-hour transit limits that these constraints do not enforce; README.md:23,81 gives unqualified '<15 ms'. Repository research/quantum_experiments/WHY_QUANTUM_REPORT.md already discusses flow structure; align the front-door pitch with it. I derived the column structure from source before locating this documentation; research report figures were not used as my measurements.
2. **P2, verified weak heuristic:** Greedy always fills eligible demand even when its weighted transportation cost exceeds the saved shortage penalty. A one-unit supply/demand case, route cost 100 and shortage weight 1, gives greedy 100 versus exact/MILP 1 (zero shipment), all feasible. Evidence optimization/greedy.py:117–128. This is consistent with its declared fulfillment heuristic and not a solver-correctness bug, but beating it alone is weak optimization evidence. Add an objective-aware marginal-cost greedy and keep exact LP/MILP comparisons.
3. **P2, source-verified engineering limits:** MILP builds dense constraint matrices and invokes scipy.optimize.milp without timeout/options; it does not expose solver dual bound, MIP gap, or termination metadata in MILPResult. Evidence optimization/milp.py:141,169 and MILPResult. Current tiny cases are fast, but '<15ms' is not a valid universal contract. Use sparse incidence matrices, bounded solve configuration and explicit certificate/status reporting. No timeout failure was observed.

## Execution record

Interpreter: /Users/shreeshaks/Documents/BloodFlow-Q-main 2/.venv/bin/python, executing main 3 source; Python 3.14.7, SciPy 1.18.1, Qiskit 2.5.2. System python3 lacks scipy; reusable environment resolved blocker. No packages installed. PYTHONDONTWRITEBYTECODE=1, pytest -p no:cacheprovider. Source/config/tests/results unchanged.

- OR-T01 PASS: `python -m pytest -p no:cacheprovider -q tests/test_milp_solver.py tests/test_objective.py tests/test_constraints.py tests/test_exact.py tests/test_greedy.py tests/test_qubo_consistency.py tests/test_independent_qubo_proof.py`: **37 passed in 1.59s**, exit 0. Includes zero-demand stock 0/3, blocked routes, independent QUBO/Ising reconstruction checks. Not a whole-suite result.
- OR-T02 PASS: seed 12025; 100 random two-bank/two-hospital/one-O-group scenarios. Stock/demand independently randint via randrange(4); costs randrange(16), statuses selected ['available','available','blocked'], high urgency priority weights randrange(1,5). Weights (2,1,1,0,0). Independently enumerate all four shipment quantities from zero to min(stock,demand) (blocked edges fixed zero), discard stock/demand violations, score sum(cost*x)+sum((1+2*priority)*(demand-served)). Compare this direct minimum to MILP, exact, LP metadata. Zero objective mismatches at 1e-7 tolerance; zero fractional LP maps at 1e-7. Total custom run .119009s; individual MILP internal timings min .000012791s/max .008198750s. This sample supports the source-derived structure, not a statistical scalability claim.
- OR-T03 PASS as reproduction of heuristic limitation: one bank b with O=1, hospital h low-priority O demand=1, route time=0/distance=0/cost=100 available, O→O allowed. ObjectiveConfig(0,1,1,0,0). Greedy ships 1, objective 100, .000041334s; exact ships 0, objective 1, .000034583s; MILP ships 0, objective 1, .000398250s. All feasible. Exact/MILP agree with manually calculated optimum; greedy is an acknowledged heuristic, so no broken API expectation inferred.
- OR-T04 PASS: bundled data loaded through load_data('data')/scenario_from_loaded_data; weights ObjectiveConfig(10,5,1,.1,0); results above. LP returned fractional-capable maps; direct feasibility validation of those maps not separately performed for this bundled case, objective agreement verified.
- UI and QAOA sampling runs: NOT TESTED by this juror. No quantum hardware or external services called.

## Challenge question

If your current production allocation model has an integral LP optimum and solves classically in milliseconds on the demonstrated instances, what precisely does the quantum stage add after accounting for LP warm-start information, encoding overhead, feasibility, and end-to-end time?

## Cross-examination request for later round

Ask the quantum/experimental juror to establish whether any claimed warm-start improvement survives comparison against the LP solution used to initialize it, on identical instance/objective and inclusive timing. Ask product/pitch juror whether README's hardship/ABO-Rh/golden-hour language is actually supported by current production constraints.

Initial score sealed before receiving other juror conclusions. Final independent score pending evidence-based cross-examination.
