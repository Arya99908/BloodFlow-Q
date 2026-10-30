# Full review acceptance ledger — 24 October 2026

Historical snapshot: 24 October 2026, target branch `somemore-QAOA-fix`, starting from `ebd8f30`. This ledger records the evidence and limitations from that review; it is not a claim that every criterion was passed or that those test counts describe the current deployment. The release recheck for the 31 October deployment is recorded below.

## 31 October release recheck

- GitHub main contains the Vercel serverless compute fix and the donor-dashboard sign-in label correction.
- Backend: **242 tests and 21 subtests passed**. Two small-budget SciPy COBYLA warnings are recorded in the test output.
- Frontend: **83 tests passed**. The production build succeeds. Vite reports a 634.74 kB minified comparative-chart chunk, above its 500 kB advisory threshold.
- All 16 frontend paths returned HTTP 200. This checks Vercel routing and the app shell; no fresh interactive browser-console or visual-regression run was available in this recheck.
- Live GET checks passed for `/health`, `/scenario`, `/demo-scenarios`, `/experiment-defaults`, `/precomputed-demo`, `/coordination/capabilities`, `/coordination/dashboard`, `/results`, and `/reports/telemetry`. CORS preflight returned 200 for the website origin; malformed solver input returned a readable 422.
- A live greedy `POST /optimize` returned 200 with a feasible result after the Vercel serverless fix. A live QAOA demo returned 256 measured shots and a feasible decoded result for one synthetic normal scenario. A demand-spike reoptimization returned 200.
- The full synthetic donor workflow reached `Completed`; every state was explicitly marked simulated. Benchmark returned Greedy and MILP results; Exact was skipped at its size guard, and QAOA was not requested in that benchmark call.
- Private donor records remain disabled in the public deployment; the public donor and collection walkthrough is deterministic synthetic demo data. No database migration was applied or live RLS policy exercised in this release.

| Requirement | Disposition and evidence |
|---|---|
| Accessible branches/contributors | Historical metadata review reported five remote branches, four local branches, and 20 reachable commits. Its detailed repository audit export is not included in this release archive. |
| Every application tab | All 16 destinations inspected through components, handlers, APIs and computational paths; HTTP shell/read checks recorded. Source inspection is not a browser click test. Private Supabase workflows are blocked without an authenticated configured session. |
| Mathematical model | Reconstructed and tested bounded binary encoding, objective signs, decoding, penalty-bound logic, LP assumptions and Ising equality. Exhaustive proof JSON per eligible current scenario. Fixed zero-demand MILP shortage rows and LP stock slack; corrected boundary records separate from original runs. [Model audit](mathematical_model_audit.md). |
| Primary research | 21 primary-source candidate assessments with applicability, limitations and implementation dispositions. [Research review](quantum_research_review.md). No hardware/advantage claim. |
| Production improvements | Configurable LP/greedy warm state, first-restart zero/provided parameters, optional initial-energy retention, input validation and honest evaluation/timing/convergence metadata. Defaults preserved. UI exposes research controls in Demo Mode. Retention guarantees ideal expected energy relative to its reference, not feasibility or sample quality. |
| Initial-state/mixer invariants | Unit and independent statevector tests pass. XY conserves only its applicable register invariant; it does not guarantee coupled shipment constraints. Operational feasibility and full encoded equality feasibility are explicitly separated. |
| Scenario inventory | All discovered experiment families have dispositions in [coverage ledger](benchmark_coverage.md). Frozen matrix covers 30 cases and meaningful variants; arbitrary continuous settings and full Cartesian products are not claimed. |
| Fresh measurements | Production: 1,410 attempts, 1,377 completed, 33 documented skips; corrected boundary: 81 attempts, 66 completed, 15 skips. Research: 992 records; supplementary amplitude amplification/noise/scaling; recovered Round2: 198 records; baseline: 15; paired warm: 120. Raw configurations, per-run measurements, summaries and command manifests preserved. Failed validator and interrupted timing run remain separate. |
| Strong baselines/costs | Greedy, LP, MILP, exact; production wall time includes per-run QUBO, warm preprocessing and interpolation training. Separate diagnostic/proof overhead; nested optimizer timing is not double-counted. Classical methods remain faster on this corpus. |
| Final necessity validation | `necessity_final/validation.json`: 240 hybrid runs, 960 rounds, 48 deterministic quantum-round replays, 16 scaling cases, source hashes verified. This final rerun followed report-generator changes; earlier `necessity_v2` validation documents its then-current source and is not a current-source hash claim. |
| Report/artifacts | [Experiment report](EXPERIMENT_RESULTS.md) updated in place, historical content retained; generated from raw SHA-checked summary. CSV/JSON plus SVG/PNG distribution plots under `production_v2/`. Current summary published separately from historical studies in Reports and Quantum Lab. |
| Network implementation | Actual scenario facility/route graph: pan/zoom/fit/reset, search/filters, keyboard selection, node/edge inspector, neighbors, validated saved-proposal overlay, responsive layout. Ten focused graph tests. [Network changes](network_tab_changes.md). |
| Browser experience | Partial: live node inspector, zoom and neighbor filtering verified. Further pointer/keyboard/search/dropdown/reset/mobile/console checks blocked because native Brave is actively presenting; no browser connector available. No claim those checks passed. |
| Regression/build | Historical review recorded 215 Python tests plus 21 subtests, 53 frontend tests, and 45 live HTTP checks. Those historical counts are superseded by the dated release recheck above; its original `audit/full_review_20261024/` evidence directory is not distributed. |
| Final diff/reproduction | Source changes reviewed; `git diff --check` clean. No dependency/cache/credential artifacts added. Recorded source snapshot preserves the pre-boundary-fix production protocol; current code reruns separately. Benchmark scripts reject conflicting resumptions. |

## Explicit limitations

Full 222-qubit production statevector execution and large exact enumeration were skipped by recorded resource caps. Real hardware and production gate-noise configuration are unavailable; supplementary toy-noise simulations are separate. Earlier exploratory/deep grids remain historical where superseded by the current frozen matrix; see the explicit family dispositions rather than interpreting all historical files as rerun. Peak memory is process lifetime high-water, not isolated per trial. Small synthetic instances, optimizer budgets and repeated seeds cannot establish broad scalability or quantum advantage.

## Local application

Frontend: http://127.0.0.1:5173 — Network at `/network`, fresh report at `/reports`, quantum comparisons at `/quantum-lab`. API: http://127.0.0.1:8000. See [startup](STARTUP.md) for portable setup. Private writes and real donor contact were not performed.
