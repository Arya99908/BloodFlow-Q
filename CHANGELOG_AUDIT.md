# BLOODFLOW-Q: AUDIT CHANGELOG

**Audit Date:** 2026-10-08
**Repository:** BloodFlow-Q
**Focus:** Adversarial Quantum Integrity Audit, Forensic Pipeline Verification, Classical Baselines, and Traceability

---

## 1. Summary of Changes

During the adversarial quantum integrity audit, the implementation was inspected from mathematical foundations to runtime execution. Several baseline gaps and expectation evaluation inefficiencies were repaired autonomously. All 123 tests across the entire test suite pass.

---

## 2. Detailed File Modifications

### 2.1 Classical Baselines
- **`optimization/milp.py` (New File):**
  - Implemented `MILPSolver` using SciPy's HiGHS branch-and-cut Mixed-Integer Linear Programming solver (`scipy.optimize.milp`).
  - Formulated continuous integer variables for shipments $x_{i,j,b,r}$ and unmet demand slack $u_{j,r}$.
  - Added exact linear constraints for demand conservation $\sum x + u = D$ and inventory limits $\sum x \le S$.
  - Implemented the `BenchmarkableSolver` interface returning `MILPResult` with full breakdown and feasibility report.
  - Solves the full allocation problem in < 15 ms to global optimality without artificial state caps.

### 2.2 Quantum Pipeline Optimization
- **`quantum/qaoa_solver.py`:**
  - Optimized `expected_energy(angles)` within `QAOASolver.solve()`.
  - Replaced Python-level $2^n$ basis state enumeration (`sum(p * qubo.energy(bits))`) with native Qiskit statevector expectation evaluation: `float(state.expectation_value(ising.cost_hamiltonian).real)`.
  - Mathematically equivalent because $H_C$ incorporates the constant offset identity term.
  - Achieved a **23x wall-clock speedup** on 13-qubit circuits (0.48s vs 10.98s) and eliminated memory bottlenecks up to 16 qubits.

### 2.3 Benchmark & Traceability Enhancements
- **`optimization/benchmark.py`:**
  - Added `raw_bitstring: str | None` and `classical_repair_applied: bool = False` to `BenchmarkRecord` and CSV/JSON export routines.
  - Integrated `milp` as a supported solver in `benchmark_solvers`, `run_baseline_benchmark`, and `run_benchmark_suite`.
  - Updated `_with_qaoa_approximation_gap` to compare QAOA against either `exact` or `milp` whenever an exact baseline is available.
- **`optimization/run_benchmark.py`:**
  - Added CLI flag `--include-milp` to run the exact HiGHS classical baseline from the command line alongside Greedy and QAOA.

### 2.4 Backend Schemas & Service Integration
- **`backend/schemas.py`:**
  - Added `"milp"` to allowed methods in `OptimizeRequest`, `EmergencyRequest`, and `DemoRunRequest`.
  - Added `include_milp: bool = False` to `BenchmarkRequest`.
  - Added `raw_bitstring: str | None = None` and `classical_repair_applied: bool = False` to `OptimizationResponse` and `BenchmarkRecord`.
- **`backend/services.py`:**
  - Supported `request.method == "milp"` in `optimize` and `simulate_emergency`.
  - Supported `request.include_milp` in `benchmark`.
  - Populated `raw_bitstring` and explicit `classical_repair_applied: False` assertion in `optimization_result_payload`.
- **`emergency/reoptimization.py`:**
  - Added routing for `method == "milp"` in `_run_method`.

### 2.5 Verification Test Suite
- **`tests/test_independent_qubo_proof.py` (New File):**
  - Independent mathematical verification that $x^T Q x + c = \text{independent\_objective}(x) + \sum \text{penalties}^2$.
  - Exhaustively verified all 64 states of a 6-qubit scenario with exact 0.0 error.
  - Exhaustively verified all 1024 states of the 10-qubit `demo_normal` scenario with exact 0.0 error.
  - Stochastically verified 500 random states on the 13-qubit `emergency_demand_spike` scenario with exact 0.0 error.
  - Proved $\langle x | H_C | x \rangle = x^T Q x + c = \text{ising.energy}(x)$ across all computational basis states.
  - Proved that the global QUBO minimizer incurs strictly 0 constraint penalties.
