# BloodFlow-Q

> A reproducible research prototype for comparing classical and QAOA-based approaches to synthetic blood-resource logistics.

All bundled scenarios and experiment data are synthetic. BloodFlow-Q is an operational logistics research prototype and not a clinical transfusion decision system.

## Product introduction

The short product tour previews the allocation workspace, network, solver workflow, and research evidence.

<p align="center">
  <a href="https://bloodflow-q.vercel.app/media/BloodFlow-Q_Product_Introduction.mp4">
    <img src="frontend/public/media/bloodflow-q-preview.gif" width="800" alt="BloodFlow-Q product introduction preview. Select to watch the full video." />
  </a>
</p>

<p align="center">
  <a href="https://bloodflow-q.vercel.app/media/BloodFlow-Q_Product_Introduction.mp4"><strong>Watch the full introduction</strong></a> · MP4
</p>

The animated preview is a short excerpt; the full video includes audio.

## Project presentation

The [BloodFlow-Q idea presentation (PDF)](docs/BloodFlow-Q-Idea-Presentation.pdf)
is included in this repository. It introduces the problem, proposed workflow,
optimization mapping, implementation architecture, and a small warm-start
experiment.

**Scope note:** The slides are included as supplied and contain some proposed
or future-state statements. The current prototype does not implement Rh
compatibility, expiry or cold-chain scheduling, golden-hour deadlines, vehicle
routing, or clinical triage. Use the implementation summary and limitations in
this README and the linked technical documentation as the source of truth for
what the software actually does.

## Start with the competition demonstration

Open **Demo mode** from the home page. The new two-bank/two-hospital story makes stock competition, route disruption, and policy trade-offs explicit. Compare service-first and weighted-cost policies, then run MILP/Exact/Greedy, standard/warm/XY QAOA and a genuine seed-only control. Export the complete synthetic plan, settings, shortage explanations and failures.

See [the three-minute demo and evidence guide](docs/COMPETITION_DEMO.md). The demo does not retroactively change the historical results below. No quantum advantage or clinical validation is claimed.

## 1. One-line pitch

BloodFlow-Q models how scarce blood-bank inventories can be dynamically allocated across distributed hospital networks during emergencies, comparing deterministic greedy heuristics, exact classical MILP, and simulated QAOA quantum circuits.

## 2. Problem

BloodFlow-Q studies a synthetic, aggregate, single-period allocation problem: compatible bank inventory must be assigned across hospital demands and available routes. The current core models simplified ABO eligibility, inventory caps, explicit shortage and per-unit transport cost/time. It does not implement Rh compatibility, expiry, vehicle capacity or hard arrival deadlines. Its original constraint matrix has a flow-like integral LP structure; a large QUBO does not establish classical hardness.

## 3. Why it matters

The prototype makes allocation assumptions, trade-offs, and solver outputs visible
in a repeatable synthetic setting. It lets a team inspect how modeled shortages
and transport burdens change under a demand spike or route disruption. Its results
measure software behavior on synthetic scenarios; they do not establish patient
benefit, clinical performance, or deployment readiness.

## 4. Solution

BloodFlow-Q delivers an end-to-end optimization and decision-support system featuring:
- **Unified FastAPI & Python Engine:** Orchestrates scenario modeling, constraint validation, and solver execution.
- **Multi-Algorithm Baseline Suite:** Compares deterministic Greedy, SciPy HiGHS LP/MILP baselines, and exhaustive Exact search for small instances. A MILP result is treated as optimal only when the solver reports success within its configured limit.
- **Hybrid Quantum Pipeline:** Formulates the allocation as a Quadratic Unconstrained Binary Optimization (QUBO), maps it to an Ising Hamiltonian, and samples parameterized QAOA circuits on Qiskit Aer. Optional LP-derived warm-start preparation is a classical initialization choice, not a quantum speedup.
- **Independent feasibility validation:** Decodes sampled bitstrings and checks candidate allocations against inventory and compatibility rules. Any repair is reported separately.
- **Dynamic Emergency Simulation:** Simulates demand shocks and route disruptions, computing real-time before-and-after reallocation metrics.

## 5. Why quantum

QUBO-to-Ising conversion gives this prototype a concrete way to study QAOA on a
small allocation model: a parameterized circuit samples candidate bitstrings,
which are then decoded and checked by ordinary classical code. The current
allocation model also has a strong classical LP/MILP structure, so quantum
computation is not shown to be necessary, faster, or better for this problem.
The purpose is to make the hybrid workflow testable and compare it fairly with
classical methods.

## 6. Architecture

```text
Synthetic JSON scenario
        ↓
Data validation → scenario, objective, and constraints
        ├── Greedy baseline
        ├── LP/MILP baseline (SciPy HiGHS)
        ├── Exact enumeration (tiny cases only)
        └── QUBO → Ising → QAOA simulator → measured bitstring
                     ↑ optional classical LP warm start
                                      ↓
                         decoder → classical validation
                                      ↓
                 FastAPI services → React dashboard
```

