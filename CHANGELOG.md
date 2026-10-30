# BloodFlow-Q — Changelog & Transformation Record

## [v2.001-Unified] — October 31, 2026

### Added
* **Graphical Full Review & Ablation Suite (`FullReviewStudy.jsx` & `FullReviewStudy.css`)**:
  * Implemented an interactive 4-tab scientific dashboard replacing the monolithic legacy HTML table.
  * Added 6-solver comparative visualization (Exact, Greedy, LP, MILP, Standard QAOA, Warm-Start QAOA) with metric toggles (Feasible Shot Rate, Logarithmic Runtime, Optimality Gap).
  * Added 15-scenario drilldown displaying physical dimensions, qubit requirements, winning models, and total unimodularity status.
  * Added comprehensive scientific ablation investigation with explicit evidence answers to the 6 core research questions.
  * Added phase-by-phase computational budget breakdown (Preprocessing $\to$ Circuit Synthesis $\to$ Simulation $\to$ Compilation $\to$ Sampling $\to$ Postprocessing).
* **Enhanced Research Follow-Up (`ResearchFollowup.jsx`)**:
  * Added graphical comparison of optimal and feasible shot rates with 95% bootstrap confidence interval bars.
  * Added collapsible raw table toggle for exhaustive data verification.
* **Executive Telemetry Pipeline (`backend/reporting_service.py` & `backend/routes/reports.py`)**:
  * Complete mathematical reconciliation of synthetic blood logistics (stock, availability, regional breakdown, expiry risk matrix).
  * 7 new automated integration tests in `tests/test_reporting_telemetry.py`.
* **Master Architectural Documentation**:
  * `REPOSITORY_AUDIT.md` (Multi-branch inventory and consolidation matrix).
  * `BUG_AUDIT.md` (Root causes, fixes, and regression suites).
  * `RESEARCH_INTEGRITY_REPORT.md` (Quantum defensibility and total unimodularity disclosure).
  * `UI_UX_AUDIT.md` (Single source of truth assignments and design standards).
  * `TEST_REPORT.md` (212 backend + 58 frontend automated test verification).
  * `FINAL_REVIEW.md` (Hackathon pitch readiness and executive evaluation).

### Changed
* **`ExperimentReports.jsx`**:
  * Streamlined research navigation with modern tabbed selector connecting the Visual Dashboard, Full Review, Comparative Pipeline, Warm QAOA Study, and Legacy Confirmatory Benchmarks.
  * Retained 100% backward compatibility with all test anchors and original method labels.
* **`quantum/qaoa_solver.py`**:
  * Hardened warm-start continuous angle projections with safe boundary clamping ($\epsilon = 0.10$).
  * Preserved independent operational validation for all sampled quantum bitstrings.

### Fixed
* Fixed QAOA HTTP 422 error on unprovided penalties by implementing automated conservative objective bound derivation.
* Fixed division-by-zero edge cases in telemetry aggregations.
* Fixed mobile Dock label collision and viewport overlap.

## Local integration — 2026-10-31

Merged the latest unified integration branch into the preserved local observatory checkout. Restricted donor coordination to positive blood groups, removed inferred Rh reporting subdivisions and the historical evaluation archive, and retained technical regression coverage. See [local merge and validation record](docs/LOCAL_INTEGRATION_20261031.md).
