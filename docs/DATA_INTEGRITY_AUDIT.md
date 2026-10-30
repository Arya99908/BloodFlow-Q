# BloodFlow-Q — Reports Dashboard Data Integrity & Backend Integration Audit

**Document Version:** 1.0.0  
**Author:** Principal Software Architect & Data Engineering Lead  
**Audit Scope:** Reports Dashboard (`ExperimentReports.jsx`, `ResearchVisualDashboard.jsx`), Telemetry Service (`backend/reporting_service.py`), API Route (`backend/routes/reports.py`), Data Integrity Verification (`tests/test_reporting_telemetry.py`, `frontend/tests/reportingDataIntegrity.test.js`).

---

## 1. Executive Summary & Root Cause Analysis

### The Problem
In the previous UI iteration, an executive visualization layer was created to mirror a reference design layout from Mokkup.ai. However, the data backing the KPI cards, availability combo chart, collected vs. used grouped bars, inflow/outflow curves, expiry heatmap, and regional stock breakdown table was driven by hardcoded mock objects (`INVENTORY_DATA` and `QUANTUM_TELEMETRY_DATA`).

These placeholder numbers displayed arbitrary values (e.g., 5,000 units of A+, 25.2K stock, fake quarterly percentages) that were completely disconnected from BloodFlow-Q's actual backend synthetic data fixtures (`data/blood_banks.json`, `data/hospitals.json`, `data/routes.json`), optimization results, and domain models.

### The Resolution
We performed a full data architecture audit and remediation:
1. **Eliminated all disconnected and arbitrary frontend data:** Removed `INVENTORY_DATA`, `QUANTUM_TELEMETRY_DATA`, and any hardcoded fallback constants.
2. **Established a single backend source of truth:** Implemented `backend/reporting_service.py` and the `GET /reports/telemetry` endpoint. Every single metric, chart coordinate, heatmap tile, and regional breakdown is now calculated dynamically from the active synthetic scenario (`Scenario`).
3. **Strict Mathematical Reconciliation:**
   - **Total Stock Reconciled:** Grand total stock ($71$ units) strictly equals the sum of all bank inventories in `data/blood_banks.json` ($25 + 23 + 23 = 71$).
   - **Regional Stock Reconciled:** North Metro ($25$) + Central District ($23$) + South Coastal ($23$) = $71$ units.
   - **Batch Level Expiry Reconciled:** The discrete inventory batches sum up exactly to the bank inventory for each blood group ($O: 24, A: 18, B: 16, AB: 13$).
   - **Optimal Allocation Reconciled:** The utilized/used units are driven by `GreedyAllocator` / `MILPSolver` optimal allocations ($36$ allocated, $2$ unmet).
4. **End-to-End Filter Propagation:** Filter selections (`Select Blood Group`, `Collection Source`, `Select Hospital/Region`, `Status`, `Period`) now dynamically re-filter all metrics, charts, heatmaps, and tables.
5. **ABO source groups:** Reports display the four source labels without inferring Rh types.

---

## 2. End-to-End Data Flow Architecture

```
+-------------------------------------------------------------------------------+
|                       BACKEND SYNTHETIC SOURCE OF TRUTH                       |
|   data/blood_banks.json   data/hospitals.json   data/routes.json              |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       BACKEND DOMAIN SCENARIO ENGINE                          |
|   backend/data_loader.py  -->  backend/scenario_factory.py                    |
|   Scenario(blood_banks, hospitals, routes, compatibility, synthetic=True)     |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       BACKEND TELEMETRY SERVICE                               |
|   backend/reporting_service.py: build_reporting_telemetry(scenario, period)   |
|   - Deterministic discrete batch generation (seed=20261030)                   |
|   - Greedy / MILP solver allocation integration                               |
|   - Mathematical reconciliation & KPI calculations                            |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       API & SERVICE LAYER                                     |
|   backend/routes/reports.py: GET /reports/telemetry?period=...                |
|   frontend/src/services/api.js: api.getReportingTelemetry(period)             |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       SHARED REPORTING STATE & HOOKS                          |
|   frontend/src/hooks/useReportingTelemetry.js                                 |
|   - Loading, Error, Retry, Provenance metadata                                |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       REPORTS VISUAL DASHBOARD                                |
|   frontend/src/components/ResearchVisualDashboard.jsx                         |
|   [KPI Cards]   [Combo Chart]   [Grouped Bars]   [Heatmap]   [Breakdown Table]|
+-------------------------------------------------------------------------------+
```

---

## 3. Mathematical Metric Definitions & KPI Formulations

Every KPI and chart mark is mathematically calculated as follows:

| Metric Name | Mathematical Formula | Backend Value (Default Scenario) | Verification Status |
|---|---|---|---|
| **Current Units in Stock** | $\sum_{b \in \text{Banks}} \sum_{g} \text{inventory}(b, g)$ | $71$ units | Reconciles to `data/blood_banks.json` |
| **Total Hospital Demand** | $\sum_{h \in \text{Hospitals}} \sum_{g} \text{demand}(h, g)$ | $38$ units | Reconciles to `data/hospitals.json` |
| **Optimal Allocation** | $\sum_{a \in \text{Allocations}} \text{quantity}(a)$ | $36$ units | Computed by `GreedyAllocator` / `MILP` |
| **Unmet Demand Slack** | $\sum_{(h,g)} \text{unmet}(h, g)$ | $2$ units | Shortfall on route/inventory bounds |
| **Blood Diversity Coverage** | $\frac{\text{Count}(\{g \mid \text{stock}(g) > 0\})}{\text{Total Groups}} \times 100\%$ | $100.0\%$ | $4$ of $4$ groups present in stock |
| **Average Shelf Life** | $\frac{\sum_{\text{batch}} \text{units} \times \text{days\_to\_expiry}}{\sum_{\text{batch}} \text{units}}$ | $17.8$ days | Weighted average across $34$ batches |
| **Collection Efficiency** | $\frac{\text{Units Allocated}}{\text{Units Collected}} \times 100\%$ | $42.4\%$ | $36$ allocated out of $85$ collected units |
| **Stock Turnover Rate** | $\frac{\text{Units Allocated / Dispatched}}{\text{Total Stock}} \times 100\%$ | $50.7\%$ | $36$ dispatched out of $71$ stock units |
| **Critical Stock Alert** | $\frac{\text{Count}(\{(h,g) \mid \text{stock}(g) < \text{demand}(h,g)\})}{\text{Total Demands}} \times 100\%$ | $0.0\%$ | Network has sufficient macro buffer |

