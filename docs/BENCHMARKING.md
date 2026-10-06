# BloodFlow-Q benchmarking

The benchmark runs the same validated synthetic scenario, objective weights,
and secondary penalty inputs through Greedy, Exact (when its search space is
small enough), and QAOA (when a real solver adapter is provided). Results are
written per scenario and method. Use
`python3 -m optimization.run_benchmark --output results/benchmark.json` to run
the bundled synthetic dataset and write JSON.

The command's objective weights are explicit demonstration settings. They can
be changed with `--critical-weight`, `--unmet-weight`,
`--transport-cost-weight`, and `--transport-time-weight`; they are not
calibrated operational recommendations. Exact enumeration has a configurable
state cap and records `skipped_too_large` when it refuses an oversized case.

## Methods

- **Greedy** builds a deterministic allocation by priority and route burden.
  It is a heuristic and does not guarantee a globally best result.
- **Exact** enumerates every feasible candidate within its configured small
  search limit. For completed cases it supplies the reference minimum of the
  current classical objective.
- **QAOA** uses a measured result only when the caller supplies an actual QAOA
  solver adapter implementing the shared solver interface. If no adapter is
  supplied, the record status is `not_requested` and all measurements are
  null. The benchmark never substitutes expected or sample values.

The Python API `run_benchmark_suite(...)` takes a list of scenarios and may
receive `qaoa_solver=...`. A QAOA adapter result is passed through the same
allocation/report/objective record interface as the classical methods.

## Metrics

- **Objective:** weighted sum of shortage and route burdens, using the supplied
  `ObjectiveConfig`. A lower feasible score is preferred for that scenario.
- **Critical unmet demand:** count of unfilled units in synthetic `high` or
  `critical` urgency rows. This is a logistics priority label, not medical
  triage.
- **Total unmet demand:** unfilled units across all demand rows.
- **Transport cost:** sum of quantity times the synthetic route cost per unit.
- **Average transport time:** quantity-weighted route time per shipped unit;
  it is null if no units were shipped.
- **Feasibility:** result of the shared classical validator. Infeasible QAOA
  samples stay visible as infeasible and are not repaired.
- **Runtime:** wall-clock duration of the solver call as observed by Python.
  It does not include installation, compilation, or remote service time unless
  the adapter includes those steps inside its `solve` call.
- **Approximation gap:** for a completed, feasible QAOA result and completed
  Exact result, `(QAOA objective - Exact objective) / abs(Exact objective)`.
  If Exact is zero and QAOA is also zero, the gap is zero. If Exact is zero and
  QAOA is nonzero, the gap is undefined and is stored as null with an
  explanatory status. If Exact or QAOA did not complete feasibly, the gap is
  null.

The exact solver is a small-instance benchmark, not a scaling method. None of
these measurements establish quantum advantage, clinical validity, real-world
hospital deployment, or patient outcomes. The dataset is synthetic and the
compatibility assumptions are simplified.