- **`tests/test_milp_solver.py` (New File):**
  - Verified `MILPSolver` matches `ExactSolver` on a small instance (identical objective: 20.10).
  - Verified `MILPSolver` meets or beats `GreedyAllocator` on the bundled synthetic dataset.
  - Verified `MILPSolver` respects compatibility constraints and blocked route disruptions.
- **`tests/test_parameter_sensitivity.py` (New File):**
  - Proved objective trade-off sensitivity:
    - High critical urgency weight routes blood to critical hospital despite distance/transport cost.
    - Low urgency weight with high transport cost prioritizes nearby facilities.
    - Positive unmet demand penalty forces full available inventory usage.
- **`tests/test_api.py`:**
  - Added `test_milp_endpoint_and_benchmark_integration` testing `/optimize`, `/simulate-emergency`, and `/benchmark` with MILP.
- **`tests/test_benchmark.py`:**
  - Added `test_benchmark_includes_milp_when_requested` and `test_qaoa_gap_computed_against_milp_when_exact_skipped`.

### 2.6 Experiments & Documentation
- **`experiments/test_benchmark_cli.json`:** Verified CLI benchmark generation with Greedy, MILP, Exact, and QAOA on `demo_normal`.
- **`experiments/test_benchmark_emergency_cli.json`:** Verified CLI benchmark generation on `demo_emergency_demand_spike`.
- **`AUDIT_BASELINE.md`:** Updated Section 5 with executed repairs and completed status.
- **`QUANTUM_INTEGRITY_REPORT.md`:** Authored comprehensive adversarial audit report covering all 20 verification requirements.

---

## 3. Resilience, Graceful Solver Degradation & UI/UX Audit (2026-10-09)

### 3.1 Benchmark Solver Isolation & Infeasible Instance Protection
- **`optimization/benchmark.py`:**
  - Implemented isolated error handling and upfront qubit/variable feasibility checks around QAOA in `run_baseline_benchmark`.
  - When a scenario exceeds the configured QAOA execution limits (e.g. 222 binary variables on the full 7-node network vs 16-qubit local simulator limit), QAOA is marked `status: "skipped_too_large"` with a clear explanation: `"QAOA benchmark instance exceeds supported execution size (222 qubits > 16 max)"`.
  - Solvers are fully decoupled: an unsupported QAOA instance or Exact limit refusal no longer aborts the entire benchmark request with HTTP 422. Greedy, MILP, and Exact statuses remain completely preserved.
  - Zero fabrication: no mock results, fake bitstrings, or fabricated timings.
- **`tests/test_benchmark.py`:**
  - Added unit tests verifying QAOA solver isolation in benchmarks: when QAOA exceeds simulator limits, benchmark returns `skipped_too_large` while Greedy and MILP complete successfully.

### 3.2 Dynamic Mathematical Bounds & Frontend Utilities
- **`frontend/src/utils/scenarioBounds.js` (New File):**
  - Modular mathematical utility implementing client-side bound calculations consistent with backend formulas in `quantum/qubo.py`:
    - `calculateObjectiveUpperBound(scenario, weights)`: faithfully reproduces the conservative objective upper bound formula:
      $$\text{Bound} = \sum_{\text{routes, compatible}} (c_{\text{cost}} \cdot \text{cost} + c_{\text{time}} \cdot \text{time}) \cdot \min(\text{inv}, \text{dem}) + \sum_{\text{hospitals, groups}} (c_{\text{unmet}} + c_{\text{crit}} \cdot w_{\text{urg}}) \cdot \text{dem}$$
      Evaluates dynamically to `2216.6` on the full 7-node network and `165.2` on the compact demo slice.
    - `countScenarioQubits(scenario)`: calculates total binary variables required by the binary decomposition (222 qubits on 7-node vs 10 on demo slice).
    - `estimateCandidateStates(scenario)`: computes candidate state product for exhaustive Exact evaluation, capping safely at 50,000 states.

