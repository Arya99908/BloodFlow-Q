# BloodFlow-Q

**A research prototype for comparing classical and QAOA-based approaches to synthetic blood-resource logistics.**

> All scenarios and experiment data are synthetic. BloodFlow-Q is not a clinical transfusion decision system and does not make decisions for individual patients.

## Problem overview

Blood banks and hospitals can have changing supply, demand, urgency, and transport constraints. BloodFlow-Q demonstrates how an aggregate allocation problem can be modeled, optimized, and checked using fictional data. Its compatibility table is simplified and is not a complete transfusion compatibility system.

The project compares a deterministic greedy heuristic, a classical MILP solver, an exact solver for tiny cases, and measured candidates from QAOA running on a local simulator. It does **not** demonstrate quantum advantage or clinical validity.

## Architecture

```text
Synthetic JSON data
        ↓
FastAPI routes → service layer → allocation model, objective, constraints
                                  ├─ Greedy / MILP / Exact
                                  └─ QUBO → Ising → QAOA simulator
                                                   ↓
                                  bitstring → decoder → classical validator
                                                   ↓
                                      API response → React dashboard
```

Emergency simulation changes a copy of a scenario, runs the selected optimizer again, and reports before/after results. The frontend calls the API; optimization logic stays in the backend.

## Run it locally

### Requirements

- Python 3.11 or newer
- Node.js 20 or newer (npm is included)
- Git and an internet connection for the initial download

### Setup and start

Open a terminal and run:

```bash
git clone https://github.com/Arya99908/BloodFlow-Q.git
cd BloodFlow-Q
./setup.sh
./dev.sh
```

`setup.sh` installs Python packages into the project’s `.venv/` and frontend packages from the lock file. It does not install packages globally. When both servers report ready, open <http://127.0.0.1:5173>. Press **Control+C** in the terminal running `./dev.sh` to stop them.

### Demo steps

1. Open **Demo Mode** and select **NORMAL**, **EMERGENCY DEMAND SPIKE**, or **TRANSPORT DISRUPTION**.
2. Run the demo to execute the selected method through the API. QAOA measurements are live simulator results; failures are shown as errors.
3. Open **Emergency Simulation** to inspect before/after allocation and metrics.

For separate server commands and troubleshooting, see [docs/STARTUP.md](docs/STARTUP.md). The API is available at <http://127.0.0.1:8000> while running locally.

## Source code and project map

The complete application source, tests, synthetic data, experiment records, and documentation are included in this repository. Key modules:

| Path | Contents |
|---|---|
| `frontend/` | React + Vite dashboard, pages, shared UI, and API client |
| `backend/` | FastAPI routes, schemas, data loading/validation, and service layer |
| `optimization/` | Scenario models, objective, constraints, Greedy, MILP, Exact, decoding, and benchmarks |
| `quantum/` | QUBO construction, Ising conversion, QAOA simulator, and educational example |
| `emergency/` | Synthetic emergency events and re-optimization comparisons |
| `data/` | Fictional banks, hospitals, routes, and simplified compatibility data |
| `experiments/` | Reproduction configurations, raw synthetic results, and analysis |
| `tests/` | Unit and integration tests |
| `docs/` | Technical specifications, architecture, math, safety, deployment, and demo guides |

Start with the [technical specification](docs/TECHNICAL_SPECIFICATION.md), [QUBO formulation](docs/QUBO_FORMULATION.md), [QAOA beginner guide](docs/QAOA_BEGINNER_GUIDE.md), and [reproducibility guide](docs/REPRODUCIBILITY.md). Source modules include type hints, docstrings, and explanatory comments where appropriate.

To run tests, install `pytest` in the project environment, then run:

```bash
.venv/bin/python -m pip install pytest
.venv/bin/python -m pytest -q
```

## Scientific and safety limits

- The data and all reported experiments are synthetic; do not enter patient or real hospital operational data.
- QAOA runs on a classical simulator and can return a worse or infeasible candidate. Every candidate is decoded and checked classically; it is not silently repaired.
- Exact search is limited to small cases. MILP is the classical optimization baseline.
- The simplified compatibility assumptions require authoritative review before any real-world use; this prototype is not suitable for clinical use.
- Results do not establish quantum advantage, clinical validity, hospital deployment, or patient outcomes.

Read [security and safety](docs/SECURITY_AND_SAFETY.md), [limitations and results](docs/EXPERIMENT_RESULTS.md), and [deployment instructions](docs/VERCEL_DEPLOYMENT.md) before presenting the project.

## Live demo

- [Dashboard](https://bloodflow-q.vercel.app)
- [API health](https://bloodflow-q-api.vercel.app/health)

Both services deploy from the `main` branch of this repository. See [deployment details](docs/VERCEL_DEPLOYMENT.md).

## References

- Farhi, Goldstone, and Gutmann, [A Quantum Approximate Optimization Algorithm](https://arxiv.org/abs/1411.4028).
- Lucas, [Ising formulations of many NP problems](https://doi.org/10.3389/fphy.2014.00005).
- Official docs: [Qiskit](https://quantum.cloud.ibm.com/docs), [FastAPI](https://fastapi.tiangolo.com/), [React](https://react.dev/), and [Vite](https://vite.dev/).
