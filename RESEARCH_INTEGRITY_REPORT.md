# BloodFlow-Q — Research Integrity & Quantum Defensibility Report

## Executive Summary
This document provides an unsparing, mathematically rigorous evaluation of the quantum optimization algorithms, classical baselines, and empirical results implemented in **BloodFlow-Q**.

The primary objective is **scientific credibility**: clearly distinguishing genuine mathematical achievements from promotional claims, documenting total unimodularity, disclosing hardware limitations, and ensuring full transparency for competition judges and peer reviewers.

---

## 1. Problem Formulation & Constraint Structure

The blood allocation network is modeled as a multi-echelon capacitated logistics optimization problem:
$$\min_{x} \sum_{i \in B, j \in H, g \in G} c_{ij} x_{ij}^g + \sum_{j \in H, g \in G} w_j^g u_j^g$$
subject to:
1. **Supply Bounds**: $\sum_{j} x_{ij}^g \le S_i^g \quad \forall i \in B, g \in G$
2. **Demand Fulfillment & Shortage**: $\sum_{i} x_{ij}^g + u_j^g \ge D_j^g \quad \forall j \in H, g \in G$
3. **Route Capacity**: $\sum_{g} x_{ij}^g \le C_{ij} \quad \forall (i, j) \in E$
4. **Integrality**: $x_{ij}^g \in \mathbb{Z}_{\ge 0}, \quad u_j^g \in \mathbb{Z}_{\ge 0}$

### Total Unimodularity (TUM) Disclosure
* **Theorem**: When route capacities $C_{ij}$ are unconstrained or bipartite, the constraint matrix of the single-period transportation problem is **totally unimodular**.
* **Direct Implication**: The extreme points of the continuous LP relaxation polytope are **strictly integral**. Consequently, standard simplex / interior-point LP algorithms directly identify the integer-optimal solution in polynomial time ($< 1$ ms) without requiring branch-and-bound cuts.
* **Scientific Stance**: BloodFlow-Q explicitly discloses this mathematical reality in its research UI and documentation. We do not manufacture artificial hardness or claim quantum superiority over problems that classical linear programming already solves to global optimality in sub-millisecond time.

---

## 2. Quantum Implementation & Algorithmic Mechanics

### A. QUBO & Ising Hamiltonian Construction
* Binary register reduction maps integer shipments to compact binary strings: $x_{ij}^g = \sum_{k=0}^{K-1} 2^k b_{ijk}^g$.
* Quadratic penalty terms enforce equality and inequality constraints:
  $$H_C = H_{\text{cost}} + \lambda_{\text{supply}} H_{\text{supply\_pen}} + \lambda_{\text{demand}} H_{\text{demand\_pen}} + \lambda_{\text{capacity}} H_{\text{cap\_pen}}$$
* Exact energy equivalence is verified for all evaluated scenarios via exhaustive enumeration proof artifacts (`tests/test_independent_qubo_proof.py`).

### B. Warm-Start QAOA (Egger et al. Formulation)
* **Classical Preprocessing**: Solves the continuous LP relaxation in polynomial time ($0.77$ ms) to obtain fractional optimal assignments $x^* \in [0, 1]^N$.
* **Angle Projection**: Maps continuous assignments to single-qubit rotation angles $\theta_i = 2 \arcsin(\sqrt{x_i^*})$. To avoid boundary singularities at $\theta \in \{0, \pi\}$, angles are clamped within $[\epsilon, \pi - \epsilon]$ with $\epsilon = 0.10$.
* **Initial State**: $|\psi_0\rangle = \bigotimes_{i=1}^N R_Y(\theta_i) |0\rangle$.
* **Measured Outcome**: In 75 paired trials across 15 scenarios, Warm-Start QAOA boosted the operational feasible shot rate from **33.40%** (standard uniform superposition) to **71.44%**, with zero optimality gap on returned feasible samples.

### C. The XY-Mixer Reality Check
* **Formulation**: Implements exchange Hamiltonian $H_{XY} = \frac{1}{2} \sum_{(i,j)} (X_i X_j + Y_i Y_j)$ conserving total Hamming weight ($\sum_i Z_i = \text{const}$).
* **Empirical Finding**: While XY mixers strictly preserve the total count of 1s, they do **not** preserve bipartite allocation constraints between disjoint blood banks and hospitals.
* **Result**: On standard QAOA, XY mixer yielded **19.65%** feasible shots (vs **33.40%** for X mixer); on warm-start QAOA, Warm+XY reached **54.60%** (vs **71.44%** for Warm+X). BloodFlow-Q explicitly reports this finding rather than claiming XY mixers universally preserve feasibility.

---

## 3. Supported vs. Unsupported Claims

| Claim | Verified Status | Scientific Verdict |
| :--- | :--- | :--- |
| **"Warm-Start QAOA dramatically improves feasible bitstring sampling"** | **SUPPORTED** | Empirically verified: $+38.04$ percentage point increase across 75 paired seed trials. |
| **"BloodFlow-Q demonstrates Quantum Supremacy / Advantage"** | **UNSUPPORTED** | **REJECTED**: Classical solvers (LP: 0.77 ms, MILP: 2.76 ms, Greedy: 54.7 µs) reach global optimum orders of magnitude faster than Qiskit Aer simulation (~560 ms). |
| **"XY Mixers eliminate the need for constraint penalty weights"** | **UNSUPPORTED** | **REJECTED**: Bipartite supply-demand constraints couple multiple registers; Hamming weight conservation is insufficient. |
| **"Evaluations have been executed on physical QPU hardware"** | **UNSUPPORTED** | **DISCLOSED**: All 1,377 runs executed on classical simulators (Qiskit Aer). Hardware readiness is documented as pulse schedules and T2 budget constraints. |
| **"Classical LP solves single-period baseline to global integer optimality"** | **SUPPORTED** | Empirically and theoretically proven via Total Unimodularity. |
