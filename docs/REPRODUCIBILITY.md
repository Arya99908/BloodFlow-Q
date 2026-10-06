# Reproducing BloodFlow-Q Experiments

This guide describes how to run the bundled synthetic examples with recorded settings. It does not claim that an observed result will be scientifically or clinically useful beyond the modeled prototype.

## 1. Prepare the project

From the project root, install the dependencies listed in `requirements.txt` into a Python environment. Install the frontend dependencies from `frontend/package.json`. The root README contains the local API and Vite startup commands. The API loads the versioned JSON files under `data/`; use only these fictional aggregate inputs for this prototype.

## 2. Choose the experiment inputs

For API optimization and benchmark requests, record the following fields with the results:

- **Scenario IDs and method list:** identifies which versioned scenario and methods were requested.
- **Objective weights:** `critical_unmet_weight`, `total_unmet_weight`, `transportation_cost_weight`, `transportation_time_weight`, and `secondary_penalty_weight`. These define the objective trade-offs and are not learned or medically calibrated.
- **QAOA configuration:** `seed`, `p` (QAOA depth), `shots`, `optimizer`, and `max_iterations`. The API accepts COBYLA, Nelder-Mead, and Powell. These settings apply only when QAOA is requested.
- **QUBO penalty weights:** `inventory_penalty_weight` and `demand_penalty_weight`. They must be supplied explicitly and satisfy the QUBO builder's bound checks.
- **Exact state limit:** `exact_max_candidate_states` records the guard used for the small-instance exact solver.

The service exposes its defaults at `GET /experiment-defaults`. Requests can override objective and QAOA values. Benchmark responses and saved benchmark history include an `experiment_configuration` object alongside the measured rows. Missing or unavailable methods remain marked as such; they are never filled with invented measurements.

## 3. Run the controlled demo

Use the **Demo mode** page or `POST /demo-run`. The accepted identifiers are `normal`, `emergency_demand_spike`, and `transport_disruption`. Scenario values and event changes are fixed in backend code and are described in `docs/DEMO_MODE.md`. For repeatability, leave all controls unchanged and use the recorded seed, depth, shots, optimizer, weights, and penalties.

## 4. Run and export a bounded experiment suite

The experiment runner runs Greedy and Exact on all small cases, then runs QAOA with the real local simulator. It is capped at five scenarios and small QAOA settings to keep local resource use bounded:

```bash
.venv/bin/python -m experiments.run_experiments \
  --scenarios 5 --seed 7 --p 1 --shots 128 \
  --optimizer COBYLA --max-iterations 15 \
  --penalty-weight 10000 --max-exact-states 50000 \
  --run-id reproducible-run
```

The raw run goes to `experiments/results/reproducible-run.json`; its matching configuration, including full scenario inputs, is written to `experiments/configurations/reproducible-run.json`. Analyze the raw run without editing it:

The runner refuses to reuse a run ID when either output file already exists. This protects prior measurements and their settings from accidental replacement; choose a new `--run-id` for each run.

```bash
.venv/bin/python -m experiments.analyze_results \
  experiments/results/reproducible-run.json \
  --summary-json experiments/results/reproducible-run-analysis.json
```

The separate `optimization.run_benchmark` command remains available for a single bundled-data classical baseline or a compact `--demo-scenario` benchmark. If any QAOA run in either command cannot run, its actual error is retained; missing QAOA metrics are not replaced with estimates.

## 5. Interpret the seed and preserve provenance

The seed initializes the classical optimizer's starting angles and the local simulator's measurement sampling. It supports repeatable runs in a fixed software and hardware environment. Optimizer behavior, numerical libraries, Qiskit/Aer versions, and platform differences can still change results. A seed is not a guarantee of bit-for-bit reproducibility across environments.

Keep the exported JSON and configuration together with the code revision and the exact command or API request. The experiment runner records Python, platform, NumPy, SciPy, Qiskit, and Qiskit Aer versions, full scenario inputs, solver settings, weights, penalties, invocation arguments, and SHA-256 hashes for the runner and bundled scenario files. API benchmark requests save the requested experiment settings, but operators should separately preserve environment versions when reproducing API-only runs.

## 6. Reporting boundaries

Report measured values exactly as returned, distinguish unavailable values, and retain infeasible QAOA candidates with their validator violations. The exact solver is intended only for tiny benchmark cases. No speedup, quantum advantage, clinical validity, deployment readiness, or patient outcome is established by these experiments.
