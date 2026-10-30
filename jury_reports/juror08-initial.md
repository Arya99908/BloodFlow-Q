# Juror 8 — sealed independent initial assessment

Role: adversarial QA and test engineer. Source: BloodFlow-Q-main 3, commit 46693f6. No other juror conclusions or historical audit reports consulted. Application source unchanged. Confidence: high for executed API/test findings; medium overall; UI and external deployment not examined by this juror.

**Initial score: 69/100. Verdict: credible, well-tested prototype/contender, not yet a proven winner.**

Category points in rubric order: [6,5,5,4,5,7,5,8,7,4,5,2,3,2,1]. Sum 69. Strongest direct evidence supports testing/reliability, input boundary, classical tiny-case behavior and quantum failure visibility; other categories are provisional assessments from source and tests, not a substitute for specialist verification. Domain score reflects aggregate synthetic scope; novelty and performance remain incompletely demonstrated. No live-browser conclusion is made.

## Three strengths
1. Substantial executed regression coverage: `PYTHONDONTWRITEBYTECODE=1 '/Users/shreeshaks/Documents/BloodFlow-Q-main 2/.venv/bin/python' -m pytest tests -q -p no:cacheprovider` passed **194 tests and 21 subtests in 3.86 s**, with 3 warnings. This includes real tiny simulator API tests and many independent formulation checks; it does not establish every workflow works.
2. Adversarial API boundaries reject negative/fractional inventory, duplicate bank IDs, conflicting compatibility records, invalid shots and malformed parameter initialization. Zero inventory and blocked routes correctly produce feasible allocations with explicit unmet demand, rather than pretending all demand was satisfied. See custom cases below and `tests/test_api.py::APITests`.
3. `npm test` ran 53 frontend utility/wiring tests successfully, 0 failed/skipped, node runner duration 531.31525 ms. Particularly valuable tests preserve unavailable values and reject stale network allocation overlays (`frontend/tests/networkGraph.test.js`, `latestRequest.test.js`, `measurementValues.test.js`). These are not browser end-to-end tests.

## Three weaknesses
1. **P1 / verified:** default repository-root pytest invocation fails collection because archived audit tests share module basenames with current tests. Command above without `tests` exits 2 in 1.30 s with mismatches for test_pipeline_integration and test_qaoa_solver, imported from `audit/warm_qaoa_before/tests/`. `pytest.ini:1-2` specifies pythonpath only. Fix test discovery to current tests, retain archive outside collection. Explicit `pytest tests` is a practical workaround.
2. **P2 / verified:** API accepts JSON `true` inventory as one unit and produces an allocation. `backend/schemas.py:24-25` uses coercing int values, while `optimization/models.py:32-35` explicitly says boolean must never mean one unit. Pydantic converts before the domain validator sees it. Use strict integers for inventory/demand and test the HTTP boundary, not only direct dataclass construction.
3. **P2 / verified:** valid all-zero supply/demand fails QAOA with HTTP 502, while greedy, exact and MILP complete at objective 0. `quantum/ising.py:84-86` rejects zero variables; `backend/services.py:543,550-554` wraps it as solver failure. Handle trivial constant problems explicitly or return a precise unsupported-trivial-instance response without pretending a simulation ran.

## Executed scenarios
Environment: macOS local existing neighboring venv, Python 3.14.7, pytest 9.1.1, FastAPI 0.143.1, Qiskit 2.5.2, SciPy 1.18.1; Node v26.10.0. Global Python lacked pytest/FastAPI (BLOCKED on that interpreter); no installation performed. Timings below are perf_counter end-to-end in-process FastAPI TestClient request wall times, not quantum hardware/circuit timings. One execution each; deterministic greedy unless stated. Shared tiny instance: one bank b, one hospital h, group O, supply 2, demand 1, high urgency weight 2, route available/time 5 minutes/cost 1/distance 2, compatibility O→O true, synthetic true. POST /optimize with scenario and default greedy unless specified.

|Case|Mutation/expected|Actual|Status|seconds|
|---|---|---|---|---:|
|QA01|none; allocate 1|200, feasible, objective 1.5, unmet 0|PASS|0.03019|
|QA02|demand 0; empty allocation|200, objective 0, unmet 0|PASS|0.00191|
|QA03|inventory 0; shortage 1|200, feasible, objective 25, unmet 1|PASS|0.00145|
|QA04|inventory -1; reject|422 invalid_scenario|PASS|0.00125|
|QA05|inventory true; reject as domain states|200, one-unit allocation|FAIL|0.00179|
|QA06|inventory 1.5; reject|422 validation_error|PASS|0.00115|
|QA07|append duplicate bank; reject|422 duplicate blood bank id|PASS|0.00139|
|QA08|append false O→O duplicate; reject|422 duplicate compatibility rule|PASS|0.00160|
|QA09|route blocked; shortage 1|200 feasible, empty allocation, unmet 1|PASS|0.00164|
|QA10|qaoa_config shots 0; reject|422 validation_error|PASS|0.00135|
|QA11|provided initial parameters [0], p=1; reject|422 requires exactly 2*p parameters|PASS|0.00140|
|QA12|POST /benchmark scenarios []; no invented result|200 results []|PASS|0.00194|
|QA13|both stock and demand 0, greedy|200 feasible objective 0|PASS|0.02681|
|QA14|same, exact|200 feasible objective 0|PASS|0.00214|
|QA15|same, MILP|200 feasible objective 0|PASS|0.00316|
|QA16|same, QAOA without penalties; reject|422 missing_qaoa_penalties|PASS|0.00171|
|QA17|same QAOA, penalties both 10000, p1/shots16/max_iterations4/seed7; trivial outcome or explicit semantic rejection|502 qaoa_failure, zero-variable Ising exception|FAIL|0.02632|

Reproduction: construct shared JSON as described, instantiate `TestClient(create_app(), raise_server_exceptions=False)` from fastapi.testclient/backend.main, apply table mutation and POST. QA13–17 additionally used `runpy.run_path('tests/test_api.py')['tiny_scenario_payload']()` and set inventory O and demand O to zero. The returned 502 was sanitized; backend logs showed QUBOInputError at quantum/ising.py:86. No quantum hardware job ran.

Warnings: Starlette deprecated httpx TestClient integration (suggests httpx2); two COBYLA tests requested MAXFUN below minimum and SciPy raised it to 4. These are warnings, not failed assertions.

NOT TESTED by this juror: live browser journeys, production deployment, external Supabase auth/migrations, expensive stress/load tests, hardware, exhaustive malformed-input space. Empty benchmark is judged acceptable empty output, not proof a requested optimization ran.

Toughest developer question: Why do your domain types explicitly prohibit boolean blood units while the public API silently turns true into inventory, and which tests protect the complete input-to-result boundary rather than isolated model constructors?

Cross-examination request (before seeing another verdict): require any reliability/UX claim that all valid scenarios work to address QA17 and require any claim that the test suite passes by default to state the exact invocation. Awaiting other jurors' actual claims for the formal second round.
