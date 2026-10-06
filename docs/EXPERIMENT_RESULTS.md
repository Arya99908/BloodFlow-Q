# BloodFlow-Q Experiment Results

**Raw data:** [`20261007-01.json`](../experiments/results/20261007-01.json)  
**Configuration:** [`20261007-01.json`](../experiments/configurations/20261007-01.json)

## Methodology

This report is generated from the raw JSON experiment output. It does not alter source measurements. Each method runs on the same compact, fictional scenario with a shared objective. Greedy is the deterministic baseline; Exact enumerates the bounded allocation states up to its configured limit; QAOA uses the local Qiskit Aer simulator, samples finite-shot bitstrings, decodes them, and runs the shared classical feasibility validator. An infeasible QAOA sample is retained as infeasible and is not repaired. Runtime is measured locally and is environment-dependent.

## Number and size of scenarios

The run contains **5 scenarios**. Full scenario inputs and per-case unit counts are in [`20261007-01.json`](../experiments/configurations/20261007-01.json). Each case has one synthetic bank, one synthetic hospital, one modeled blood group, and at most one potential allocation variable. Inventory and demand are bounded by 12 and 7 units respectively. The QUBO bit count is reported per case below. This deliberately small design keeps exact enumeration and the local simulator bounded.

| Scenario | Banks | Hospitals | Groups | Inventory units | Demand units | QUBO bits |
|---|---:|---:|---:|---:|---:|---:|
| normal_reference | 1 | 1 | 1 | 12 | 4 | 10 |
| inventory_shortage | 1 | 1 | 1 | 2 | 6 | 7 |
| demand_below_inventory | 1 | 1 | 1 | 8 | 3 | 8 |
| transport_disruption | 1 | 1 | 1 | 5 | 4 | 6 |
| critical_shortage | 1 | 1 | 1 | 4 | 7 | 9 |

## Parameters

- Objective weights: `{"critical_unmet_weight": 10.0, "secondary_penalty_weight": 0.0, "total_unmet_weight": 5.0, "transportation_cost_weight": 1.0, "transportation_time_weight": 0.1}`
- QAOA: `{"max_iterations": 15, "max_qubits": 16, "optimizer": "COBYLA", "p": 1, "seed": 7, "shots": 128}`
- QUBO penalty weights: `{"demand_penalty_weight": 10000.0, "inventory_penalty_weight": 10000.0}`
- Exact candidate-state cap: `50,000`
- Software versions: `{"numpy": "2.5.3", "qiskit": "2.5.2", "qiskit-aer": "0.17.2", "scipy": "1.18.1"}`

## Per-scenario results

`Feasible` is the validator result. A QAOA objective is reported only for a feasible decoded allocation; an infeasible measured candidate's raw objective expression is not comparable and is excluded from objective statistics. Approximation gap is `(method objective - exact objective) / abs(exact objective)` and is recorded only when both method and Exact results are feasible. Runtime includes solving and the independent validation performed by this runner.

| Scenario | Method | Status | Objective | Critical satisfied | Unmet | Transport cost | Avg travel time | Feasible | Runtime (s) | Gap vs Exact |
|---|---|---|---:|---:|---:|---:|---:|:---:|---:|---:|
| normal_reference | greedy | completed | 25.2 | 100.0% | 0 | 18 | 18 | True | 5.5541e-05 | 0 |
| normal_reference | exact | completed | 25.2 | 100.0% | 0 | 18 | 18 | True | 8.4042e-05 | — |
| normal_reference | qaoa | completed | 82.6 | 50.0% | 2 | 9 | 18 | True | 0.215551 | 2.27778 |
| inventory_shortage | greedy | completed | 152.6 | 33.3% | 4 | 9 | 18 | True | 3.2959e-05 | 0 |
| inventory_shortage | exact | completed | 152.6 | 33.3% | 4 | 9 | 18 | True | 4.3417e-05 | — |
| inventory_shortage | qaoa | completed | 152.6 | 33.3% | 4 | 9 | 18 | True | 0.0618853 | 0 |
| demand_below_inventory | greedy | completed | 18.9 | — | 0 | 13.5 | 18 | True | 2.6292e-05 | 0.26 |
| demand_below_inventory | exact | completed | 15 | — | 3 | 0 | — | True | 4.8459e-05 | — |
| demand_below_inventory | qaoa | completed | 16.3 | — | 2 | 4.5 | 18 | True | 0.0798172 | 0.0866667 |
| transport_disruption | greedy | completed | 140 | 0.0% | 4 | 0 | — | True | 2.0541e-05 | 0 |
| transport_disruption | exact | completed | 140 | 0.0% | 4 | 0 | — | True | 1.6541e-05 | — |
| transport_disruption | qaoa | completed | 140 | 0.0% | 4 | 0 | — | True | 0.0551073 | 0 |
| critical_shortage | greedy | completed | 145.4 | 57.1% | 3 | 28 | 31 | True | 3.1959e-05 | 0 |
| critical_shortage | exact | completed | 145.4 | 57.1% | 3 | 28 | 31 | True | 6.1875e-05 | — |
| critical_shortage | qaoa | completed | 145.4 | 57.1% | 3 | 28 | 31 | True | 0.1181 | 0 |

