# Juror 15 — sealed initial evaluation

Role: Experimental Design / Reproducibility. Independent inspection of commit `46693f6`, directory `BloodFlow-Q-main 3`. No other jury outputs or prior audit conclusions were read. Historical raw artifacts, executable analysis/experiment code, configurations and project documentation were inspected. No expensive experiments were rerun. Only this new report was written; runtime Python used `PYTHONDONTWRITEBYTECODE=1`.

**Overall: 70/100. Verdict: credible, unusually well-instrumented synthetic research prototype; quantum necessity and operational effectiveness remain unproved.** Confidence high in the independently recomputed experiment findings; medium overall because UI, deployment security and real-user adoption were outside this bounded review.

| Category | Points |
|---|---:|
| Problem | 6/7 |
| User | 5/8 |
| Domain | 5/8 |
| UX | 4/6 |
| Architecture | 5/6 |
| Testing | 7/9 |
| Data | 6/8 |
| Classical | 9/10 |
| QuantumCorrect | 8/10 |
| QuantumContribution | 3/8 |
| Experiments | 6/7 |
| Performance | 2/4 |
| Security | 2/4 |
| Adoption | 1/3 |
| Pitch | 1/2 |

## Independent recomputation and experiment inventory

These are VERIFIED historical artifact checks unless explicitly labeled NEW runtime. Reading a saved completed status does not establish successful new execution. Counts below were independently parsed from raw JSON/JSONL using standard-library Python, not copied from existing conclusions.

| Experiment / scenario | Status | Evidence and boundary |
|---|---|---|
| Original five-case benchmark | PASS with documentation error | `experiments/results/20261007-01.json`: 15 completed records, five per method. Recomputed means Greedy 96.42, Exact 95.64, QAOA 107.38. QAOA gaps 227.7778%, 0%, 8.6667%, 0%, 0%; mean 47.2889%, median 0%; exactly THREE optimum matches. README line 92 says four, contradicting raw data and line 94. |
| Paired warm-start design | PARTIAL | `experiments/configurations/warm-qaoa-paired-20261022.json` freezes six cases, seeds 301–310, p=1, shots=64, max iterations=8, epsilon=.25; Windows/Python/package provenance and full instances retained. Cases are one bank / one hospital / one group with zero or one allocation variable; circuit bit count must not be mistaken for operational complexity. Design inspected; associated outcomes not independently recomputed here. |
| Original primary research study | PASS | `research/quantum_experiments/results/study/runs.jsonl`: 992/992 completed; 112 training, 880 heldout. Eleven methods each have 80 heldout records = eight cases × ten seeds 101–110. All seven recorded source hashes in `study/protocol.json` match current files. |
| Primary study contrasts | PASS, narrow inference | Independently recomputed instance-paired sign permutations: CVaR minus standard +.0109901, p=.296875; reduced minus standard +.2597565, p=.0078125; feasible Grover minus reduced +.1370925, p=.109375. Holm-adjusted p values .296875, .0234375, .21875 respectively. Eight synthetic cases are independent units, not 80 seeds or thousands of shots. |
| Transfer / noisy training controls | PARTIAL | Separate training IDs (`normal_reference`, `inventory_shortage`, `multi_facility`) and frozen holdout generation are explicit in `run_study.py` / `instances.py`. Shared transfer training costs .1103965 seconds / 480 statevector evaluations; optimizer success=false due to MAXFUN=160. Valid bounded termination, but not convergence. Summary transfer-only latency omits shared training unless consumer adds it. |
| Necessity / same-wrapper ablation | PASS for negative evidence | `research/quantum_experiments/results/necessity/runs.jsonl`: 240 runs, 960 rounds, 12 cases, four methods × five seeds. Original variant mean absolute gap is 1.7333333 for all four methods (15/30 optimal each). Fixed-dispatch variant MILP/table/quantum gap 1.7366667 (25/30 optimal), uniform 1.8166667 (25/30). Quantum mean times .03668/.03658 seconds versus MILP .01182/.01301; table .03320/.03283; uniform .00533/.00521. Zero recorded round overruns. No demonstrated quantum necessity. |
| Classical scaling in necessity | PARTIAL | `necessity/scaling.jsonl`: 16 cases, 32 LP/MILP solver calls. Original MILP proven 8/8; hypothetical fixed-dispatch proven 7/8; maximum saved MILP time 2.0179 seconds. The unproved case must stay in the denominator. Protocol prose says 32 rows, but actual intended design has 16 rows. |
| Supplementary quantum experiments | PARTIAL | Raw `results/supplementary`: 240 Grover records; 27 Aer gate-noise records; 38 scaling records, 36 completed and TWO skipped_quantum. Presence/counts verified; circuit-specific claims not independently recalculated. |
| Later research rerun | PARTIAL | `experiments/results/full_review_20261024/research_study/runs.jsonl`: 992 completed records. Pilot eight. Counts verified only; this is historical, not new execution. |
| Later production matrix | PARTIAL | `.../production_v2/runs.jsonl`: 1410 records, 1377 completed, 33 skipped. Standard/warm/XY/warm-XY/warm-keep each 114 completed + six skipped out of 120. Exact 117+3. MILP 120 completed but SIX infeasible validation records: three seeds each for zero_demand and zero_inventory_and_demand (missing explicit zero unmet-demand rows). Completion is not feasibility. |
| Corrected boundary artifacts | PASS on saved status, current runtime NOT TESTED | `.../boundary_corrected/runs.jsonl`: 81 records, 66 completed, 15 skipped, zero false feasibility values. This prevents interpreting earlier six MILP records as established current defects. |
| Necessity rerun lineage | PARTIAL | Later `necessity`, `necessity_v2`, `necessity_final` each retain 240 rows. Original necessity protocol's run.py hash no longer matches; other three listed hashes do. Current run.py includes randomized method order and broader source snapshot coverage, while original study has fixed method ordering. Historical timing must be attributed to its specific implementation. |
| Research unit checks | PASS — NEW runtime | `../BloodFlow-Q1/.venv/bin/python -m unittest research.quantum_experiments.tests.test_research research.quantum_experiments.tests.test_necessity -q`: 21 tests, .396 seconds, OK. No benchmark regeneration. |
| Hardware / realistic patient outcomes / hospital-user validation | NOT TESTED | No such validation established from inspected artifacts. Synthetic and simulator scope is explicit in README. |
| UI, live private donor flow, deployed service security | NOT TESTED | Not exercised by this reviewer. Category scores reflect bounded code/documentation visibility, not runtime certification. |

