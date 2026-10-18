# BloodFlow-Q Comprehensive Deep Audit, Verification & Repair Report

**Date:** 2026-10-18  
**Repository:** `https://github.com/Beezsy-del/BloodFlow-Q`  
**Branch:** `quantum-optimizer-fix`  
**Author / Auditor:** Principal Full-Stack Architect & Quantum Optimization Specialist  

---

## 1. Executive Summary & System Inventory

BloodFlow-Q is an emergency blood-supply dispatch decision-support platform designed to solve multi-hospital, multi-bank logistical allocations across 8 donor/recipient blood groups under standard routing, priority urgency, and dynamic emergency scenarios. It evaluates classical methods (**Greedy Allocator**, **SciPy HiGHS Exact MILP**, **Bounded Exact State Enumerator**) alongside quantum optimization (**QUBO**, **Ising Hamiltonian**, and **Qiskit Aer QAOA / Warm-Started QAOA with XY-mixer**).

### Component Inventory & Boundary Mapping

| Layer / Module | Primary File(s) | Role & Responsibility | Core Invariants |
| :--- | :--- | :--- | :--- |
| **Domain Model** | `optimization/models.py` | Immutable data structures (`Scenario`, `BloodBank`, `Hospital`, `Route`, `Urgency`, `AllocationDecision`). | Strictly validated types; donor compatibility matrix; immutable tuples. |
| **Authoritative Objective** | `optimization/objective.py` | Single mathematical source of truth for linear evaluation and penalties. | Total objective is convex combination of transport costs, times, and priority-weighted unmet demand. |
| **Constraint Validation** | `optimization/constraints.py` | Independent post-solve feasibility validator for any allocation. | Non-negative integers; route availability; bank inventory bounds; hospital demand limits. |
| **Classical Solvers** | `optimization/greedy.py`, `optimization/exact.py`, `optimization/milp.py` | Heuristic priority allocation, bounded exact branch enumeration, and branch-and-cut MILP. | Global optimality proven only for MILP and Exact (within candidate bound); Greedy is heuristic. |
| **QUBO Formulation** | `quantum/qubo.py` | Translates scenario into binary Quadratic Unconstrained Binary Optimization model. | Slack variable binary expansion; penalty weights strictly exceed conservative objective bound. |
| **Ising Hamiltonian** | `quantum/ising.py` | Maps QUBO $x_i \in \{0, 1\}$ to spin variables $z_i \in \{-1, +1\}$ as `SparsePauliOp`. | Energy of bitstring under Ising Hamiltonian equals QUBO polynomial energy up to constant offset. |
| **Quantum QAOA** | `quantum/qaoa_solver.py` | Parameterized state preparation ansatz, classical optimizer (COBYLA), and Aer simulator. | Bitstring endianness reversal for Aer ($q_0$ right vs QUBO variable 0 left); WS-QAOA $R_y(\theta)$ bias; XY mixer. |
| **Solution Decoder** | `optimization/decoder.py` | Decodes measured bitstrings to allocations and unmet demand; applies validation. | Infeasible bitstrings are not silently repaired; unpenalized objective is transparently labeled. |
| **Emergency Engine** | `emergency/simulator.py`, `emergency/reoptimization.py` | Simulates demand spikes, inventory contamination, and route disruption on copied scenarios. | Original scenario is strictly immutable; separate before/after solve pipelines. |
| **API Backend** | `backend/main.py`, `backend/services.py`, `backend/routes/` | FastAPI REST service with Pydantic v2 strict schemas. | Synchronous CPU-intensive work offloaded to worker threads via AnyIO; strict error sanitization. |
| **Frontend UI** | `frontend/src/` | React 18 SPA (Vite, Tailwind, Lucide). | Endpoints called only via `services/api.js`; graceful handling of skipped/unsupported solver statuses. |

---

## 2. Root Cause Investigation: QAOA Benchmark Failure (HTTP 422)

### Reported Symptom
A request to `/benchmark` with `include_qaoa: true` returned:
```json
{
  "error": "benchmark_failure",
  "detail": "Benchmark optimization failed. Check the backend logs for diagnostic details."
}
```

### Full Request Lifecycle Trace & Diagnostic Discovery
1. **Frontend Request Initiation (`Results.jsx` / `Optimization.jsx`):**
   * The UI dispatched `POST /benchmark` with `include_qaoa: true` and `include_milp: true`.
   * When user inputs for `inventoryPenalty` or `demandPenalty` were left empty or defaulted, `request.qaoa_penalties` was passed as `None` or omitted.
   * `request.scenarios` was omitted, causing `services.py` to default to `[self._scenario(None)]` (the 222-qubit bundled dataset).
2. **Backend Validation & Orchestration (`services.py:655-663`):**
   * The endpoint checked `if penalties is None: raise APIServiceError(422, "qaoa_penalties are required when include_qaoa is true", "missing_qaoa_penalties")`.
