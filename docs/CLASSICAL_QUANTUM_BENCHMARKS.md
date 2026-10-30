# BloodFlow-Q: Classical vs. Quantum Benchmark Evidence

**Document Version:** 1.0  
**Scope:** Verified Empirical Results, Mathematical Analyses & Ablation Studies  
**Datasets Referenced:** `warm_qaoa_verified_results.json`, `flagship_20261025_implementation.json`, `comparative-evidence.json`

---

## 1. Executive Summary of Benchmark Findings

BloodFlow-Q conducts empirical evaluations across four distinct solver families:
1. **Classical Exact & Integer Baselines:** SciPy HiGHS MILP, continuous LP relaxation, and brute-force Exact enumeration.
2. **Classical Priority Heuristics:** Urgency-weighted greedy allocation.
3. **Standard QAOA:** Variational alternating ansatz with uniform Hadamard superposition $H^{\otimes n}$ and transverse field $X$ mixer.
4. **Warm-Start QAOA:** Continuous LP-initialized product state $|\psi_0\rangle = \bigotimes R_y(\theta_i) |0\rangle$ with specialized XY and transverse mixers.

---

## 2. Benchmark Case 1: 10-Qubit Compact Synthetic Demo

* **Instance:** 1 Blood Bank, 1 Hospital, Group O demand, transport cost 4.5, time 18 min.
* **Qubits:** 10 binary register variables (4 shipment bits, 5 unmet slack bits, 4 inventory slack bits).
* **Sample Budget:** 512 shots per run across seeds 7, 11, and 19.

### Empirical Sampling Distribution (Averaged across seeds):

| Solver Variant | Depth ($p$) | Restarts | Mean Feasible Shots | Optimal Shots | Wall Clock Time |
|---|---|---|---|---|---|
| **Classical HiGHS MILP** | N/A | N/A | **100.0%** (deterministic) | **100.0%** (optimal: 25.20) | **1.8 ms** |
| **Classical Greedy** | N/A | N/A | **100.0%** (deterministic) | **100.0%** (optimal: 25.20) | **0.4 ms** |
| **Standard QAOA** | $p=1$ | 1 | 2.67% | 0.26% | 245 ms |
| **Standard QAOA (Preset)**| $p=2$ | 3 | 3.91% | 0.78% | 1,209 ms |
| **Warm-Start QAOA ($p=1$)**| $p=1$ | 1 | 9.51% | 9.05% | 304 ms |
| **Warm-Start QAOA (Preset)**| $p=2$ | 3 | **54.43%** | **54.43%** | 1,474 ms |

### Key Findings:
1. **Warm-Starting Dramatically Enhances Sampling Fidelity:**
   Moving from uniform superposition to LP warm-starts increases the probability of measuring an optimal bitstring from **$0.78\%$ to $54.43\%$** (a $>69\times$ boost in optimal shot density).
2. **Classical Domination on Unimodular Flow:**
   HiGHS MILP solves the identical problem to global optimality in **$1.8 \text{ ms}$**, compared to **$1,474 \text{ ms}$** for QAOA on the Aer simulator.

---

## 3. Benchmark Case 2: 13-Qubit Emergency Demand Spike

* **Scenario:** Emergency demand spike from 4 to 16 units of O-negative blood, exceeding Bank A inventory (12 units).
* **Qubits:** 13 binary variables.

### Solved Values:
* **Optimal Allocation (Exact / MILP):** Ship 12 units, unmet = 4 units. **Objective = 215.60** (Runtime: 2.4 ms).
* **Sampled QAOA Candidate ($p=1$, seed 7):** Bitstring `1101000100010`. Ship 8 units, unmet = 8 units. **Objective = 330.40** (Runtime: 480 ms).
* **Approximation Gap:** $+53.2\%$ relative to optimal.
* **Integrity Proof:** The candidate was evaluated strictly without classical repair. Constraint residuals equaled $0.0$, proving that QAOA found a feasible, though suboptimal, local minimum.

---

## 4. Mathematical Explanation of Classical Dominance: The Unimodularity Proof

In `research/quantum_experiments/NECESSITY_EVIDENCE.md`, the research team established why classical algorithms excel on the standard blood allocation model:

1. **Total Unimodularity (TUM):**
   The standard bipartite blood allocation constraint matrix $A$ satisfies the Poincaré total unimodularity criterion:
   - Every column corresponding to a shipment variable $x_{b, h}$ has at most two non-zero entries: $+1$ in the hospital demand conservation row, and $-1$ in the blood bank inventory conservation row.
   - Slack variables $u_{h}$ and $s_{b}$ have single $+1$ diagonal entries.
2. **Consequence:**
   Every extreme point (vertex) of the continuous LP relaxation polytope is guaranteed to be integer-valued. Therefore:
   $$\min_{x \in \mathbb{Z}^n} c^T x = \min_{x \in \mathbb{R}^n} c^T x$$
   The continuous LP relaxation is mathematically identical to the integer optimization problem, meaning simplex or interior-point methods solve it in polynomial time ($O(V^2 E)$).

### Implication for Quantum Research:
Quantum computing offers **no theoretical advantage** for standard single-period flow problems. To realize genuine quantum utility, the problem must incorporate non-unimodular constraints, such as:
* Non-convex fixed route activation fees (fixed dispatch costs).
* Non-linear blood spoilage / shelf-life decay functions.
* Multi-period stochastic demand arrivals.
