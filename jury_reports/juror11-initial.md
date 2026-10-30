# Juror 11 — independent data quality and statistics vote

Commit inspected: `46693f6` in `/Users/shreeshaks/Documents/BloodFlow-Q-main 3`. Scope: source, bundled input data, raw saved experiment records, saved numerical summaries, frontend aggregation. No jury outputs or prior audit conclusions read. No fresh optimizer study or clinical validation performed.

**Overall: 68/100. Verdict: credible synthetic research demonstrator; not evidence of operational patient benefit or quantum advantage.** Confidence high for data and arithmetic findings, moderate for overall vote; uninspected categories scored conservatively from limited evidence rather than represented as independently certified.

| Category | Score / maximum |
|---|---:|
| Problem | 6/7 |
| User | 5/8 |
| Domain | 5/8 |
| UX | 4/6 |
| Architecture | 5/6 |
| Tests | 7/9 |
| Data | 6/8 |
| Classical | 8/10 |
| Quantum correctness | 7/10 |
| Quantum contribution | 3/8 |
| Experiments | 5/7 |
| Performance | 3/4 |
| Security | 2/4 |
| Adoption | 1/3 |
| Pitch | 1/2 |

## Three strengths

1. **Explicit synthetic provenance and strict input validation (high confidence).** All four `data/*.json` declare schema version 1 and synthetic true; routes identify costs as `synthetic_cost_points`, distances as km and travel times as minutes. `backend/data_loader.py:102` requires synthetic true and rejects missing/extra fields; `backend/data_validation.py` detects duplicate facility IDs, demand groups, routes, compatibility pairs, missing groups, bad endpoints and nonfinite/negative numerics. Fresh `load_data()` succeeds; independently summed inventory = **71 units**, demand = **38**, with **3 banks, 3 hospitals, 9 routes (one blocked)**. This is a coherent useful fixture, not a purported real dataset.
2. **Statistical unit and scope are unusually clear for a prototype (high confidence).** `research/quantum_experiments/analyze.py` averages seeds within scenarios before instance aggregation and sign-flip contrasts, applies Holm correction to three contrasts, and labels bootstrap intervals descriptive for eight synthetic held-out instances. `instances.py` fixes generation seeds and distinct holdout IDs. Independently read `results/study/runs.jsonl`: **992 completed records, 880 held-out, no duplicate (scenario, method, seed) keys**, 11 methods × 8 held-out cases × 10 seeds. All eleven mean optimal-feasible probabilities exactly matched saved `analysis.json`: standard **0.0696358129382165**, warm **0.6835525124988683**, reduced **0.3293923095807544**, feasible_grover **0.46648477768263213**, among others. This verifies saved arithmetic, not provenance of physical execution.
3. **Frontend denominators and negative findings are largely honest (high confidence).** `frontend/src/utils/researchMetrics.js:7` counts infeasible outcomes as completed, keeps skips separate, and limits exact-match rates to feasible outcomes. `ExperimentReports.jsx:53–95` labels saved synthetic simulator data and explicitly rejects demonstrated advantage. Independently recomputed `frontend/public/quantum-value-study.json`: classical **60/60 feasible, 60 exact matches**; raw QAOA **53/60 feasible, 29 exact matches, 7 infeasible**; hybrid **53/60 feasible, 52 exact matches, 7 skipped**. These align with the aggregation implementation.

## Three weaknesses

1. **README contains an internally contradicted outcome count (high confidence).** `README.md:92` says QAOA matched Exact on four scenarios; line 94 says three. Raw `experiments/results/20261007-01.json` proves **three**, with QAOA relative gaps `[2.2777777777777777, 0, 0.08666666666666671, 0, 0]`. Independently verified mean objectives **96.42 greedy, 95.64 exact, 107.38 QAOA**, mean QAOA gap **47.2888888889%** and median zero. Aggregate numbers are right but the favorable four-match explanation is wrong.
2. **Synthetic distributions give weak external validity (high confidence).** `research/quantum_experiments/instances.py:9–21` generates only 1–2 banks and hospitals, 1–2 groups, quantities 1–3; times, distances and costs are drawn independently, with all routes available. Urgency labels depend on hospital parity while weights are independently random, so label and numerical priority can disagree. These fixtures are useful for encoding/algorithm checks but neither calibrated demand forecasts nor representative clinical logistics. Main data lack expiry/batch age and Rh; `README.md:13` invokes ABO/Rh, perishability and golden-hour constraints more broadly than the inspected fixtures model. Explicit prototype caveats reduce, but do not eliminate, this pitch mismatch.
3. **Only eight independent held-out cases; seeds cannot create deployment evidence (high confidence).** Ten seeds per method characterize optimizer variability on a very narrow fixed generator. No empirical patient outcomes, institution provenance, uncertainty model for operational demand, or deployment validation are present in inspected sources. Bootstrap scope is correctly restricted in analysis, but a high warm-start probability on these fixtures cannot establish real-world superiority. UI runtime means include all finite attempt runtimes (`researchMetrics.js:13`), potentially mixing skipped attempts and completed solves; the UI labels this but comparison needs care. The log runtime bar formula in `ExperimentReports.jsx:83` also floors sub-millisecond negative-log widths to 4%, compressing distinctions despite precise text values.

## Commands and execution status

- `git rev-parse --short HEAD`: exit 0, `46693f6`.
- Source/data reads with `rg`, `sed`, `cat`; no audit report content opened. Two exploratory glob/path searches had missing paths; recovered using actual frontend layout.
- `PYTHONDONTWRITEBYTECODE=1 ../BloodFlow-Q1/.venv/bin/python` inline loader and independent JSON arithmetic: successful, first command wall time **0.049 s**; fresh loader itself **0.000524 s**. Saved experimental runtimes were not rerun.
- `PYTHONDONTWRITEBYTECODE=1 ../BloodFlow-Q1/.venv/bin/python -m pytest tests/test_data_loader.py tests/test_data_validation.py -q -p no:cacheprovider`: **20 passed, 4 subtests passed, 0.04 s**, exit 0 (tool wall 0.206 s).
- Initial legacy-summary script stopped at `KeyError: approximation_gap` for exact-reference rows, whose gap is absent. Corrected reader treats absent field explicitly; successful final recomputation above. This was reviewer script error, not an application failure.
- No expensive experiments, servers, network calls, or frontend runtime launched. Output is this report only; application files unchanged.

## Tough question

What independently sourced operational dataset and prespecified case sampling scheme would you use to show the benefit survives correlated demand, expiry, realistic route constraints and institution variation—and what would count as failure compared with the classical reference? Eight tiny generated instances and repeated seeds cannot answer that question.
