# Local app wiring audit

2026-10-23. Checkout: BloodFlow-Q-main 3. Frontend http://127.0.0.1:5173; API http://127.0.0.1:8000. This audit checks source connections, live HTTP contracts, tests and build output. It does not claim a complete visual/browser interaction pass.

## Outcome

166 backend tests and 26 frontend tests pass. The frontend builds successfully in development mode with the actual local API URL. All 44 live HTTP checks pass after restarting the backend with the fixes. Sixteen navigation destinations return the Vite app shell; both historical and latest research JSON assets load and parse. A shell response is not proof that every rendered control works in Brave.

The normal production build rejects an absent HTTPS deployment API URL, as designed. The local build used `VITE_API_BASE_URL=http://127.0.0.1:8000 npm run build -- --mode development`; the production guard was preserved.

## Connections checked

| Area | Frontend call / source | Backend or dependency | Result |
|---|---|---|---|
| Dashboard, banks, hospitals, network | api.getScenario; dashboard also health/results/coordination dashboard | /scenario, /health, /results, /coordination/dashboard | Live HTTP passed; source consumers inspected |
| Quick optimization | App callback -> api.optimize({method:'greedy'}) | BackendService.optimize -> greedy -> shared validator/metrics -> in-memory results | Navigation and stale-state bugs fixed |
| Solver workspace | api.optimize / api.benchmark | greedy, MILP, exact, QAOA adapters | All solvers tested on tiny synthetic payload; full-scenario QAOA resource rejection checked |
| QAOA / warm / XY / warm+XY | qaoa_config and explicit penalties | config conversion -> QUBO -> Ising/circuit -> measurement -> decoder and validator | Four live API variants verified; each returned 64 measured counts and requested settings |
| Live demo | api.runDemo | /demo-run -> controlled scenario and solver | Three scenario types and warm-QAOA path tested |
| Precomputed demo | api.getPrecomputedDemo | /precomputed-demo | Separately labeled stored evidence; no live execution implied |
| Emergency simulation | api.simulateEmergency | event -> modified scenario -> before/after optimization | Demand, inventory, route and priority events passed |
| Solver Lab | api.getResults; benchmark and defaults | /results, /benchmark, /experiment-defaults | Requests routed and saved records retrieved |
| Synthetic request workflow | App shared coordination state and action log | /coordination/demo/start and /action | All steps through completion passed; skipped-step rejection passed; no actual donor contacted |
| Private donor/hospital workflows | donorNetwork service and Supabase Auth | 12 named database RPCs plus RLS-protected tables | All 12 RPC definitions exist in migration sources; private client configuration is absent locally; live private paths not exercised |
| Historical research pages | useResearchStudy | /quantum-value-study.json | Saved Round 2 evidence, not an API solver run |
| Latest follow-up | ResearchFollowup in Reports and Quantum Lab | /quantum-followup-study.json generated from saved analyses | Added current 992-run and 240-run summaries with source hashes, scope and download |
| Chat | api.chat and client fallback | /chat rule-based domain responses | Endpoint tested and two reporting bugs fixed; Chatbot.jsx remains unmounted in App.jsx |
| Navigation | registry and page picker | history pushState/popstate and lazy pages | All route IDs round-trip; malformed encoded URLs now resolve to not-found |

Existing frontend controls do not expose every research candidate or every API setting: Demo explicitly selects the X/warm path, while XY is available through the API. Reduced encodings and feasible Grover research remain isolated experimental code. The new research panel intentionally reads saved results; it does not silently promote those prototypes into production solvers.

## Repairs

1. Quick Optimization previously called setPage directly, leaving the URL and browser history on the old route. It now uses the shared navigation function.
2. An earlier local solver result could override a subsequent global Quick Optimization result; inherited errors and results could also remain visible during later local actions. Local state now synchronizes with global runs and no longer falls back to an obsolete global result after a local submission clears it.
3. Malformed percent-encoded URLs previously threw during route resolution. They now yield not-found.
4. Chat route descriptions used transport_time_hours, while the actual API provides travel_time_minutes. Backend and fallback now use the schema's minutes field.
5. Chat suggestions claimed optimization had started even though they only returned an action button. They now state that execution requires the action. A test verifies /chat does not add solver results.
6. Client fallback could describe empty/zero inventory when no scenario was loaded. It now reports unavailable data.
7. Research pages only exposed the historical Round 2 artifact. Added a separate saved follow-up panel sourced from the current analyses. Historical evidence is preserved and is not pooled with the new studies.

No solver mathematics, defaults, historical counts or previous research results were changed. Earlier source snapshots intentionally no longer match the application files repaired in this audit; their historical hashes were not rewritten.

## Limits and unresolved items

- Native Brave inspection failed with macOS ScreenCaptureKit permission denied. No screen-capture setting was changed and no alternate UI automation was used to bypass it. Visual rendering, actual clicks, keyboard accessibility and runtime browser-console behavior remain unverified.
- Private Supabase configuration is absent. The audit verified migration coverage and existing tests, not deployment migrations, account sign-in, permissions against a live database or real notifications.
- Chat is a rule-based endpoint/fallback, not an external LLM connection. Its UI component is not rendered by the current App and was not enabled as an unsolicited feature.
- In-memory /results history is process-local. The backend was restarted to apply fixes; the HTTP evidence file records audit results. Refreshing the browser preserves no server history across process restarts.
- Existing quantum metadata caveats from the credibility audit (requested warm/mixer labels versus effective initialization in fallback cases) are not solved by this wiring audit. The four ordinary live variants worked; that does not prove truthful labeling under every solver fallback.
- Exact and full-scenario QAOA have resource guards. A guarded rejection is not a broken call and was not replaced with a fabricated result.
- The new summary export is a snapshot. After new research runs, rerun the export script; opening a page does not recompute results.

## Reproduction and evidence

From the repository root:

```sh
../BloodFlow-Q1/.venv/bin/python -m unittest discover -s tests
npm --prefix frontend test
VITE_API_BASE_URL=http://127.0.0.1:8000 npm --prefix frontend run build -- --mode development
python3 scripts/export-research-followup.py
../BloodFlow-Q1/.venv/bin/python audit/app_wiring_20261023/live_check.py
```

The last command requires the local API to be running and adds synthetic entries to its process-local result history. It never writes private records or sends donor messages. See live_http_results.json, frontend_http.json, donor_rpc_coverage.json, private_configuration.json, backend_tests.log, frontend_tests.log and build.log. The export's frontend test checks that displayed summary data agrees with the saved machine-readable analyses.
