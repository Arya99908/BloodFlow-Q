# Classical allocation baselines

This document describes the two classical methods currently available in
`optimization/`. Both use the same `Scenario`, objective weights, objective
function, and feasibility validator. Neither performs patient-level decisions;
they process synthetic aggregate logistics data only.

## Deterministic greedy allocator

`optimization/greedy.py` fills one demand row at a time:

1. It sorts demand rows by urgency category (`critical`, `high`, then
   `medium`, then `low`), then by the row's priority weight, hospital id, and group order.
   These are explicit deterministic tie-break rules. The urgency labels and
   weights are synthetic model inputs, not clinical priorities.
2. For the current hospital/group row, it considers banks with a remaining
   whole unit, an available route, and a compatibility-table entry marked
   `true` for the supplied/recipient group pair.
3. It ranks those candidates by the objective's configured transport-cost and
   transport-time weights. Route time and cost are used as entered and are
   multiplied by quantity when the final objective is reported.
4. It takes as many units as possible from the best candidate without
   exceeding remaining bank stock or the row's remaining demand, then checks
   the next candidate and demand row.
5. It returns the combined shipment list, residual unmet demand for every
   hospital/group row, objective breakdown, and feasibility report.

The code makes no random choices. Ties are settled by route time, route cost,
bank id, and declared blood-group order, so identical inputs produce identical
allocations. It runs the shared validator before returning; an internal
feasibility failure is treated as a code defect.

Greedy is useful because it is understandable, quick, and supplies a practical
classical reference for examples and benchmarks. It can make a locally
attractive choice that prevents a better combination later. For example, a
flexible supply group could be consumed by an early demand row even though a
later row has fewer alternatives. The method never explores all combinations,
so it is **not guaranteed to find the globally minimum objective**.

## Exact tiny-instance solver

`optimization/exact.py` enumerates every bounded integer value combination for
the eligible shipment variables. It rejects combinations that violate shared
inventory or demand constraints, evaluates feasible combinations with the same
objective function, and returns the lowest-scoring candidate it examined.
Because the full finite search space is visited, this is globally optimal for
the encoded scenario and objective whenever the configured state limit is not
exceeded.

The default cap is 50,000 candidate combinations. This is a safety limit for
tiny synthetic examples, not a throughput promise; runtime grows as the product
of every variable's number of possible values. `ExactSolverConfig` can use a
smaller cap in tests. If the estimated space exceeds the cap, the solver raises
`ExactSolverLimitError` before starting. Do not use this solver on large
scenarios.

## Shared benchmark interface

`optimization/benchmark.py` defines the common solver/result protocol and
`benchmark_solvers(...)` runner. It passes each method the same scenario,
objective configuration, and optional secondary penalties, then records its
method, objective value, critical unmet units, total unmet units, transport
cost, average transport time, feasibility, runtime, allocation, and status.
Average transport time is quantity-weighted total route time divided by
allocated units; it is blank when no units were allocated. Runtime is local
wall-clock time for that run.

`run_baseline_benchmark(...)` runs Greedy and attempts Exact within its
configured state cap. If Exact refuses an oversized instance, the report says
`skipped_too_large` and leaves its result metrics blank. When a real QAOA
solver adapter is supplied, the runner executes it and records its measured
candidate; when no adapter is supplied, the QAOA row is marked
`not_requested` and its metrics stay blank. `export_benchmark_results(...)`
writes CSV and/or JSON. CSV contains the comparison metrics; JSON also
includes allocation detail. A runnable tiny example is in
`examples/small_benchmark.py`.

The recognized comparison names are `greedy`, `exact`, and `qaoa`. The QAOA
implementation is in `quantum/qaoa_solver.py`; the benchmark module accepts it
through the same result protocol while keeping QUBO construction and quantum
execution separate. A missing solver is reported as `not_requested`, never as
a measured zero. Benchmark records should be compared only when inputs,
objective weights, and measurement boundaries match. A wall-clock value is a
measurement of that particular run and machine, not a general performance
claim.

## What the result means

Each output is a candidate for the stated synthetic model. Its feasibility
report checks hard logistics constraints, and its objective breakdown explains
the configured score. Neither a feasible allocation nor a lower score is
clinical advice or evidence about real hospital operations.
