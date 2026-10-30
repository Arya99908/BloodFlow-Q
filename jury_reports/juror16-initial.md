# Juror 16 — independent initial assessment

Scope: performance, scalability, security, deployment. Source HEAD `46693f6`, `/Users/shreeshaks/Documents/BloodFlow-Q-main 3`. Read-only source inspection and bounded in-memory API calls; no installs, external authentication, remote changes, stress tests, or secret-value inspection. This report is my sole written artifact. Overall **69/100**, provisional across categories outside my specialist scope. Verdict: credible synthetic research demonstration; public availability and operational-readiness engineering remain materially incomplete. No quantum advantage or clinical readiness established.

| Category | Award / maximum |
|---|---:|
| Problem | 5.5/7 |
| User | 6/8 |
| Domain | 6/8 |
| UX | 4/6 |
| Architecture | 4.5/6 |
| Tests | 7/9 |
| Data | 5.5/8 |
| Classical | 8/10 |
| Quantum correctness | 7/10 |
| Quantum contribution | 4/8 |
| Experiments | 4.5/7 |
| Performance | 2/4 |
| Security | 2/4 |
| Adoption | 1.5/3 |
| Pitch | 1.5/2 |

## Direct measurements

Using the existing `../BloodFlow-Q1/.venv/bin/python` (supplied Qiskit 2.6 environment), with `PYTHONDONTWRITEBYTECODE=1`: fresh Python process import of FastAPI app and TestClient took 0.786 s. This is dependency/environment reuse, **not clean installation, serverless cold start, or network startup**. Fresh in-memory TestClient, one call each: default full-scenario greedy POST `/optimize` 200 in 0.0298 s, 3,685 response bytes; default MILP 200 in 0.0113 s, 2,793 bytes; default `/benchmark` 200 in 0.0036 s, 3,053 bytes. The benchmark default does not include QAOA/MILP and can skip capped exact work; it is not a full solver performance comparison. GET `/results` returned three saved records. These single local timings demonstrate responsiveness on bundled inputs only; no throughput, p95, peak-memory, warm-QAOA, or scaling claim follows.

`pytest -q -p no:cacheprovider tests/test_production_config.py tests/test_donor_network_migration.py`: **16 passed, 13 subtests passed**, 0.80 s. Migration tests are repository tests; this is not a live database/RLS verification. No clean dependency installation or deployed Vercel service was tested.

## Three strengths

1. **Concrete basic guards and truthful runtime scope (high confidence).** `backend/schemas.py:75-110` caps API QAOA depth 5, shots 10,000, iterations 500, restarts 10, exact candidates 50,000. `quantum/qaoa_solver.py:78,363` defaults to 16 qubits and rejects larger simulator inputs. `backend/services.py:405-411` limits result history to 100 records. These are real controls, though not total resource budgets.
2. **Production configuration fails closed and client error disclosure is reduced (high confidence).** `backend/main.py:30-61` validates exact HTTPS production origins, rejects wildcard/path/userinfo forms and missing configuration. Lines 69-98 disable debug/docs in production and cookie credentials; lines 100-128 redact server failures and exclude raw validation input. Bounded tests above passed. Production launcher omits reload. CORS is correctly not presented as authentication.
3. **Optional private-data path has deliberate authorization architecture (medium confidence).** `frontend/src/services/supabase.js:1-24` gates configuration and uses a publishable browser key plus tab session storage. SQL migration `202610130001_donor_emergency_network.sql:224-295,817-855` contains role checks, explicit search paths, function revokes and RLS enabling; follow-up migrations revoke additional direct execution. This is substantially better than treating a browser key as authorization. No live permission matrix or secret-absence guarantee was established.

## Three weaknesses

1. **Public computation can outgrow controls before solver guards apply (high confidence from source; exhaustion not attempted).** `backend/schemas.py:46-54,157-164` impose minimum scenario sizes but no maxima on banks, hospitals, routes, groups or benchmark scenario count. `backend/services.py:539-545` constructs QUBO before calling the solver cap; `quantum/qubo.py:434-443` creates a dense square Python matrix and tuple copy. MILP constructs dense `A` at `optimization/milp.py:141` and calls SciPy `milp` without a time limit at line 169 (LP warm-start path also uses dense arrays). Public endpoints have no authentication, rate limiter, job admission control or server-side cancellation deadline in inspected app/routes. QAOA max-iterations is not a wall-clock or strict objective-evaluation budget. Theoretical costs: QUBO storage O(q²), statevector O(2^q), MILP constraint storage O(rows×variables); no large-instance memory measurement was performed. Fix early size/count limits, bound benchmark batches, use sparse constraints, and isolate deadline-limited jobs.
2. **Shared results and public trust boundary are demo-only (high confidence).** `backend/services.py:398,405-411,528-529` stores all callers' results in one in-process list and returns them without identity isolation. Record count is capped, payload bytes are not. `ScenarioInput.synthetic=True` is a caller-supplied/default label, not proof of synthetic provenance. Anyone submitting private information despite instructions could expose it to other callers. Worker/serverless scaling splits history; restart loses it. `backend/main.py:124` and services exception logging retain diagnostic details server-side; log access/retention/redaction policies were not established. Restrict demo input or separate authenticated per-user storage before private operational use.
3. **Reproducible deployment and completion behavior remain weak (medium-high confidence).** `requirements-prod.txt` has broad ranges (including unbounded-above SciPy), no inspected Python lock; frontend has package-lock. Qiskit/Aer/SciPy are heavyweight runtime dependencies. `frontend/src/services/api.js:4-13` has fetch without AbortSignal/deadline; solver jobs are synchronous endpoint work and no application timeout is configured. `docs/DEPLOYMENT.md:53` explicitly expects one process for history semantics, while Vercel documentation describes serverless execution. Documentation also contains stale tree claims (no public asset directory despite one existing). Deployment docs describe platform sizes/limits, but I did not independently verify changing provider limits or live status. A cold-install/build matrix, measured deployment cold-start budget and durable job/result contract would materially improve confidence.

## Decisive question

What enforced **pre-allocation request-size, total compute deadline, and concurrent-job budget** protects the public `/optimize` and `/benchmark` endpoints, and can the team demonstrate it under a bounded adversarial acceptance test without relying on CORS or a provider killing the process?

Confidence: high in the cited local controls/gaps and local measurements, medium in overall vote, low in untested remote deployment and optional hosted authorization behavior. Category scores outside this scope are provisional, not a claim to have audited every algorithm or UI path.