## Three strengths

1. **Auditable denominators and paired controls.** `run_study.py` emits per-run seeds/config/metrics/timing; `analyze.py` uses eight instance means, exact paired sign permutations and a specified three-contrast Holm family. Raw recomputation reproduces counts and numerical contrasts. This is materially stronger than best-shot anecdotes.
2. **Quantum replacement is actually tested.** `necessity/PROTOCOL.md`, `ablation.py`, and raw `necessity/runs.jsonl` compare identical-wrapper MILP, exhaustive lookup, quantum and uniform alternatives; retain negative outcomes and full-model references. The recorded outcome supports an honest absence-of-necessity conclusion.
3. **Reproduction has useful provenance and bounded resources.** Primary protocol source hashes all match, versions/seeds/instance inputs are retained, raw writers use exclusive creation, supplementary skips are explicit, and 21 new runtime research tests pass. Primary `run_study.py` separates encoding, optimization, circuit verification and synthesis timing rather than equating simulator time to hardware time.

## Three weaknesses

1. **Claims still outrun or contradict evidence in the main entry point.** README:92 says four optimum matches; raw evidence says three. README:23 and :81 promise MILP <15 ms and provable global optimality without qualification; raw larger scaling includes a >2-second unproved solve. README:13 invokes golden-hour limits and clinical urgency, while :206 concedes missing expiry, route capacity, uncertain supply and actual delivery. This undermines otherwise careful research reporting.
2. **Toy generalization and classical preprocessing dominate.** Holdout specs in `instances.py` have at most two banks/two hospitals and one/two groups; warm comparison is almost entirely a single shipment decision. Reduced prototypes enumerate energy tables; `run_study.py` explicitly stores the same-table classical optimum. Better sampling probability is not an end-to-end computational contribution. Necessity quantum matches MILP/table objectives while taking roughly 2.8–3.1× MILP time in saved runs.
3. **Timing/reproducibility requires version-specific interpretation.** Original research loops methods in fixed order; shared encoding and synthesis preparation are amortized/cached and reconstructed into standalone timing; transfer cost sits outside summary latency. Later production and current necessity randomize ordering, but original necessity run.py hash differs from current. Source hashing covers only seven local research files for the original study despite imported production/experiment dependencies. These are limitations of exact reproduction and fair timing, not proof of fabricated results.

Tough question: **After charging answer-revealing table construction, state preparation, shared training and circuit synthesis, which prespecified heldout workload is materially harder for the full classical model and gives a quantum contribution against the identical-wrapper MILP replacement?** The inspected records currently do not supply one.

Recommendation: retain the work as a reproducible educational/logistics research prototype; correct README numerical/timing claims and consolidate a versioned authoritative experiment manifest before pitching operational readiness or quantum value. No inference of clinical efficacy or scalable quantum advantage is justified.