---

## 4. Visualizations & Chart Data Provenance

### A. Blood Group Availability vs. Required Levels (Combo Chart)
- **Bar Series (Verified Stock):** Direct aggregation of stock for each blood group across all banks.
  - $O: 24$, $A: 18$, $B: 16$, $AB: 13$ (Canonical mode).).
- **Line Series (Target Demand):** Direct aggregation of demand for each blood group across all hospitals.
  - $O: 9$, $A: 12$, $B: 10$, $AB: 7$ (Canonical mode).).
- **Interactivity:** Selecting a blood group isolates and highlights that exact group in the chart.

### B. Blood Group Units Collected vs. Used (Grouped Bar Chart)
- **Collected Series (Dark Crimson):** Units collected into banks during the reporting period.
- **Used Series (Soft Coral):** Genuine units allocated and dispatched to hospitals to satisfy demand.
- **Period Switching:** Supports `Last 7 days`, `Last 30 days`, and `Quarterly`.

### C. Stock Inflow vs. Outflow Trends (Smooth Spline Area Chart)
- **Data Source:** Quarterly ledger transaction records ($Q1$ to $Q4$).
- **Inflow Rate vs. Outflow Rate:** Dual Y-axes showing inflow rate (%) and outflow rate (%).
- **Verification:** Scaled to scenario total volume, displaying genuine quarterly cycle trends without artificial jitter.

### D. Blood Units Approaching Expiry (Heatmap Matrix)
- **Rows:** Source ABO groups (O, A, B, AB).
- **Columns:** $<15$ Days, $15$–$30$ Days, $30$–$45$ Days, $45$–$60$ Days.
- **Reconciliation:** The sum of all $4$ bucket cells for any row strictly equals the total stock for that blood group.
- **Color Scale:** Dynamic intensity mapping ($0$ units = neutral grey; $1$–$2$ = soft peach; $3$–$4$ = warm rose; $5+$ = deep crimson).

### E. Detailed Regional Stock Breakdown Table
- **Regions:**
  - `North Metro Region`: Bank A ($25$ units stock) + Hospital 1 ($13$ units demand). Regional Total = $25$ stock, $13$ demand.
  - `Central District`: Bank B ($23$ units stock) + Hospital 2 ($14$ units demand). Regional Total = $23$ stock, $14$ demand.
  - `South Coastal Region`: Bank C ($23$ units stock) + Hospital 3 ($11$ units demand). Regional Total = $23$ stock, $11$ demand.
- **Collapsible Facility Breakdown:** Expanding any region row displays the underlying facility records, roles, statuses, and inventory counts.

---

## 5. Automated Data Integrity Verification & Test Results

### Backend Test Suite (`pytest`)
- **File:** `tests/test_reporting_telemetry.py`
- **Tests Added & Passing (7/7):**
  1. `test_endpoint_returns_synthetic_telemetry`: Verifies HTTP 200 and schema structure.
  2. `test_total_stock_reconciles_to_bank_records`: Verifies total stock equals sum of bank inventories.
  3. `test_regional_totals_equal_facility_sums`: Verifies region totals equal facility sums.
  4. `test_batch_sums_equal_blood_group_totals`: Verifies discrete batches sum to group inventory.
  5. `test_expiry_matrix_buckets_reconcile_to_inventory`: Verifies heatmap buckets sum to group inventory.
  6. `test_reproducibility_across_calls`: Verifies deterministic output with fixed seed.
  7. `test_kpi_calculations_are_mathematically_exact`: Verifies KPI mathematical formulas.
- **Total Suite Result:** `212 passed, 2 warnings in 7.94s`.

### Frontend Test Suite (`node --test`)
- **File:** `frontend/tests/reportingDataIntegrity.test.js`
- **Tests Added & Passing (4/4):**
  1. `api.getReportingTelemetry forwards request with period parameter`
  2. `frontend reporting dashboard source code does not contain Math.random or hardcoded mock constants`
  3. `regional aggregation matches facility level totals without double counting`
  4. `blood group filtering isolates selected group in availability dataset`
- **Total Suite Result:** `58 passed, 0 failed in 310ms`.

### Production Build Verification (`vite build`)
- Built in `5.91s` with 0 warnings/errors.

---

## 6. Data Provenance & Transparency Notice

The dashboard prominently renders a **Data Provenance Banner**:
```
● Source of Truth: Backend backend.data_loader (blood_banks.json, hospitals.json, routes.json)
  Reconciled Stock: 71 units | Demand: 38 units | Allocated (Optimal): 36 units
  ✔ Integrity Verified: Batch Sum = Total Inventory
```
This clearly identifies the data as research synthetic data, names the underlying data fixtures, and transparently shows the mathematical integrity state.
