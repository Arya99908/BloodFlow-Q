# Juror 05 — Product, adoption, and pitch — independent initial vote

Commit inspected: `46693f6`, user-selected `evenmore-fix-and-heartbeat-additon`. Overall: **65/100**. Verdict: credible research demonstrator; not yet a validated operational product. Confidence: high on product positioning and scope, medium on architecture, low-to-medium on mathematical/security correctness because this was a bounded review rather than exhaustive verification.

| Dimension | Score / maximum |
|---|---:|
| Problem | 6 / 7 |
| User | 5 / 8 |
| Domain | 5 / 8 |
| UX | 4 / 6 |
| Architecture | 5 / 6 |
| Tests | 6 / 9 |
| Data | 5 / 8 |
| Classical | 8 / 10 |
| Quantum correctness | 7 / 10 |
| Quantum contribution | 3 / 8 |
| Experiments | 4 / 7 |
| Performance | 2 / 4 |
| Security | 3 / 4 |
| Adoption | 1 / 3 |
| Pitch | 1 / 2 |

## Evidence boundary

Read actual frontend home/navigation/demo implementation, backend demo builder/routes/models/configuration, donor service calls, classical and quantum solver excerpts, tests, synthetic compatibility data, documentation, and raw `experiments/results/20261007-01.json` configuration. No other jury reports or prior audit conclusions were read. Live GET `/health` returned `status: ok`, `synthetic_data_only: true`, `qaoa_available: true`; GET `/demo-scenarios` returned the three expected synthetic cases. These prove endpoint availability, not solver execution, browser usability, or private-workflow readiness. No browser rendering, outreach, database mutation, or real institution validation occurred. Attempted targeted pytest using documented `.venv/bin/python` could not start because that path is absent; test credit is source-inspection credit, not a fresh passing result.

## Three strengths

1. **The strongest target user is explicit in the shipped interface: a researcher or student comparing allocation methods.** `frontend/src/pages/Home.jsx` greets “Researcher,” labels the workspace synthetic, and presents supply → demand → network → optimize → validate. This is a coherent learning/research value proposition with inspectable inputs and outcomes. Confidence: high.
2. **A demonstrable end-to-end workflow exists beyond a pitch deck.** `backend/demo_scenarios.py:24` constructs fixed normal, demand-spike, and blocked-route cases; `frontend/src/pages/DemoMode.jsx` calls the API and separates live runs from stored results. The UI retains completed method responses for comparisons. `optimization/milp.py` calls a real solver and checks success/feasibility; `quantum/qaoa_solver.py` uses Aer, statevector expectations, and a configured 16-qubit ceiling. Confidence: high on implementation presence, medium on results not rerun here.
3. **The coordination extension makes useful distinctions instead of counting a willing donor as stock.** `frontend/src/services/donorNetwork.js` contains actual Supabase profile/RPC integrations. `tests/test_emergency_coordination_demo.py` checks shortfall remains three after a four-unit request with one stock unit and requires simulated testing/release before coverage, then receipt before completion. `docs/DONOR_NETWORK.md` distinguishes consent, appointment, release, and transport roles. Confidence: high on source, limited on deployed enforcement.

## Three weaknesses

1. **The headline emergency-network story exceeds the strongest demo evidence.** README describes distributed hospital trade-offs, ABO/Rh, perishable blood, and golden-hour limits. The controlled quantum demo is one bank, one hospital, one blood group, and one route (`backend/demo_scenarios.py`); `data/compatibility.json` explicitly models simplified ABO only. Raw initial experiment configuration also contains one-bank/one-hospital/one-group cases. This does not establish competing-facility emergency benefit, Rh modeling, shelf-life optimization, or a deployment-ready clinical model. Confidence: high. The README also says QAOA matched Exact on four cases and later three, weakening numerical storytelling.
2. **Operational adoption has no demonstrated bridge to the intended institutions.** The documented private path uses an empty test project, lacks configured/tested auth delivery, and has no external inventory feed, live GPS, outreach channel, or real dispatch integration (`docs/DONOR_NETWORK.md`). Registration and state transitions are useful implementation work, but neither customers nor successful field deployments follow from that. Institutional verification, integration ownership, and a measured existing workflow baseline remain unspecified in inspected evidence. Confidence: high on documented gaps; no assertion that uninspected outreach evidence cannot exist.
3. **Two product stories compete for attention while quantum differentiation remains unproven.** `frontend/src/navigation.js` exposes 16 destinations across research, operations, and donor coordination; demo source asks users to run seven variants separately, with substantial optimizer controls. This suits technical exploration more than a focused emergency coordinator journey. README candidly reports no quantum advantage; the raw initial run is tiny and simulated. The defensible differentiator is transparent comparative experimentation, not faster emergency response or superior quantum allocations. Confidence: high on scope, medium on experiential friction because no browser walkthrough was performed.

## Tough question

Who is the first repeat user—an optimization researcher or a hospital logistics coordinator—and what single decision can they make better after using this than after running the MILP baseline alone? Show that difference on a held-out multi-facility scenario with measured burden, feasible allocations, and repeatable comparisons, before claiming emergency impact.

## Personal verdict and pitch recommendation

I would advance this as an educational/research prototype with a technically substantial comparative pipeline. I would not score it as demonstrated hospital adoption or quantum advantage. Keep the donor-coordination demo as a clearly separate extension, and lead the presentation with a short input → disruption → validated allocation → classical/quantum comparison sequence. Replace unconditional “<15 ms” and clinical-sounding network claims with measured, scoped statements.

**Truthful pitch:** “BloodFlow-Q is a synthetic blood-logistics research workspace for exploring how allocation plans change when demand or routes change. It compares classical solvers with simulated QAOA, exposes feasibility and unmet demand, and helps researchers inspect where quantum approaches work or fail. It does not yet demonstrate quantum advantage or clinical deployment.”
