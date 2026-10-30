# Juror 10/16 — independent architecture and code-quality ballot

Target: `BloodFlow-Q-main 3`, branch `evenmore-fix-and-heartbeat-additon`, commit `46693f6519bdd385b67b3b69b2c4a450a058d67a`. Read-only inspection except this new report. No jury outputs or prior audit conclusions read.

**Overall: 65/100. Confidence: medium overall; high on architecture findings and reproduced boundary bug.** This is a credible synthetic research prototype with unusually substantial mathematical infrastructure. It is not yet a defensible multi-user operational application, nor does inspected evidence establish quantum business value.

| Criterion | Award / maximum |
|---|---:|
| Problem | 6/7 |
| User | 4/8 |
| Domain | 5/8 |
| UX | 4/6 |
| Architecture | 4/6 |
| Tests | 7/9 |
| Data | 5/8 |
| Classical | 8/10 |
| Quantum correctness | 8/10 |
| Quantum contribution | 3/8 |
| Experiments | 5/7 |
| Performance | 2/4 |
| Security | 2/4 |
| Adoption | 1/3 |
| Pitch | 1/2 |

## Three strengths

1. **Meaningful domain/solver/API separation.** `optimization/models.py` keeps allocation modeling independent of choice of solver; `optimization/benchmark.py:69-90` supplies result and solver protocols; `backend/routes/operations.py` delegates to an injectable service. `backend/main.py:create_app` and `backend/dependencies.py:get_service` support isolated testing. The same objective and independent feasibility validator are reused by classical and quantum paths, reducing divergent business logic.
2. **Honest failure and provenance boundaries have improved.** `backend/main.py:102-129` centralizes validation and exception responses, suppresses production internal-error details; `backend/services.py:_quantum_result` distinguishes unavailable, oversized and failed QAOA. `quantum/qaoa_solver.py:_prepare_warm_start` now names LP/greedy/uniform sources and fallback reasons. `backend/services.py:precomputed_demo` treats stored runs as historical artifacts rather than live execution. This is appreciably better than the older branch’s silent warm-start exceptions.
3. **Substantial, useful verification and classical comparators.** Inspected tests span domain validation, MILP, QUBO consistency, API and deployment configuration. I independently ran `PYTHONDONTWRITEBYTECODE=1 ../BloodFlow-Q1/.venv/bin/python -m pytest -q -p no:cacheprovider tests/test_allocation_models.py tests/test_production_config.py tests/test_milp_solver.py tests/test_qubo_consistency.py`: **31 passed, 4 subtests passed (1.68 s)**. This was a focused subset, not certification of the whole application. Exact and MILP implementations provide stronger reference points than greedy alone.

## Three weaknesses

1. **Confirmed API/domain type mismatch.** `backend/schemas.py:10-13` calls its base StrictModel but only forbids extra fields; `inventory: dict[str,int]` at line 25 and demand at line 32 permit Pydantic coercion. Reproduced directly: `BloodBankInput(id="b",name="b",location_id="b",inventory={"O":True}).inventory` returns `{"O":1}`. This defeats the deliberate bool rejection in `optimization/models.py:_require_nonnegative_integer` (lines 31-34). Consequence: malformed input becomes real stock before domain validation. Use strict scalar types at the API boundary and test actual request-to-domain conversions.
2. **Single-process demo state and incomplete compute admission control.** `backend/services.py:390-410` stores the last 100 responses in an app-wide list; `results()` returns that list and `backend/routes/results.py:12-14` exposes it without identity scoping. This is shared synthetic result history, not private patient-record leakage; it nevertheless means cross-user mixing and divergent history between workers/restarts. `ScenarioInput` and `BenchmarkRequest` have no maximum collection sizes (`backend/schemas.py:52-62,160-170`); MILP calls at `optimization/milp.py:169,318` pass no time limit, while QAOA only bounds qubits and individual tuning dimensions. Synchronous endpoints can exhaust workers under concurrent expensive requests. CORS does not provide authorization or compute quotas. Introduce bounded jobs, per-run ownership and explicit solver budgets before multi-user deployment.
3. **Maintenance surface is growing faster than interface discipline.** `backend/services.py` is 779 lines, combining transport conversion, metadata assembly, demo replay, artifact I/O, coordination capability descriptions, solver dispatch and result storage. QAOA settings are manually repeated across schemas, conversion, response metadata and experiment defaults (`_qaoa_config`, `_quantum_result`, `experiment_defaults`); the defaults endpoint still documents explicit penalties while benchmark auto-selects them. Frontend adds over 20,000 changed lines since main, including 1,043-line Dock and 1,130-line MagicBento; this is a substantial long-term surface for a research UI. No Python lockfile was found: runtime requirements use broad ranges and duplicate prod/dev dependency entries. Avoid claiming animation components are dead: sampled DotField, DotGrid, MagicRings, MagicBento and CardSwap are imported and used. This is complexity and duplicated configuration, not demonstrated dead-code failure.

