# BloodFlow-Q review

## Current state

The local integration combines the research dashboards, allocation workflows, network explorer, and quantum execution inspector. The latest merge and validation are recorded in [the integration notes](docs/LOCAL_INTEGRATION_20261031.md).

BloodFlow-Q remains a synthetic logistics research prototype. It has not been clinically validated, and the recorded quantum results come from simulators rather than hardware.

## What to explore

- **Demo (`/demo`):** compare service-first and weighted-cost allocations under the same inventory, demand, and route conditions.
- **Optimization (`/optimization`):** run the supported solvers and inspect allocations, feasibility checks, and reported objective values.
- **Network (`/network`):** inspect facilities, routes, stock, demand, and the selected allocation.
- **Research (`/reports`):** browse the comparative pipeline, warm-start study, Full Review, ablations, and historical records.
- **Quantum lab (`/quantum-lab`):** inspect saved execution settings, measurement distributions, and validation results.

## How to interpret the evidence

Warm-start results measure the effect of classical initialization on quantum sampling. Improved sampling probability does not establish quantum advantage. The LP seed may already contain an optimal allocation for the tested single-period flow formulation.

Total unimodularity applies under the stated flow-model assumptions; it should not be assumed for extensions with additional coupled constraints. XY mixing preserves excitation count but does not, by itself, guarantee a feasible blood allocation.

Compare solvers on the same scenario, constraints, and objective. Keep operational feasibility, encoded feasibility, optimal-shot probability, objective gap, and runtime separate. Historical and current runs have different source revisions and must remain identifiable.

## Validation and remaining work

The latest local checks passed 241 backend tests, 21 subtests, and 83 frontend tests. The production build passed with a large-chart-chunk warning. Backend tests emitted two SciPy COBYLA budget warnings. See [TEST_REPORT.md](TEST_REPORT.md) for scope and commands.

Browser checks covered the merged research tabs and the donor, emergency-request, blood-bank, and quantum-lab pages. They do not establish complete browser or accessibility coverage.

Live database policies and the positive-group migration have not been exercised against a deployed Supabase database. Hardware execution, clinical suitability, large-scale performance, and the provenance of every inherited chart remain outside the latest merge verification.