The frontend does not implement optimization mathematics. Backend services call the shared solver modules, and QAOA candidates pass through a classical validator without silent repair.

## Donor coordination extension

The site also includes **Donor Network** and **Emergency Blood Request** pages. A deterministic, interactive synthetic workflow works without accounts. Private donor profiles and verified hospital workflows are optional and stay disabled unless Supabase Auth/Postgres is configured and the RLS migration has been applied. The live flow checks authorized, component-specific inventory before offering an in-app request to one consented candidate at a time; there is no real SMS/email outreach, live GPS, clinical compatibility engine, or collection-team dispatch integration. Read [docs/DONOR_NETWORK.md](docs/DONOR_NETWORK.md) before configuring the private data path.

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
- **MILP (HiGHS)** is an exact Mixed-Integer Linear Programming solver using SciPy (`scipy.optimize.milp`). It formulates integer shipment variables and continuous slack, returning an optimum only when HiGHS certifies successful completion within a 10-second solve budget. Runtime depends on the instance and environment; there is no universal 15 ms guarantee.
- **Exact** enumerates bounded allocations and finds the minimum objective among feasible candidates for instances within its 50,000 candidate-state cap. It is an exhaustive reference for tiny scenarios, not a scalable solver.

These remain essential comparisons for interpreting a QAOA sample.

## 12. Validation

The data layer rejects malformed or inconsistent scenarios. Classical solvers return feasibility reports. QAOA bitstrings are decoded using their exact QUBO mapping and checked against inventory, demand, compatibility, route availability, and identifier constraints. Infeasible results stay visible; the prototype does not silently repair them.

## 13. Results

The repository contains separate synthetic studies; their metrics must not be
merged as though they came from one experiment. In the six-case paired LP
warm-start study, standard QAOA averaged a **17.7% feasible-shot rate**, while
LP-warm-start QAOA averaged **32.1%** (a paired mean change of **+14.4
percentage points**). Across 60 runs per method, the best feasible sample
matched the exact reference in **45/60** standard runs and **60/60** warm-start
runs. This is a small simulator study; the LP relaxation is a strong classical
input and can itself supply an optimal allocation on these tiny cases.
Warm-start also adds preprocessing time. These results do not show that the
quantum circuit is better than the classical solver.

The broader October 24 review records 1,377 completed and 33 skipped method
runs over fixed synthetic cases, with explicit status and metric definitions.
See [the full experiment report](docs/EXPERIMENT_RESULTS.md), the
[paired warm-start study](docs/EXPERIMENT_RESULTS_WARM_QAOA.md), and the
[warm-start raw results](experiments/results/warm-qaoa-paired-20261022.json).
The paired study is an imported historical snapshot; its report identifies the
source hashes as belonging to that earlier implementation. It is historical
evidence, not a guarantee that a rerun of the present checkout will reproduce
every bit or timing.

**No result demonstrates quantum advantage.** QAOA was run on a classical
simulator, the cases are small and synthetic, and classical LP/MILP/exact
methods remain essential references.

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

## 18. AI-assisted development disclosure

AI coding and writing tools were used during development for tasks such as
scaffolding, documentation, and test drafting. The project team remains
responsible for reviewing the implementation, understanding the methods, and
presenting measured results and limitations accurately.

## 19. Team

- **Rahul Arya AV** ([@Arya99908](https://github.com/Arya99908))
- **Shreesha KS** ([@Beezsy-del](https://github.com/Beezsy-del))
- **Syed Afnan** ([@syedafnan7-lab](https://github.com/syedafnan7-lab))
- **Shishir Patil** ([@shishir7patil-arch](https://github.com/shishir7patil-arch))

## 20. References

1. Farhi, Goldstone, and Gutmann, [“A Quantum Approximate Optimization Algorithm”](https://arxiv.org/abs/1411.4028), arXiv:1411.4028.
2. Lucas, [“Ising formulations of many NP problems”](https://doi.org/10.3389/fphy.2014.00005), *Frontiers in Physics* (2014).
3. Egger, Mareček, and Woerner, [“Warm-starting quantum optimization”](https://quantum-journal.org/papers/q-2021-06-17-479/), *Quantum* 5, 479 (2021).
4. IBM Quantum, [QAOA tutorial](https://quantum.cloud.ibm.com/docs/en/tutorials/quantum-approximate-optimization-algorithm) and [Qiskit `QAOAAnsatz` API](https://quantum.cloud.ibm.com/docs/en/api/qiskit/qiskit.circuit.library.QAOAAnsatz).
5. Qiskit Aer, [`AerSimulator` reference](https://qiskit.github.io/qiskit-aer/stubs/qiskit_aer.AerSimulator.html).
6. FastAPI, [official tutorial](https://fastapi.tiangolo.com/tutorial/).
7. React, [official learning documentation](https://react.dev/learn/).
8. Vite, [official guide](https://vite.dev/guide/).
