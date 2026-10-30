# Visual intelligence implementation map

## Verified starting point

The requested working copy is `Documents/BloodFlow-Q-main 3`. Its original branch was `evenmore-fix-and-heartbeat-additon` at `46693f6`, with 23 modified tracked files plus flagship, bounded-job, donor-lifecycle and evaluation additions. Those contributions were preserved in backup commit `6effd80` before the feature branch was based on the verified integration commit `cfe11b1` from `syedafnan7-lab/BloodFlow-Q1`, branch `integration/bloodflow-unified-2026`.

The actual stack is React 19.3.1 and Vite 6 with FastAPI, SciPy HiGHS and local Qiskit Aer. The app already has lazy page routes, two themes, an interactive SVG network, a clinical-policy fixture, research assets and independent allocation validation. Heavy operations have a two-job admission semaphore; disposable spawned workers and hard termination are enabled in production. Private coordination remains a separate opt-in Supabase path.

## Decisions

| Candidate | Decision and task fit |
| --- | --- |
| Apache ECharts | Select as the only new visualization engine for coordinated scatter, box, heatmap, resource and flow views; share initialization, resizing, theme changes and disposal. |
| Plotly | Not selected: a second general analytical chart engine duplicates ECharts and increases maintenance. |
| D3.js | Not selected as a dependency: low-level layout/control would require more chart infrastructure; existing SVG already covers the network. |
| Cytoscape.js | Not selected: graph replacement would discard working selection, validation and keyboard behavior without a demonstrated need. |
| React Flow | Not selected: editable node workflows are not required for the current supply/demand explorer. |
| Motion / Framer Motion | Retain the existing `motion` dependency for deliberate interaction transitions; no parallel animation stack. |

These are project scope decisions, not comparative performance benchmark claims. Library APIs should be checked against current primary documentation during implementation.

## Visual direction

The central visual is the measured relationship between allocation quality and computational cost. Use a restrained scientific workspace: large comparative plot, aligned filter rail, compact numeric summaries and inspectable observations. Avoid making each metric a competing hero card.

Proposed dark palette roles: charcoal `#111820` canvas, cyan `#22d3ee` quantum, blue `#3b82f6` classical, coral `#fb7185` shortage, green `#34d399` valid allocation, amber `#fbbf24` constraints. Light theme uses pale neutral surfaces and darker semantic variants with tested contrast. Reuse the application's sans-serif family for interface text and tabular numerals for values; monospace is reserved for bitstrings, source locators and configuration. Labels stay left aligned and units sit beside axis titles. Motion explains selection or changed flow; reduced-motion preferences suppress nonessential transitions.

## Implementation boundaries

1. **Evidence foundation:** generate `frontend/public/observatory-evidence.json` using `experiments/build_observatory_evidence.py`. Preserve the 1,410 primary-source raw observations, family/scenario/seed identity, source hashes and locators. The default family is `primary`; do not silently pool ablations. Centralize statistics and pairing in a pure adapter.
2. **Solver observatory:** evolve `ComparativeEvidenceExplorer.jsx` into the benchmark workspace. Combine quality/runtime, paired differences, gap distributions, feasibility, heatmaps, sampling and scaling with common filters, source inspection and accessible table equivalents.
3. **Network and resource flows:** enhance `Network.jsx` and its current validator instead of replacing SVG. Compute fulfillment and remaining inventory from actual validated shipments. Share a conservation-preserving allocation-flow representation between the emergency and flagship views.
4. **Clinical policy comparison:** retain `backend/flagship.py` policy engine. Run weighted and service-first policies against identical inputs; expose hospital fulfillment, shortages, stock remaining and transport costs. Use backend shortage explanations; avoid causal claims not justified by returned decision data.
5. **Quantum inspector:** distinguish QAOA p, compiled depth, basis decomposition, sampled counts, exact statevector probabilities and physical execution. Show a recorded circuit only when operations exist; metadata alone cannot reconstruct a circuit. Separate supplementary resource fixtures from the selected live/saved run.
6. **Foundation skills:** repository-specific scientific visualization, research integrity and browser QA skills live in `.agents/skills/`. Preserve other project instructions and contributor attribution.

## Research guardrails

The historical warm-start comparison comes from penalty 248 and the two tuned-more-compute variants in `audit/warm_qaoa_verified_results.json`: three paired seeds, 512 shots per run, p=2 and three restarts. Its approximate 0.78%/54.43% optimal-shot rates describe sampling density on one synthetic case whose LP seed was already optimal. They do not establish computational quantum advantage.

Keep infeasible, skipped and failed outcomes visible. Report per-scenario distributions, matching rules and sample sizes. Separate returned-solution feasibility, operational feasible-shot rate and strict encoded-equality probability. Unmeasured depth/memory/physical execution stays unavailable; analytical memory estimates are labelled estimates. Total-unimodularity conclusions are scoped to the stated bipartite allocation formulation.

## Baseline and release verification

Before implementation, integration `cfe11b1` passed 226 Python tests plus 21 subtests in 5.28 seconds, 54 frontend tests, and the Vite production build. Two SciPy COBYLA MAXFUN warnings were emitted. Baseline logs are in `/tmp/bloodflow-qa-baseline/`. Python used the existing `Documents/BloodFlow-Q1/.venv/bin/python` environment. Build verification used `VITE_API_BASE_URL=https://api.example.invalid`, a build-only placeholder requiring replacement for any production usage.

Final verification must rerun affected adapters, full project tests and production build, then exercise all eight requested routes in desktop/mobile and both themes. Capture real screenshots under `output/playwright/`, inspect console/API errors, use keyboard controls, test filters and match visible values to artifacts. Database privacy checks currently include SQL source guardrails; live PostgreSQL/RLS validation is a separate unexecuted boundary. No push, merge or deployment is part of this task.