## Summary statistics

Mean, median, minimum, maximum, and population standard deviation are calculated across available measurements only. No missing or failed run is converted to zero. Objective summaries use feasible results only; the remaining metrics use actual completed outputs, including infeasible QAOA samples. Critical satisfaction is summarized as a fraction from 0 to 1 (the scenario table shows percentages).

### Greedy

Completed statuses: `{'completed': 5}`; feasible: `5`; infeasible: `0`.

| Metric | n | Mean | Median | Min | Max | Std. dev. (population) |
|---|---:|---:|---:|---:|---:|---:|
| Objective | 5 | 96.42 | 140 | 18.9 | 152.6 | 60.8869 |
| Critical satisfaction rate | 4 | 0.47619 | 0.452381 | 0 | 1 | 0.364216 |
| Total unmet demand | 5 | 2.2 | 3 | 0 | 4 | 1.83303 |
| Transport cost | 5 | 13.7 | 13.5 | 0 | 28 | 9.30376 |
| Average travel time | 4 | 21.25 | 18 | 18 | 31 | 5.62917 |
| Runtime (seconds) | 5 | 3.34584e-05 | 3.1959e-05 | 2.0541e-05 | 5.5541e-05 | 1.19026e-05 |
| Approximation gap vs Exact | 5 | 0.052 | 0 | 0 | 0.26 | 0.104 |

### Exact

Completed statuses: `{'completed': 5}`; feasible: `5`; infeasible: `0`.

| Metric | n | Mean | Median | Min | Max | Std. dev. (population) |
|---|---:|---:|---:|---:|---:|---:|
| Objective | 5 | 95.64 | 140 | 15 | 152.6 | 61.8917 |
| Critical satisfaction rate | 4 | 0.47619 | 0.452381 | 0 | 1 | 0.364216 |
| Total unmet demand | 5 | 2.8 | 3 | 0 | 4 | 1.46969 |
| Transport cost | 5 | 11 | 9 | 0 | 28 | 10.8074 |
| Average travel time | 3 | 22.3333 | 18 | 18 | 31 | 6.12826 |
| Runtime (seconds) | 5 | 5.08668e-05 | 4.8459e-05 | 1.6541e-05 | 8.4042e-05 | 2.21871e-05 |
| Approximation gap vs Exact | 0 | — | — | — | — | — |

### Qaoa

Completed statuses: `{'completed': 5}`; feasible: `5`; infeasible: `0`.

| Metric | n | Mean | Median | Min | Max | Std. dev. (population) |
|---|---:|---:|---:|---:|---:|---:|
| Objective | 5 | 107.38 | 140 | 16.3 | 152.6 | 51.8923 |
| Critical satisfaction rate | 4 | 0.35119 | 0.416667 | 0 | 0.571429 | 0.220399 |
| Total unmet demand | 5 | 3 | 3 | 2 | 4 | 0.894427 |
| Transport cost | 5 | 10.1 | 9 | 0 | 28 | 9.55196 |
| Average travel time | 4 | 21.25 | 18 | 18 | 31 | 5.62917 |
| Runtime (seconds) | 5 | 0.106092 | 0.0798172 | 0.0551073 | 0.215551 | 0.0589397 |
| Approximation gap vs Exact | 5 | 0.472889 | 0 | 0 | 2.27778 | 0.903068 |

## Interpretation

These measurements describe only this small synthetic instance set and this local software environment. Greedy and Exact outputs can be compared directly where both completed; Exact serves as an optimum certificate only for cases it actually solved within its cap. QAOA uses a hybrid classical optimizer and local simulator, so its runtime includes classical optimization and simulator work. Finite shots can yield infeasible samples; those remain visible. The sample is too small and the execution setup too limited to support broad performance claims.

## Limitations

- Scenarios contain only one bank, one hospital, and one blood-group label, and use synthetic values. They are not representative of operational networks.
- Compatibility is a simplified prototype assumption, not a complete clinical compatibility model.
- Local simulator results and wall-clock timings depend on package versions, machine load, and platform.
- The QAOA candidate is a measured sample, not an optimality proof. Infeasible samples are not repaired.
- The fixed seed supports repeatability but does not guarantee bit-identical results across environments.

## Quantum advantage statement

**These results do not demonstrate quantum advantage.** They are small, local simulator experiments with a hybrid classical-quantum workflow. No comparison establishes an advantage over classical optimization in runtime, quality, scale, or energy use.

## Data integrity

Raw result values are preserved in the linked JSON output. This report contains derived descriptive statistics only; it does not overwrite or edit raw results.