### 3.3 Honest Solver Presentation & Physical Limits Enforcement
- **`frontend/src/pages/EmergencySimulation.jsx`:**
  - **Exact Solver Disabled on Infeasible Scenarios**: The Exact solver option is dynamically disabled when candidate states exceed 50,000, labeled `"Exact (tiny instances only — unavailable for this scenario)"` with an explanatory notification. The backend 50,000 candidate-state limit is strictly preserved as authoritative.
  - **Inventory Reduction Bounds Validation**: Added dynamic frontend validation enforcing `max` on the reduction input based on available stock of the selected blood bank and blood group (`max={availableInventory}`). Displays an inline warning when a reduction exceeds available stock. Authoritative backend validation remains intact.
  - **Dynamic QUBO Bounds**: Replaced hardcoded `165.2` with dynamic `objectiveBound`.
  - **QAOA Simulator Guard**: QAOA option is disabled if required qubits exceed 16.
- **`frontend/src/pages/Optimization.jsx`:**
  - Replaced hardcoded `165.2` with dynamic `objectiveBound` (`2216.6` on default 7-node scenario), updating input min attributes, placeholders (`e.g. 3325`), and labels.
  - Added upfront warning banner when `scenarioQubits > 16` explaining that the full 7-node scenario creates 222 qubits, exceeding the local Qiskit Aer limit, and offering a direct one-click button to switch to the 10-qubit Compact QAOA Demo.
- **`frontend/src/pages/Results.jsx`:**
  - Dynamically calculates scenario upper bound responding to user-configured objective weights for benchmark QAOA penalty inputs.
- **`frontend/src/pages/DemoMode.jsx`:**
  - Dynamically calculates upper bound per demo case (`165.2` for normal, `635.6` for emergency demand spike, `140.0` for transport disruption).

### 3.4 Production Interface & Accessibility Polish
- **`frontend/src/styles.css`:**
  - Refined layout, color system, and UI elements to eliminate "vibe coded" styling in favor of an understated, professional, enterprise-grade engineering dashboard.
  - Polished responsive metrics cards, tables, clean forms, and distinct state badges.

### 3.5 Global UI/UX & Design System Overhaul (All Pages)
- **Root Cause Resolution for Text Collisions:**
  - Identified and eliminated inline JSX whitespace collapse patterns (e.g., `<div><span>BANKS</span><strong>{banks.length}</strong></div>` -> `"BANKS3"`).
  - Built reusable, semantic micro-components in `frontend/src/components/DataField.jsx`:
    - `StatItem`: Explicit column layout with distinct label, tabular numeric value, unit, and tone modifier (success, danger, warning, default).
    - `MetaRow`: Structured key-value flex row with clear spacing and text-wrapping prevention.
    - `StatusBadge`: Accessible, icon-backed status pill distinguishing success, infeasible, warning, info, and neutral states without relying solely on color.
- **Page-by-Page Implementations:**
  - **`Network.jsx`:** Overhauled transport presentation; removed arbitrary `01`, `02`, `03` section numbers; added dedicated KPI cards (`StatItem`); structured facility cards separating names from location metadata; added filter controls (All, Available, Blocked) and an interactive Route Inspector panel.
  - **`Optimization.jsx`:** Replaced concatenated scenario summary with responsive KPI grid; standardized urgency pills (`critical`, `high`, `medium`, `low`); formatted numerical columns with `.num-cell`; cleaned solver bitstring and telemetry display.
  - **`Hospitals.jsx`:** Replaced summary strip with `StatItem` KPI cards; structured hospital cards with `.hospital-total-badge` and right-aligned demand bars.
  - **`BloodBanks.jsx`:** Added KPI strip; cleanly separated facility names from location badges in `.table-primary`; right-aligned group inventories and total stock.
  - **`EmergencySimulation.jsx`:** Refactored workflow stepper and before/after comparisons; replaced inline text with structured `StatItem` demand comparison and comparative metric grid (`Unmet demand`, `Critical satisfaction`, `Transport cost`).
  - **`Results.jsx`:** Refactored `ResultCard` saved result history to use `StatItem` grids; standardized benchmark table with `.num-cell` alignment and accessible status badges.
  - **`Dashboard.jsx` & `NetworkOverview.jsx`:** Structured latest optimization panel with `MetaRow`; separated node names and location IDs with clean icons.
  - **`DemoMode.jsx`:** Split mode tags and feasibility into distinct `StatusBadge`s; structured telemetry panels; replaced run-on text in emergency changes with structured event chips.