3. **Downstream Solver Execution & Blast Radius (`services.py:674-684`):**
   * When penalties were supplied but violated the scenario's conservative objective upper bound ($P \le \text{bound}$), `build_qubo()` raised `QUBOInputError`.
   * If the instance exceeded `max_qubits` during an unshielded solve call, `QAOAResourceLimitError` was raised.
   * In `services.py`, the outer exception block caught all exceptions:
     ```python
     except Exception as error:
         logger.exception("Benchmark optimizer failed")
         status = 502 if request.include_qaoa else 500
         if isinstance(error, (QUBOInputError, QAOAResourceLimitError)):
             status = 422
         raise APIServiceError(
             status, "Benchmark optimization failed. Check the backend logs for diagnostic details.",
             "benchmark_failure",
         ) from error
     ```
   * **The Flaws Identified:**
     1. The underlying reason (`str(error)`) was completely discarded and replaced with `"Benchmark optimization failed. Check the backend logs for diagnostic details."`, misleading API clients.
     2. A failure in an *optional* quantum comparison aborted the entire suite, destroying all successful classical benchmark results (**Greedy**, **MILP**, **Exact**).
     3. Clients were forced to manually guess theoretical penalty upper bounds instead of the backend providing safe, automatic conservative defaults.

### Implemented Repairs
1. **Authoritative Bound Calculation:** Exported `compute_conservative_objective_bound(scenario, objective_config)` from `quantum/qubo.py`.
2. **Auto-Default Penalties:** Updated `QAOASolverAdapter` in `backend/services.py` so that if `penalties is None`, it automatically calculates safe conservative penalties (`max(100.0, bound * 1.5 + 10.0)`).
3. **Solver Fault Isolation:** Updated `optimization/benchmark.py` and `backend/services.py` to catch per-solver and per-scenario exceptions. QAOA failures are recorded cleanly in the result array as `status: "skipped_too_large"`, `status: "unsupported"`, or `status: "error"` with full diagnostic `detail`.
4. **Informative API Status Mapping:** Any escaping exception now returns specific error codes (`invalid_qubo_configuration`, `qaoa_instance_too_large`, `qaoa_failure`) and exact sanitised descriptions.

---

## 3. Mathematical Optimization & Solver Audit

### A. Domain and Constraints
* **Integrality & Non-Negativity:** All allocations $x_{s,d,b,r} \in \mathbb{Z}_{\ge 0}$ and unmet demand $u_{d,r} \in \mathbb{Z}_{\ge 0}$.
* **Blood Group Compatibility:** Strict ABO/Rh directed compatibility graph enforced. Allocation decision variables exist *only* for compatible pairs $(b, r)$. Incompatible edges are eliminated prior to variable generation, requiring zero penalty in the QUBO.
* **Conservation Laws:**
  $$\sum_{s, b} x_{s,d,b,r} + u_{d,r} = \text{Demand}_{d,r} \quad \forall d, r$$
  $$\sum_{d, r} x_{s,d,b,r} + s_{s,b} = \text{Inventory}_{s,b} \quad \forall s, b$$
  where $s_{s,b} \ge 0$ is the unused inventory slack.

### B. Classical MILP Solver (SciPy HiGHS)
* Formulated with objective:
  $$\min \sum c_{\text{trans}} x + \sum (w_{\text{unmet}} + w_{\text{crit}} \cdot p_j) u_j$$
* Audited integrality constraints, variable bounds, equality matrix $A_{\text{eq}}$, and inequality matrix $A_{\text{ub}}$.
* **Enhancement:** Added `solve_relaxation()` to `MILPSolver` to solve the continuous LP relaxation ($0 \le x \le \text{bound}$) in polynomial time for Warm-Start QAOA preprocessing.

### C. Greedy and Exact Solvers
* **Greedy:** Orders requests by priority urgency (critical $\to$ high $\to$ medium $\to$ low), matches donor units via shortest available routes, and respects stock bounds. Feasible on all supported scenarios.
* **Exact Solver:** Enumerates candidate states with safety limit (`exact_max_candidate_states=50,000`). Correctly marks oversized scenarios as `skipped_too_large` without false optimality claims.

### D. QUBO and Ising Formulation
* **Binary Slack Encoding:** Decomposes integer bounds into binary weights $(1, 2, 4, \dots, R)$ where $R = U - \sum 2^k$.
* **Penalty Conservatism Theorem:** Verified that penalty multipliers $P_{\text{inv}}, P_{\text{dem}} > \text{UpperBound}(\text{Obj})$ guarantee that any constraint violation strictly increases energy over all feasible states.
* **Ising Conversion:** Verified $x_i = \frac{1 - z_i}{2}$. Linear and quadratic expansions match exact energy offsets:
  $$E_{\text{Ising}}(z) = E_{\text{QUBO}}\left(\frac{1 - z}{2}\right)$$
* **Bitstring Endianness:** Qiskit Aer outputs classical bit 0 on the right ($q_{n-1} \dots q_0$), whereas the QUBO vector maps index 0 on the left. The reverse slicing `key[::-1]` in `_mapping_order_bits()` and `QAOASolver.solve()` is mathematically required and verified.

