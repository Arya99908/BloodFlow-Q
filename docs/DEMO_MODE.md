# Controlled Demo Mode

Demo Mode provides three backend-owned, deterministic scenarios. The page lets a presenter select a scenario and an optimization method. The browser sends the selected ID and experiment settings; it cannot supply replacement inventory, demand, routes, or compatibility data.

## Scenarios

All scenarios start from a small, clearly bounded slice of the bundled synthetic dataset: Bank A, Hospital 1, the O group, its existing route, and the explicit O-to-O prototype compatibility entry. This keeps the QUBO small enough for the configured local simulator. The values are copied from the project JSON files, not generated at run time.

| Scenario | Deterministic change |
| --- | --- |
| NORMAL | Uses the bundled 12-unit O inventory, 4-unit Hospital 1 demand, and available Bank A–Hospital 1 route. |
| EMERGENCY DEMAND SPIKE | Starts from NORMAL, then changes demand to 16 and the synthetic urgency label to `critical` through the emergency event pipeline. |
| TRANSPORT DISRUPTION | Starts from NORMAL, then blocks the Bank A–Hospital 1 route through the emergency event pipeline. |

Urgency is an operational model input only. These scenarios do not represent medical triage or transfusion guidance.

## Running a demonstration

Start the API and frontend using the project setup steps in the root README. Open **Demo mode**, select one of the three named scenarios, choose Greedy, Exact, or QAOA, inspect the settings, then select **RUN DEMO**.

NORMAL invokes the selected optimizer through the regular optimization service. The two event cases invoke the existing emergency re-optimization service, which calculates a before state, applies the fixed event, re-optimizes the modified scenario, validates the result, and returns before/after data. For QAOA this rebuilds the QUBO for each state and runs the configured local simulator; measured samples are decoded and classically validated.

QAOA output is shown only when the simulator returns a measured candidate. Simulator errors and QUBO configuration errors are returned as errors; there is no greedy/exact fallback disguised as QAOA. The two QUBO penalty weights are explicit inputs and must exceed the scenario's objective bound. A result labeled **MEASURED** is an actual backend response for that run.

## API

- `GET /demo-scenarios` returns the fixed scenario catalog.
- `GET /experiment-defaults` returns the running service's QAOA defaults and the project objective defaults.
- `POST /demo-run` accepts a scenario ID, method, objective weights, and, for QAOA, QAOA and penalty settings.

The demo response includes an `experiment_configuration` record. Benchmark JSON and API responses also store the full experiment configuration next to their measured rows.

Demo Mode also offers a separate **PRECOMPUTED EXPERIMENT** view. It loads the checked-in experiment artifact through `GET /precomputed-demo`; these records are historical responses and are never presented as live calculations. See [Precomputed demonstration results](PRECOMPUTED_DEMO.md) and the timed presenter script in [FINAL_DEMO.md](FINAL_DEMO.md).

Every demo run is also saved in the backend's in-memory `/results` history. That history resets when the API process restarts.

## Scope

The demo is a research and hackathon presentation feature using aggregate fictional logistics values. Compatibility rules are simplified assumptions, and results do not establish clinical validity, real deployment readiness, or quantum advantage.