## Scope and history actually covered

- Primary branch: status/HEAD, complete branch listing and recent history; `git diff main..HEAD --stat` restricted to source/tests; inspected current models, schemas, service, main, routes, MILP, QAOA guard/fallback symbols, API client, package manifests, README and selected tests. Viewed source history using `git show` for `0d66dce`, `345a42a`, `ebd8f30`, `90b593b`, and HEAD `46693f6`; inspected `main..origin/quantum-optimizer-fix` QAOA/benchmark diff. Primary main is `50c3b24`; `somemore-QAOA-fix` aliases HEAD. Heartbeat commit adds shared CSS component and normalization control; its CSS honors reduced motion.
- `../BloodFlow-Q1`: HEAD/UI branch `b59a72b`, branch listing and recent UI history. Viewed its commit source stat, `d3ec6d2` research-hardening stat and QuantumLab source, main-to-d3 research/test stat, and d3-to-`539a13e` source diff/stat (including extracted QUBO conservative bound and chat additions). UI history removes redundant navigation/dock collision; research UI validates count totals/bit lengths before showing histograms. These are distinct branches, not presumed duplicates.
- `../BloodFlow-Q-Beezsy`: HEAD `0f13187`, branch/history inventory; equivalent primary remote commit was examined through QAOA and benchmark diffs. Older warm-start path catches exceptions silently and had weaker seed handling.
- `../BloodFlow-Q-warm-qaoa-push`: HEAD `0d66dce`, branch/history inventory; inspected same commit’s QAOA source in primary object database, including initialized slack map. No checkout/fetch/reset was performed.
- Non-git copies: compared bytes in eight representative files (services, schemas, models, MILP, QAOA, QUBO, App, requirements). `BloodFlow-Q1-codex-round2-research-hardening` matches d3ec6d2 on all eight; this establishes sampled duplication only. Warm integration and `BloodFlow-Q-main 2` differ from HEAD on six of eight; they differ from each other on five of six compared implementation files (QUBO matches). Examined warm-integration schema diff: lacks newer mixer, initialization and source controls. Examined main-2 QAOA diff: lacks current probability encoding and normalization additions. They are older distinct snapshots and were not runtime-tested.
- Did not inspect jury reports, audit prose, all experiment result artifacts, complete Supabase authorization behavior, or execute browser UX/full quantum suites. Did not infer a full historical audit from commit titles. Focused tests used an already-existing sibling virtualenv; no installs or source changes.

## Interpretation and tough question

README’s synthetic/nonclinical framing is useful, but its universal “MILP <15 ms” phrasing (`README.md` classical baseline sections) overgeneralizes measured cases; the solver has no such guarantee. Likewise the problem pitch invokes perishability and golden-hour limits while inspected domain routes contain costs/times/status rather than age or delivery-deadline constraints. This is an allocation demonstrator with a scientific comparison layer, not evidence of deployed hospital workflow utility.

**Tough question:** Can you show one reproducible scenario where the measured quantum stage improves the same validated objective over a matched-budget classical baseline after accounting for LP seeding, optimizer work and feasibility losses—and explain how that improvement reaches a real operator through a bounded, isolated job lifecycle?

**Personal verdict:** Advance as a research/demo engineering project; withhold production-readiness and quantum-advantage credit. Its core module boundaries, independently validated solver outputs and testing merit respect. The next architecture investment should be typed boundary correctness, reproducible dependencies, job isolation and a smaller coherent service/UI surface, rather than more visual components.
