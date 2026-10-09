# BloodFlow-Q

> A reproducible research prototype for comparing classical and QAOA-based approaches to synthetic blood-resource logistics.

All bundled scenarios and experiment data are synthetic. BloodFlow-Q is an operational logistics research prototype and not a clinical transfusion decision system.

## 1. One-line pitch

BloodFlow-Q models how scarce blood-bank inventories can be dynamically allocated across distributed hospital networks during emergencies, comparing deterministic greedy heuristics, exact classical MILP, and simulated QAOA quantum circuits.

## 2. Problem

In emergency medical logistics, blood products are perishable and critically scarce, while hospital demand fluctuates unpredictably across blood groups and urgency tiers. Traditional nearest-neighbor dispatching behaves myopically—fulfilling one hospital's immediate request while inducing fatal shortages across regional trauma centers. Finding the optimal allocation requires solving a multi-commodity flow problem subject to rigid biological compatibility (ABO/Rh), physical inventory caps, golden-hour transit limits, and clinical triage priority within an exponentially expanding combinatorial search space.

## 3. Why it matters

Supply-chain bottlenecks during mass-casualty events or regional transit disruptions directly impact patient survival. When demand surges or transit corridors fail, manual phone dispatching cannot re-optimize multi-facility trade-offs in real time. BloodFlow-Q demonstrates how complex operational constraints can be mathematically formalized, stress-tested against emergency shocks, and solved across both classical algorithms and emerging quantum computing frameworks.

## 4. Solution

BloodFlow-Q delivers an end-to-end optimization and decision-support system featuring:
- **Unified FastAPI & Python Engine:** Orchestrates scenario modeling, constraint validation, and solver execution.
- **Multi-Algorithm Baseline Suite:** Solves allocations using deterministic Greedy, provably optimal classical MILP (SciPy HiGHS in $< 15$ ms), and exhaustive Exact search for small instances.
- **Hybrid Quantum Pipeline:** Formulates allocations as a Quadratic Unconstrained Binary Optimization (QUBO) model mapped to an Ising Hamiltonian, sampled via parameterized QAOA circuits on Qiskit Aer.
- **Zero-Cheating Classical Validator:** Decodes raw quantum bitstrings and rigorously verifies candidate allocations against inventory and compatibility rules—without hidden repairs.
- **Dynamic Emergency Simulation:** Simulates demand shocks and route disruptions, computing real-time before-and-after reallocation metrics.

## 5. Why quantum

Resource allocation with quadratic penalties maps naturally to Ising spin glasses and Quantum Approximate Optimization Algorithms (QAOA). By encoding multi-commodity constraints directly into the problem Hamiltonian $H_C$, we explore how alternating quantum phase-separation and mixer unitaries navigate constrained logistics landscapes, establishing a rigorous, reproducible benchmark for near-term quantum optimization.

## 6. Architecture

```text
Synthetic JSON scenario
        ↓
FastAPI request and service layer
        ↓
Scenario model → objective and constraints
        ├── Greedy heuristic baseline
        ├── MILP solver (SciPy HiGHS classical optimal)
        ├── Exact solver (small cases only)
        └── QUBO → Ising → QAOA simulator → measured bitstring
                                      ↓
                         decoder and classical validation
                                      ↓
                       API result → React dashboard
```

The frontend does not implement optimization mathematics. Backend services call the shared solver modules, and QAOA candidates pass through a classical validator without silent repair.

## 7. Technology stack

- Python, NumPy, SciPy (HiGHS MILP), and Qiskit for modeling and classical/quantum optimization.
- Qiskit Aer for local circuit simulation.
- FastAPI and Pydantic for the API boundary, schemas, and input validation.
- React and Vite for the dashboard, featuring an accessible design system (`StatItem`, `MetaRow`, `StatusBadge`, `EmptyState`) and responsive layouts.
- JSON for synthetic scenario inputs and experiment outputs; CSV export is supported by benchmark utilities.

## 8. QUBO formulation

The allocation problem is represented with binary variables and penalty terms as a quadratic unconstrained binary optimization model. Bounded shipment, unmet-demand, and slack quantities are encoded in bits. Objective terms score critical and general unmet demand plus modeled route cost and time. Explicit penalty weights encode inventory and demand-accounting equalities; the builder checks that configured penalties exceed its conservative objective bound.