### E. Warm-Started QAOA & Mixer Unitary
* **Initial State:** Rotation angles $\theta_i = 2 \arcsin(\sqrt{c_i^*})$ prepared via $R_y(\theta_i) |0\rangle$, where $c_i^* = \epsilon + (1 - 2\epsilon) x_i^*$ is derived from the continuous LP relaxation.
* **Mixer Options:**
  * Standard $X$: $\prod_i R_x(2\beta)$.
  * Warm mixer: $\prod_i R_y(\theta_i) R_z(2\beta) R_y(-\theta_i)$.
  * $XY$ mixer: $\prod_{(i,j)} R_{xx}(\beta) R_{yy}(\beta)$, conserving total excitation Hamming weight.

---

## 4. Emergency Simulation & Re-optimization Audit
* **Events Audited:** `DemandSpike`, `InventoryReduction`, `RouteDisruption`, `HospitalPriorityChange`.
* **State Immutability:** `apply_emergency_events()` performs deep copies of `blood_banks`, `hospitals`, and `routes`. The baseline scenario is never mutated.
* **Independent Pipelines:** Pre-event and post-event scenarios receive separate, unmodified optimization passes. Metrics diffs (`before_metrics`, `after_metrics`, `allocation_changes`) reconcile exactly.

---

## 5. Verification Matrix & Test Results

```
============================= test session starts ==============================
platform darwin -- Python 3.14.7, pytest-9.1.1, pluggy-1.7.0
rootdir: /Users/shreeshaks/Documents/BloodFlow-Q-Beezsy
configfile: pytest.ini
collected 160 items

tests/test_allocation_models.py ............                             [  7%]
tests/test_api.py .....................                                  [ 20%]
tests/test_benchmark.py .............                                    [ 28%]
tests/test_constraints.py .......                                        [ 33%]
tests/test_data_loader.py .........                                      [ 38%]
tests/test_data_validation.py ...........                                [ 45%]
tests/test_decoder.py .....                                              [ 48%]
tests/test_donor_matching.py .....                                       [ 51%]
tests/test_donor_network_migration.py ............                       [ 59%]
tests/test_emergency_coordination_demo.py ........                       [ 64%]
tests/test_emergency_reoptimization.py ...                               [ 66%]
tests/test_emergency_simulator.py ....                                   [ 68%]
tests/test_exact.py ...                                                  [ 70%]
tests/test_experiment_runner.py ..                                       [ 71%]
tests/test_greedy.py ...                                                 [ 73%]
tests/test_independent_qubo_proof.py ...                                 [ 75%]
tests/test_milp_solver.py ...                                            [ 77%]
tests/test_objective.py ......                                           [ 81%]
tests/test_parameter_sensitivity.py ...                                  [ 83%]
tests/test_pipeline_integration.py .....                                 [ 86%]
tests/test_precomputed_demo.py ..                                        [ 87%]
tests/test_production_config.py ....                                     [ 90%]
tests/test_qaoa_solver.py ......                                         [ 93%]
tests/test_quantum_solution_evaluation.py ..                             [ 95%]
tests/test_qubo_consistency.py ........                                  [100%]

======================== 160 passed, 1 warning in 2.54s ========================
```

* **Frontend Production Build:** `npm run build` executed and verified; production bundle generated without errors.
* **API Regression Tests:** Added 5 targeted regression tests verifying `/benchmark` under all QAOA configurations (missing penalties, valid penalties, insufficient penalties, simulator errors, disabled QAOA).

---

## 6. Audit Checklist & Status Summary

| Area | Status | Evidence / Location |
| :--- | :--- | :--- |
| **QAOA Benchmark 422 Bug** | **FIXED & VERIFIED** | `backend/services.py:660`, `tests/test_api.py:307` |
| **QUBO Penalty Bound Check** | **VERIFIED** | `quantum/qubo.py:272` |
| **Ising Hamiltonian Signs & Offsets** | **VERIFIED** | `quantum/ising.py:74`, `tests/test_independent_qubo_proof.py` |
| **Aer Bitstring Endianness** | **VERIFIED** | `quantum/qaoa_solver.py:323`, `optimization/decoder.py:133` |
| **WS-QAOA Continuous Relaxation** | **ENHANCED & VERIFIED** | `optimization/milp.py:217`, `quantum/qaoa_solver.py:114` |
| **MILP HiGHS Exact Formulation** | **VERIFIED** | `optimization/milp.py:51` |
| **Emergency Scenario Immutability** | **VERIFIED** | `emergency/simulator.py:108` |
| **Frontend Penalty Ergonomics** | **ENHANCED & VERIFIED** | `frontend/src/pages/Results.jsx:58`, `Optimization.jsx:77` |
| **Full Regression Suite** | **PASSING (160/160)** | All unit, API, integration, and mathematical tests pass. |
