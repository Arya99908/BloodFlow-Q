# Flagship implementation evaluation — 25 October 2026

Executed 192 local service calls: eight fixed templates (two policies × two
route states × two critical transport costs), three seeds (7, 11, 19), eight
methods. Stock/demand remain the flagship defaults. Ordering was shuffled with
seed 20261025; no tuning was performed against this suite.

Raw results and environment/source manifest:
[flagship_20261025_implementation.json](../experiments/results/flagship_20261025_implementation.json).

| Method | Feasible selected plans / runs | Matches MILP | Mean service wall time (s) |
|---|---:|---:|---:|
| MILP | 24/24 | Reference | 0.00123 |
| Exhaustive | 24/24 | 24/24 | 0.00042 |
| Greedy | 24/24 | 18/24 | 0.00029 |
| Standard QAOA | 24/24 | 15/24 | 0.08507 |
| Warm QAOA | 24/24 | 24/24 | 0.09196 |
| Warm seed only | 24/24 | 24/24 | 0.05937 |
| XY QAOA | 24/24 | 7/24 | 0.09541 |
| Warm XY | 24/24 | 24/24 | 0.09384 |

Feasible selected plans do not mean every measured bitstring was feasible.
Raw records include shot feasibility and optimizer termination information.
PASS labels in this artifact mean a returned plan passed feasibility validation;
they do not certify convergence or optimality.

Warm seed-only matched every optimum too. These results provide **no evidence
that variational quantum processing improves selected solution quality over the
classical seed**. Classical exact methods were faster on these tiny instances.
Three seeds and related synthetic templates cannot establish general superiority,
significance or real-world benefit. Quantum execution was local ideal simulation,
not hardware. Timings include service model construction, solver and decoding;
they exclude HTTP and production subprocess startup. Inclusive internal timings
must not be summed as disjoint components.

## Implementation checks

- Root pytest: 226 passed and 21 subtests passed; two existing COBYLA warnings
  about minimum function evaluation budgets.
- Frontend suite: 53 tests passed; production build passed using an HTTPS API URL.
- Request oversize rejection, busy admission, real subprocess success and timeout
  termination covered by compute-budget tests.
- New regression tests cover Boolean quantities, zero-variable QAOA, empty XY
  state/circuit agreement, seed-only optimizer bypass, QUBO limits, and policy
  agreement with exhaustive search.
- Modified local API `/demo/flagship` returned the expected feasible MILP plan.
- Native browser automation timed out during updated UI inspection. Complete
  keyboard, mobile-layout and interactive visual verification remains pending.
- Contact migration is prepared, not database-executed or deployed. Actual role
  tests and operator evaluation are outstanding.