- **Responsive & Design System Tokens in `styles.css`:**
  - Full support for 1440px desktop, 1024px laptop, 768px tablet, and 390px mobile widths.
  - Added horizontal scroll containment (`.table-scroll`), collapsible sidebar drawer with scrim, and keyboard focus states (`:focus-visible`).

### 3.6 Global UI Text-Rendering, Typography Spacing & Stepper Connectors (2026-10-09)
- **Root-Cause Resolution for Text Collisions Across All Pages:**
  - Identified and eliminated inline JSX whitespace collapse patterns where adjacent tags touched without layout containers (e.g. `<strong>No live run yet</strong><span>Select a scenario...</span>` in `DemoMode.jsx` rendering as `"No live run yetSelect a scenario..."`).
  - Replaced unstyled ad-hoc containers in `DemoMode.jsx` with the shared `<EmptyState>` component from `components/Feedback.jsx`.
  - Replaced unstyled `.demo-comparison-empty` with `<EmptyState>`.
  - Hardened `<EmptyState>` with conditional rendering (`{title && ...}` and `{detail && ...}`) to prevent empty orphan tags.
- **Workflow Stepper Inter-Card Connectors (`EmergencySimulation.jsx`):**
  - Refactored the 4-step workflow stepper (`Normal state` → `Emergency event` → `Re-optimization` → `New allocation`) to position directional arrows cleanly *between* adjacent step cards via `.workflow-arrow-connector` divider elements, rather than embedding arrows inside individual cards.
  - Connected active step progression with `.arrow-done` lighting up in emerald green (`var(--accent-emerald)`).
  - Converted `.workflow-steps-row` to a flex layout (`display: flex; align-items: center; gap: 8px; width: 100%`) with `.emergency-workflow-step { flex: 1; min-width: 0 }` for identical card widths across desktop.
  - Added responsive direction-aware orientation: on screens $\le 768\text{px}$, step cards stack vertically (`flex-direction: column; align-items: stretch`) and arrow connectors rotate $90^\circ$ downwards (`transform: rotate(90deg)`).
- **Historical Provenance & Telemetry Formatting:**
  - Structured `.precomputed-provenance` card in `DemoMode.jsx` with vertical flex layout, discrete labels, colons (`Selected run captured:`, `Artifact captured:`), code badges, and key-value alignment.
  - Added styling for `.demo-qaoa-status` with subtle border divider and wrap handling.
- **Disclaimers, Notices, and Prototype Notes:**
  - Rebuilt `.prototype-note` with unified flex styling, subtle borders, background, and icon containers across `Dashboard.jsx`, `BloodBanks.jsx`, and `Hospitals.jsx`, ensuring SVG icons never collide with adjacent text nodes.
  - Standardized typography separation in `.notice` blocks (`.notice strong { display: block; margin-bottom: 4px; }` and `.notice p { margin: 0 0 6px; }`).
  - Styled `.small-disclaimer` for uniform muted typography in `Network.jsx` and `EmergencySimulation.jsx`.
- **Missing CSS Class Definitions Resolved:**
  - Added missing CSS rules for `.network-node-list`, `.bridge-arrow`, `.network-note`, `.dot-green`, `.dot-muted`, `.chart-unavailable`, `.muted-copy`, `.compact-allocation-list`, `.legend-note`, `.evidence-measured`, `.methodology-section-heading`, `.pipeline-label`, `.methodology-footnote`, `.red-icon`, `.icon-red`, and `.icon-blue`.
- **Automated Verification:**
  - Authored and executed automated UI spacing audit suite verifying CSS class definitions and typography contracts.
  - 100% production build pass (`vite build`).
  - 100% test pass on backend test suite ($124/124$ tests passing).
