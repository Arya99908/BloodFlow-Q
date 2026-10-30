# BloodFlow-Q — Repository Audit & Consolidation Master Report

## Executive Overview
This document delivers the comprehensive multi-branch reconnaissance, feature comparison matrix, duplicate audit, and consolidation rationale for **BloodFlow-Q** across all upstream, contributor, and research forks.

Repository inspected: `https://github.com/syedafnan7-lab/BloodFlow-Q1`

---

## 1. Branch Inventory & Upstream Remotes

The following remote endpoints were tracked and fetched:
* `origin`: `https://github.com/syedafnan7-lab/BloodFlow-Q1.git`
* `arya-github`: `https://github.com/Arya99908/BloodFlow-Q.git`
* `beezsy-github`: `https://github.com/Beezsy-del/BloodFlow-Q.git`
* `beezsy-local`: Local collaborator workspace snapshot

### Complete Branch Census
| Branch Identifier | Remote / Author | Primary Focus | Status in Unified Integration |
| :--- | :--- | :--- | :--- |
| `integration/bloodflow-unified-2026` | Origin (HEAD) | Master integration of research, telemetry, solvers, and UI | **Active Integration Branch** |
| `origin/codex/bloodflow-ui-refresh` | Codex / Afnan | Dock label fixes, onboarding stepper, border glow polish | Consolidated |
| `origin/codex/round2-research-hardening`| Codex / Afnan | Round 2 benchmark suite, decision-support dashboard | Consolidated |
| `origin/codex/warm-qaoa-integration` | Codex / Afnan | Warm-start state preparation & Egger projection controls | Consolidated |
| `origin/round2-research` | Origin | Copilot controls, QAOA benchmark limits, research console | Consolidated |
| `arya-github/main` | Arya (AV) | Report disclosure bubbles, Vercel Speed Insights, emergency metrics | Reconciled & Enhanced |
| `beezsy-github/quantum-optimizer-fix` | Beezsy (Shreesha) | QAOA 422 penalty bounds, LP relaxation preprocessing in MILP | Consolidated |
| `beezsy-github/bloodflow-q-main-4` | Beezsy (Shreesha) | Heartbeat background, normalization control, interactive network | Consolidated |
| `beezsy-github/fixing-warm-QAOA` | Beezsy (Shreesha) | Continuous angle projection, audited comparison controls | Consolidated |

---

## 2. Feature Comparison Matrix

| Functional Area | Historical / Baseline | Contributor Forks | Unified Architecture (`integration/bloodflow-unified-2026`) |
| :--- | :--- | :--- | :--- |
| **Frontend Architecture** | Static tables, scattered experimental paragraphs | Drifting report bubbles (`report-disclosure`) on Arya fork; Dock collision on mobile | Clean tabbed research navigation, modular visual dashboards, accessible responsive Dock |
| **Backend & Solvers** | Basic Greedy & Exact solver | Standalone LP relaxation; unhandled 422 penalties | Process-isolated backend, auto-derived QUBO penalties, continuous LP relaxation, MILP (HiGHS) |
| **Quantum Algorithms** | Unconstrained QAOA with high infeasibility rates | Custom Egger WS-QAOA and XY-mixer scripts | Rigorous Egger continuous angle projection, Pauli-X vs XY comparisons, zero-angle warm-start |
| **Research Telemetry** | Raw console logs & unnormalized metrics | Unconnected static JSON files | Reconciled synthetic telemetry engine (`reporting_service.py`), zero-randomness mathematical consistency |
| **Full Review & Ablation** | Plain raw text & unstyled 6-column HTML table | Static Markdown report files | Interactive comparative evidence dashboard, 15-scenario drilldown, 6-question scientific ablation matrix |
| **Testing & CI** | Minimal unit tests | Solver regression tests | 212 Python test suites + 58 frontend test suites passing (100% automated coverage) |

---

## 3. Duplicate & Redundant Functionality Audit

1. **Duplicate Study Widgets**:
   * *Problem*: `ExperimentReports.jsx` previously rendered conflicting instances of legacy confirmatory benches and warm-start studies on the same scrolling view.
   * *Resolution*: Segregated into dedicated tabs (`Visual Allocation Dashboard`, `Full Review & Ablation Studies`, `Comparative Pipeline`, `Warm-Start QAOA Study`, `Legacy Confirmatory`).
2. **Conflicting Report Navigation**:
   * *Problem*: Floating/drifting report disclosure bubbles caused layout shifts and accessibility issues on smaller viewports.
   * *Resolution*: Standardized onto high-contrast, keyboard-navigable tab bars with instant state restoration.
3. **Redundant Metric Cards in Workspace**:
   * *Problem*: Dashboard repeated identical counts across multiple tiles without distinguishing aggregate network inventory from regional facility buffer.
   * *Resolution*: Consolidated under the Single Source of Truth rule. Primary overview resides in Dashboard; operational execution in Optimization; scientific evidence in Research.

---

## 4. Consolidation Decisions & Master Implementation

* **Quantum Core**: Preserved `quantum/qaoa_solver.py` with Egger state preparation, exact penalty derivations, and XY mixing. Retained independent operational validator for all quantum samples.
* **Classical Baselines**: Retained exact branch-and-bound, continuous LP relaxation (`optimization/milp.py`), and Greedy heuristic.
* **Executive Telemetry**: Kept `backend/reporting_service.py` to drive all visual combo charts, heatmaps, and regional logistics matrices.
* **Full Review & Ablation**: Completely replaced the monolithic table in `FullReviewStudy.jsx` with an interactive, multi-view graphical evidence dashboard answering the 6 mandatory scientific inquiry questions.
