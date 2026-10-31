# BloodFlow-Q — Issue and defect resolution log

## Overview
This report records technical issues identified during development, the fixes made, and the regression tests used to verify them.

---

## 1. Resolved Bugs & Structural Fixes

### Bug 1: QAOA HTTP 422 Unhandled Penalties Exception
* **Symptom**: Calling `/api/benchmark` or `/api/optimize` with QAOA failed with HTTP 422 Unprocessable Entity when penalty weights were not explicitly specified.
* **Root Cause**: The solver constructor required non-null penalty dictionary keys without providing a conservative fallback, causing unhandled key errors during QUBO construction.
* **Fix**: Implemented `compute_conservative_objective_bound` in `quantum/qubo.py` to auto-derive safe penalty bounds from the scenario objective coefficients when penalties are omitted.
* **Verification**: Added automated regression suites in `tests/test_api.py` and `tests/test_benchmark.py`.

### Bug 2: Telemetry Data Inconsistency & Arbitrary Numbers
* **Symptom**: Reports dashboard exhibited mathematical reconciliation discrepancies (regional stock sum did not equal total network inventory; negative percentage deltas occurred when denominator was zero).
* **Root Cause**: Frontend components previously utilized uncoupled helper functions that calculated percentages locally without verifying global invariants against the active scenario.
* **Fix**: Built `backend/reporting_service.py` to calculate all availability, batch expiry, inflow/outflow, and regional breakdown matrices directly from the scenario state with strict zero-division guards.
* **Verification**: Verified via `tests/test_reporting_telemetry.py` (all 7 suites passing) and `frontend/tests/reportingDataIntegrity.test.js`.

### Bug 3: FullReview Monolithic Table & Lack of Graphical Evidence
* **Symptom**: The Full Review section presented 1,377 trials as a raw, static, unstyled HTML table, obscuring critical ablation insights and making comparisons harder to inspect.
* **Root Cause**: The component was a legacy stub that simply iterated over `study.methods` without providing comparative visual dimensions, logarithmic scaling, or ablation breakdowns.
* **Fix**: Transformed `FullReviewStudy.jsx` into a 4-tab interactive graphical evidence suite:
  1. 6-Solver Comparison with dynamic metric toggles (Feasible Shot Rate, Logarithmic Runtime, Optimality Gap).
  2. 15-Scenario Drilldown showing physical characteristics, qubit requirements, and winning solver.
  3. Interactive Ablation Suite with structured answers to the 6 scientific inquiry questions.
  4. Phase-by-phase computational timing bar (Preprocessing $\to$ Circuit $\to$ Simulation $\to$ Compilation $\to$ Sampling $\to$ Postprocessing).
* **Verification**: Verified via `frontend/tests/qaoaVariants.test.js` and Vite production build.

### Bug 4: Mobile Dock Label Collision & Z-Index Overlap
* **Symptom**: On narrow viewports (< 768px), Dock labels collided with bottom buttons and modals, preventing interaction with the skip link and footer.
* **Root Cause**: Fixed `panelHeight` and unconstrained label margins in `frontend/src/components/Dock.css`.
* **Fix**: Adjusted magnification scales, added media queries for responsive dock collapse, and applied `isolation: isolate` with safe viewport padding.
* **Verification**: Tested responsive breakpoints and verified clean click targets.

### Bug 5: Stale State and Unmounted Component Fetch Race Conditions
* **Symptom**: Rapid navigation between research tabs caused uncaught promise rejections and stale study artifacts to overwrite newly selected tabs.
* **Root Cause**: Missing `AbortController` cancellation or unmounted cleanup guards in `useResearchStudy`, `FullReviewStudy`, and `ResearchFollowup`.
* **Fix**: Added `AbortController` signal forwarding and `isMounted` flags across all research data-fetching effects.
* **Verification**: Verified via `frontend/tests/measurementValues.test.js`.

---

## 2. Integrity Verification
The integration snapshot reported 212 backend and 58 frontend tests passing. See [TEST_REPORT.md](TEST_REPORT.md) for the latest local validation.