This encoding is intended for small examples. It can require many binary variables as scenario size grows. See [docs/QUBO_FORMULATION.md](docs/QUBO_FORMULATION.md).

## 9. QAOA workflow

The QUBO is converted to an Ising representation and cost Hamiltonian. QAOA alternates cost and mixer circuit layers, while a classical optimizer adjusts circuit parameters. Qiskit Aer measures a finite number of shots, the best observed bitstring is decoded through the builder's variable mapping, and the original candidate is checked and scored classically. A measured candidate is not an optimality certificate.

## 10. Emergency re-optimization

The emergency workflow records a baseline, applies a synthetic demand, inventory, route, or priority event to a copied scenario, rebuilds and runs the selected optimizer, then compares allocations and metrics. Demo Mode offers fixed **NORMAL**, **EMERGENCY DEMAND SPIKE**, and **TRANSPORT DISRUPTION** cases. It calls the actual API pipeline; a QAOA failure is shown as an error. See [docs/DEMO_MODE.md](docs/DEMO_MODE.md).

## 11. Classical baselines

- **Greedy** is a deterministic heuristic that prioritizes synthetic urgency and then considers compatible inventory and modeled route burden. It returns quickly, but is not guaranteed to find the global minimum.
- **MILP (HiGHS)** is an exact Mixed-Integer Linear Programming solver using SciPy (`scipy.optimize.milp`). It formulates integer shipment variables and continuous slack, solving the allocation problem to provable global optimality in $< 15$ ms without state-space enumeration caps.
- **Exact** enumerates bounded allocations and finds the minimum objective among feasible candidates for instances within its 50,000 candidate-state cap. It is an exhaustive reference for tiny scenarios, not a scalable solver.

These remain essential comparisons for interpreting a QAOA sample.

## 12. Validation

The data layer rejects malformed or inconsistent scenarios. Classical solvers return feasibility reports. QAOA bitstrings are decoded using their exact QUBO mapping and checked against inventory, demand, compatibility, route availability, and identifier constraints. Infeasible results stay visible; the prototype does not silently repair them.

## 13. Results

The reproducible local experiment run used five one-bank, one-hospital, one-group scenarios. All 15 method runs (Greedy, Exact, and QAOA for each scenario) completed and passed the validator. Mean objective values across these five synthetic cases were **96.42 Greedy**, **95.64 Exact**, and **107.38 QAOA**. QAOA's mean per-scenario approximation gap versus Exact was **47.29%**; its median gap was 0%, reflecting that it matched Exact on four scenarios but returned a worse feasible candidate on the normal reference scenario.

These are descriptive measurements from one small local simulator run, not general performance evidence. QAOA matched Exact on three of the five cases, was slightly worse on one, and had a much larger gap on the normal reference case. See the full [experiment analysis](docs/EXPERIMENT_RESULTS.md), [raw results](experiments/results/20261007-01.json), and [saved configuration](experiments/configurations/20261007-01.json).

**The results do not demonstrate quantum advantage.** In this run QAOA used a local classical simulator and was slower than the classical methods; the scenario set is far too small to support general claims.

## 14. How to run

### Beginner quick start

1. Open Terminal and enter the project folder:

   ```bash
   cd BloodFlow-Q
   ```

   If the project is saved somewhere else, replace this with its folder path.
2. Install local dependencies once:

   ```bash
   ./setup.sh
   ```

3. Start both services:

   ```bash
   ./dev.sh
   ```

4. Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in a browser.
5. Return to the Terminal running `./dev.sh` and press **Control + C** to stop the servers.

For the full first-time guide, including separate backend and frontend startup, see [docs/STARTUP.md](docs/STARTUP.md).

### Prepare Python

From the project root:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

### Start the backend

```bash
.venv/bin/uvicorn backend.main:app --reload
```

The API runs at `http://127.0.0.1:8000`; interactive API documentation is at `http://127.0.0.1:8000/docs`.

### Start the frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend expects the API at `http://127.0.0.1:8000` by default.

### Run a bounded experiment suite

From the project root, the defaults run at most five tiny cases with QAOA depth 1, 128 shots, 15 optimizer iterations, and Exact capped at 50,000 candidate states:

```bash
.venv/bin/python -m experiments.run_experiments \
  --scenarios 5 --seed 7 --p 1 --shots 128 \
  --optimizer COBYLA --max-iterations 15 \
  --penalty-weight 10000 --max-exact-states 50000 \
  --run-id my-run
```

Raw result JSON is written to `experiments/results/`; the matching configuration is stored in `experiments/configurations/`. Analyze the run and regenerate the summary report with:

```bash
.venv/bin/python -m experiments.analyze_results \
  experiments/results/my-run.json \
  --summary-json experiments/results/my-run-analysis.json
```

Scenario count is capped at five, QAOA depth at three, and shots at 1,024 by the experiment command. These safeguards keep the provided workflow suitable for a local laptop. The saved config captures full scenario inputs, objective and penalty weights, QAOA settings, Python/package versions, platform details, invocation arguments, and source-file hashes. Further reproduction guidance is in [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md).

### Deployment preparation

The frontend and FastAPI service are deployed separately on Vercel: [BloodFlow-Q dashboard](https://bloodflow-q.vercel.app) and [BloodFlow-Q API](https://bloodflow-q-api.vercel.app). Follow [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) for project settings, environment variables, smoke checks, and the database decision. This is a public synthetic-data demo, not a clinical service.

## 15. Project structure

```text
main.py           Vercel entry point that exports the existing FastAPI app
backend/          FastAPI routes, schemas, scenario loading, service orchestration
data/             Fictional synthetic banks, hospitals, routes, compatibility
emergency/        Synthetic event models and re-optimization comparisons
experiments/      Bounded experiment runner, raw outputs, configs, analysis
frontend/         React + Vite dashboard and API service layer
optimization/     Scenario models, objective, validator, Greedy, Exact, benchmark
quantum/          QUBO, Ising conversion, local QAOA solver, educational demo
scripts/          Separate local backend and frontend startup scripts
setup.sh          Local Python and frontend dependency setup
dev.sh             Start both local development services together
tests/            Unit and integration tests
docs/             Specifications, guides, assumptions, experiment report
```

## 16. Limitations

- Scenario quantities, route costs/times, urgency labels, and compatibility entries are synthetic assumptions.
- The bundled compatibility matrix is simplified ABO-only logic, not a full transfusion compatibility system.
- The exact solver is guarded and intended for tiny instances.
- QAOA runs on a local classical simulator, uses finite shots, and can return worse or infeasible candidates.
- Runtime depends on machine load and software versions; a fixed seed does not guarantee bit-identical results across platforms.
- The current model is aggregate and single-period. It does not model expiry, route capacity, uncertain supply, or actual delivery.
- The dashboard and API are a local prototype, not a hospital deployment.

## 17. Ethical and safety boundaries

BloodFlow-Q is a research prototype for operational optimization using synthetic data. It is not a clinical transfusion decision system. It does not decide whether an individual should receive blood, provide medical advice, validate clinical compatibility, or measure patient outcomes. Use no real patient or hospital operational data. Do not claim clinical validity, hospital deployment, patient benefit, or quantum advantage.

The simplified compatibility rules must be checked against authoritative transfusion guidance and qualified transfusion-service requirements before any real-world use; this prototype is not suitable for such use. See [docs/SECURITY_AND_SAFETY.md](docs/SECURITY_AND_SAFETY.md).

## 18. References

1. Farhi, Goldstone, and Gutmann, [“A Quantum Approximate Optimization Algorithm”](https://arxiv.org/abs/1411.4028), arXiv:1411.4028.
2. Lucas, [“Ising formulations of many NP problems”](https://doi.org/10.3389/fphy.2014.00005), *Frontiers in Physics* (2014).
3. IBM Quantum, [QAOA tutorial](https://quantum.cloud.ibm.com/docs/en/tutorials/quantum-approximate-optimization-algorithm) and [Qiskit `QAOAAnsatz` API](https://quantum.cloud.ibm.com/docs/en/api/qiskit/qiskit.circuit.library.QAOAAnsatz).
4. Qiskit Aer, [`AerSimulator` reference](https://qiskit.github.io/qiskit-aer/stubs/qiskit_aer.AerSimulator.html).
5. FastAPI, [official tutorial](https://fastapi.tiangolo.com/tutorial/).
6. React, [official learning documentation](https://react.dev/learn/).
7. Vite, [official guide](https://vite.dev/guide/).
