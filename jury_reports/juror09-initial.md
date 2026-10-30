# Juror 9 initial independent ballot — Reliability and edge cases

Target: BloodFlow-Q-main 3, HEAD 46693f6. Read-only source review and small in-memory checks; no other jury reports or previous audit conclusions consulted. No application, configuration, tests, data, or results files changed. Initial bounded review, not a full security or scientific replication.

**Overall: 68/100. Verdict: credible research demonstration with strong explicit feasibility accounting; conditional support, not deployment-ready reliability.**

| Dimension | Award / maximum |
|---|---:|
| Problem | 6/7 |
| User | 6/8 |
| Domain | 6/8 |
| UX | 4/6 |
| Architecture | 4/6 |
| Tests | 7/9 |
| Data | 5/8 |
| Classical | 8/10 |
| Quantum correctness | 8/10 |
| Quantum contribution | 4/8 |
| Experiments | 4/7 |
| Performance | 2/4 |
| Security | 2/4 |
| Adoption | 1/3 |
| Pitch | 1/2 |

Scores outside the reliability remit are provisional: synthetic demonstration and available implementation evidence support them, but this review did not independently reproduce experimental claims or assess real adoption.

## Three strengths

1. **Shortage is correctly distinguished from infeasibility (high confidence, executed).** `optimization/milp.py:115–160` includes explicit unmet-demand variables and demand balance; `backend/services.py:283–313` derives completed/infeasible status from the validation report. Zero inventory and blocked route both returned HTTP 200, completed, feasible, unmet=1. Thus a legitimate stock shortage is not mislabeled a solver failure.
2. **Quantum error/fallback provenance is explicit (high confidence, source inspection).** `backend/services.py:531–555` returns 501 for unavailable QAOA, 422 for resource limits, and 502 for solver errors. `quantum/qaoa_solver.py:168–256` labels LP/greedy/uniform warm-start sources and fallback reasons. `:445–475` seeds sampling, reverses Aer bit order for energy evaluation, and evaluates measured candidates without repair. `backend/services.py:310–313` exposes raw bits and `classical_repair_applied=False`. No silent classical replacement for failed quantum optimization was observed.
3. **Useful defensive infrastructure and fast foundational tests (high confidence).** `frontend/src/utils/latestRequest.js` guards stale reads and unmount through generations; `useApi.js` adopts it. API schema rejects unknown fields; production errors are sanitized in `backend/main.py`. Results history is capped at 100 in `backend/services.py:398–411`. The 23 decoder/constraint/data-validation tests passed in 0.008 seconds (process 0.01 seconds).

## Three weaknesses

1. **API boolean stock silently becomes one blood unit (high confidence, reproduced).** `backend/schemas.py:9–12` forbids extra fields but does not enable strict type validation; inventory is `dict[str, int]` at line 26. Pydantic converts `true` to `1` before domain checks. This defeats the explicit intended rejection in `optimization/models.py:33–35` (“True must never mean one blood unit”) and `backend/data_validation.py:64–66`. A request containing inventory `{"O": true}` returned HTTP 200, feasible, fully met demand, instead of 422. Scope is input integrity, not demonstrated clinical harm; data is synthetic. Check other numeric/boolean boundary coercions before relying on validation guarantees.
2. **Stale-result protection is incomplete on mutations (medium-high confidence, source-traced; browser race not executed).** `frontend/src/App.jsx:120–124` quick optimization publishes any completed request without a generation check; `frontend/src/pages/Optimization.jsx:38–40` imports global results but `:97` independently publishes a page-local response. If a page-local run starts, then global Quick Optimization completes, the older local response can later overwrite the newer global result. `createLatestRequest` only protects `useApi` loads, not these submissions. The code comment promises a global quick run replaces older page-local runs, but no invalidation enforces that across pending requests.
3. **No end-to-end execution deadline/cancellation (high confidence for missing mechanisms; impact not load-tested).** `frontend/src/services/api.js:4–18` fetch has no timeout/AbortController; synchronous backend solver routes run until return. `optimization/milp.py:169` calls SciPy MILP without time_limit; QAOA bounds iterations/restarts/qubits but `quantum/qaoa_solver.py:445–447` waits on `job.result()` without timeout. `ScenarioInput` lists have minimum sizes but no upper size cap. A hung or excessively large accepted request can leave the UI loading indefinitely and occupy resources. Existing exact-state and QAOA-qubit limits are useful, but they are not a request deadline. No deliberately expensive request was run.

## Minimal executed scenarios and reproducibility

Working directory `/Users/shreeshaks/Documents/BloodFlow-Q-main 3`; interpreter `../BloodFlow-Q1/.venv/bin/python`; all Python executions set `PYTHONDONTWRITEBYTECODE=1` and passed `-B`. Imported `tests.test_api.tiny_scenario_payload`, used `TestClient(create_app())`, and POSTed `/optimize` with `method=milp` and the modified tiny scenario. State stayed in memory.

| Scenario modification | Expected | Actual | Wall time |
|---|---|---|---:|
| bank inventory O=0 | Valid shortage, completed/feasible, unmet 1 | HTTP 200; all expected fields | 0.036 s |
| bank inventory O=True | 422 invalid whole-number quantity | HTTP 200, completed/feasible, unmet 0 | 0.004 s |
| bank inventory O=-1 | 422 validation | HTTP 422, expected non-negative whole number | 0.002 s |
| only route status=blocked | Valid shortage, completed/feasible, unmet 1 | HTTP 200; all expected fields | 0.003 s |

Minimal failure command:

```sh
PYTHONDONTWRITEBYTECODE=1 ../BloodFlow-Q1/.venv/bin/python -B - <<'PY'
from fastapi.testclient import TestClient
from backend.main import create_app
from tests.test_api import tiny_scenario_payload
s = tiny_scenario_payload()
s['blood_banks'][0]['inventory']['O'] = True
r = TestClient(create_app()).post('/optimize', json={'scenario': s, 'method': 'milp'})
print(r.status_code, r.json()['feasibility'], r.json()['total_unmet_demand'])
# Observed: 200 True 0; expected rejection, not conversion of True into a unit.
PY
```

Verification command: `PYTHONDONTWRITEBYTECODE=1 ../BloodFlow-Q1/.venv/bin/python -B -m unittest tests.test_decoder tests.test_constraints tests.test_data_validation -q` → 23 tests, OK, 0.008 s. These passing tests do not cover API coercion demonstrated above.

## Cross-examination question

Can the team demonstrate that a newer Quick Optimization supersedes an already-pending local run, and explain why API quantities are coercive when the domain explicitly forbids boolean blood-unit counts? Also specify the bounded execution/recovery contract for MILP and QAOA requests that fail to return.
