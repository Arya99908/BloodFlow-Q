# BloodFlow-Q: Quantum Hardware Readiness Assessment

**Document Version:** 1.0  
**Status:** Audit & Engineering Specification  
**Scope:** Qiskit Aer Simulation vs. Physical Quantum Processing Units (QPUs)

---

## 1. Executive Summary: What is Real vs. What is Simulated

A central pillar of the BloodFlow-Q project is scientific honesty:

* **Authentic Quantum Circuits:** The project constructs genuine parameterized quantum circuits using Qiskit (`QuantumCircuit`), applies variational angle parameters $(\gamma, \beta)$, transpiles circuits for target gate sets, and samples bitstrings from quantum state distributions.
* **Execution Environment:** All reported experimental benchmarks were conducted on **local classical simulators** (`qiskit_aer.AerSimulator` and statevector evaluations).
* **No QPU Claims:** The project **does not claim** to have achieved physical execution on commercial QPUs (such as IBM Quantum Eagle/Heron, IonQ Aria, or Rigetti Ankaa).
* **No Quantum Advantage Claim:** The project explicitly documents that on the tested synthetic blood allocation instances, classical MILP solvers (HiGHS) solve problems in $< 3 \text{ ms}$ with $0\%$ error, whereas QAOA on simulators takes $\approx 300\text{--}1400 \text{ ms}$ and yields approximation gaps.

---

## 2. Hardware Compatibility Specifications

The compiled QAOA circuits satisfy standard physical QPU execution prerequisites:

| Metric | Measured Value (10-Qubit Demo) | Physical QPU Constraint (e.g. IBM Heron) | Status |
|---|---|---|---|
| **Qubit Count** | 10 to 16 qubits | 133 to 156 qubits available | Fully compatible |
| **Circuit Depth ($p=1$)** | Depth $\approx 22$ gates | Coherence limit $\approx 100\text{--}300$ depth | Fully compatible |
| **Circuit Depth ($p=2$)** | Depth $\approx 44$ gates | Coherence limit $\approx 100\text{--}300$ depth | Fully compatible |
| **Two-Qubit Gates ($ZZ$)**| 18 to 36 $CX$ or $R_{zz}$ gates | Two-qubit gate error $\approx 0.2\text{--}0.5\%$ | Within NISQ threshold |
| **Native Gate Mapping** | $R_x, R_z, CX, SX$ | Native basis $\{ECR, R_z, X, SX\}$ | Fully transpilable |
| **Connectivity** | Dense QUBO requires all-to-all | Heavy-hex or square grid topology | Requires SWAP routing |

---

## 3. Transpilation & Topology Analysis

BloodFlow-Q's QUBO matrices contain quadratic coupling terms $J_{ij} Z_i Z_j$ across non-adjacent decision variables (e.g., shipments sharing inventory rows or demand rows).

When targeting a physical planar or heavy-hex architecture:
1. **SWAP Insertion:** Transpilation with `qiskit.transpiler` at `optimization_level=3` introduces SWAP gates to map non-local couplings onto physical coupling maps.
2. **Qubit Overhead:** A 13-qubit instance requires approximately 24 to 40 additional SWAP operations on a linear or heavy-hex layout, increasing effective circuit depth to $\approx 65\text{--}90$.
3. **Noise Sensitivity:** In a physical NISQ environment without error mitigation, two-qubit gate errors ($0.3\%$ per CX) would degrade sample fidelity by approximately $1 - (0.997)^{70} \approx 19\%$, lowering the observed feasible-shot probability.

---

## 4. Hardware Readiness Checklist & Remaining Work

To transition BloodFlow-Q from local simulation to physical hardware execution:

- [x] Strict gate decomposition into standard Pauli rotations ($R_x, R_y, R_z, CX$).
- [x] Dynamic shot count controls ($128 \le \text{shots} \le 2048$).
- [x] Elimination of statevector cheating in expectation value computation (sample-based estimation).
- [ ] **IBM Quantum / Qiskit Runtime Integration:** Add `QiskitRuntimeService` session management with QPU backend selection (`ibm_brisbane`, `ibm_kyiv`).
- [ ] **Error Mitigation:** Integrate Zero Noise Extrapolation (ZNE) and Twirled Readout Error Extrapolation (TREX) via Qiskit Runtime options.
- [ ] **Parameter Optimization Offloading:** Execute the classical parameter optimization loop (`COBYLA`) asynchronously near the QPU (e.g., via Qiskit Runtime Serverless) to eliminate network latency.
