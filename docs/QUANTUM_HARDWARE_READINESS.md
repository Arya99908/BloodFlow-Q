# BloodFlow-Q: Quantum Hardware Readiness Assessment

Version 2.0 — evidence correction for the visual intelligence release candidate.
Contributor history remains in [CONTRIBUTOR_ATTRIBUTION.md](CONTRIBUTOR_ATTRIBUTION.md).

## Execution that is evidenced

Production `quantum/qaoa_solver.py` constructs Qiskit circuits, optimizes their expectation with exact local statevector evaluations, and samples the final circuit with `qiskit_aer.AerSimulator`. Final counts are simulated measurements on a classical CPU. Exact statevector training is a documented simulator method, not hardware measurement-based training.

The separate `research/quantum_experiments/results/study/runs.jsonl` uses `numpy_multinomial_from_exact_ideal_statevector` for its saved samples. Supplementary `aer_noise.jsonl` records toy gate-depolarizing noise; it does not contain device-calibrated noise or physical executions. The UI retains these distinct backend labels.

There is no verified physical QPU execution, provider job identifier, calibration snapshot, or device execution result in these sources. There is no demonstrated quantum advantage.

## Circuit resources must name their compilation scope

The observatory distinguishes two source families:

- `experiments/results/full_review_20261024/production_v2/runs.jsonl`: `optimizer.circuit_depth`, `compiled_operation_counts`, and `two_qubit_gate_count` describe transpilation for Aer at optimization level 0. Aer accepts gates such as RZZ, RXX, and RYY; these counts are not native-device CX or ECR counts.
- `research/quantum_experiments/results/study/*_case.json`: `resources[method]` contains logical and basis-decomposed measurements. The basis is `rz, sx, x, cx`; connectivity is explicitly `all_to_all_unrouted`. This is basis decomposition without physical coupling-map routing. It is a different experiment and must not be presented as the circuit from a selected production run.

For the saved `normal_reference_case.json`, the standard p=2 circuit has 10 qubits, logical depth 29, 66 logical RZZ gates, basis depth 85, and 132 CX gates. The warm circuit has logical depth 33, basis depth 86, and 132 CX gates. These are artifact-specific measurements, not universal depths or fidelity guarantees.

No serialized gate-by-gate circuit is exported with the selected production observations. The inspector therefore shows measured gate counts and parameters, rather than drawing a fictitious circuit.

## What remains unverified

Device-specific transpilation needs an actual target, coupling map, basis, transpiler settings, and saved compiled circuit. Execution needs provider access, a job record, shot counts, and calibration context. These have not been demonstrated here. Basis compatibility alone is insufficient.

Earlier versions of this document asserted approximate depths 22/44, 18–36 two-qubit gates, 24–40 routing SWAPs, and a universal depth/coherence threshold. Those figures lacked matching target-specific artifacts and are withdrawn. Multiplying nominal independent gate fidelities also does not establish feasible-shot probability or application success.

The former checked claim of sample-based expectation training was incorrect: the production solver uses statevectors during classical optimization. A hardware-oriented implementation would require an explicitly measured objective estimator and full accounting of training shots, provider latency, and repeated execution costs.

## Resource and performance interpretation

Full-review process peak RSS is a measured process high-water mark, not incremental circuit memory. Supplementary scaling reports `16 × 2^n` bytes as analytical complex128 statevector storage. It excludes simulator overhead and is not measured peak memory. Quantum-skipped sizes retain null quantum outcomes; their classical baselines are still real measurements.

The strongest demonstrated capability is local simulator research with independently validated allocations. Hardware readiness is a future engineering task, not a completed certification.
