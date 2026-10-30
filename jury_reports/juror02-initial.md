# Juror 2 — Consumer / end-user advocate — initial independent vote

Commit verified: `46693f6`. Overall: **60/100**. Confidence: **moderate for workflow/content; low-to-moderate for engineering and quantum categories**. This is a bounded initial review, not a certification. No other jury reports or prior audit conclusions were consulted.

## Scores

| Criterion | Score / maximum |
|---|---:|
| Problem | 5/7 |
| User | 5/8 |
| Domain | 5/8 |
| UX | 4/6 |
| Architecture | 4/6 |
| Tests | 6/9 |
| Data | 5/8 |
| Classical | 7/10 |
| Quantum correctness | 6/10 |
| Quantum contribution | 3/8 |
| Experiments | 4/7 |
| Performance | 2/4 |
| Security | 2/4 |
| Adoption | 1/3 |
| Pitch | 1/2 |
| **Total** | **60/100** |

The technical-category votes reflect inspected source, test intent, and published measurement claims, not a fresh complete test run or independent mathematical proof. Limited inspection reduces confidence rather than asserting those systems fail.

## Plausible user task and observed scope

A hospital or bank coordinator evaluating a synthetic planning tool should be able to identify stock and unmet demand, choose a sensible allocator without quantum knowledge, understand a proposed shipment, and explain the remaining shortage to a colleague. The home source presents Supply → Demand → Network → Optimize → Validate (`frontend/src/pages/Home.jsx:17-22`), a comprehensible planning sequence. The main operation remains a research experiment against an active scenario; hospital data is a display catalog rather than a demand-entry workflow (`Hospitals.jsx:8-19,94-119`). The separate emergency workflow adds component-specific request fields and a deterministic four-unit demonstration (`EmergencyRequests.jsx:15-19,60-74`). These are distinct concepts that a new coordinator needs help connecting.

Live evidence: native Chrome at `127.0.0.1:5180/coordination` displayed the synthetic request DEMO-BFQ-4UNIT-001 at Donor Accepted, four units, an appointment action, collection/testing/release/transport checkpoints, and a simulated history. A screenshot confirmed clear visual hierarchy and repeated synthetic status labels. `GET http://127.0.0.1:8000/scenario` returned synthetic_default with banks, hospitals, O/A/B/AB stock and urgency data. No real outreach or private records were used.

Browser limitation: keyboard navigation had no observable effect. Clicking Home changed the URL/title but the captured native page remained on coordination; subsequent AX and screenshot agreed. Given known native tool limitations and the bounded session, this is **unresolved tooling/navigation evidence, not an attributed application defect**. I did not claim to complete a fresh optimization through the UI.

## Exactly three strengths

1. **Honest, visible boundaries create trust.** Live coordination explicitly says authorization/integrations are not configured, every checkpoint is simulated, and no GPS, dispatch, test result, release or shipment exists. Source corroboration: `Coordination.jsx:26-35`. This enables safe evaluation without pretending the demonstration is clinical service.
2. **Outputs contain the information needed to discuss a planning decision.** Shipment rows name bank, hospital, product group, recipient group and units; shortages are broken down by hospital/group (`Optimization.jsx:486-523`). This is more useful to a coordinator than a scalar optimization score alone.
3. **Evidence and failure states are explained rather than hidden.** Solver Lab separates measured/unavailable records, preserves configuration, reports units for minutes/runtime, and explains session-only storage (`Results.jsx:110-141,148-177`). The selected tests include ordered completion requiring receipt (`tests/test_emergency_coordination_demo.py:28`) and MILP checks against exact, greedy and disrupted routes (`tests/test_milp_solver.py:63,77,94`). Test presence is verified; passing status was not independently rerun.

## Exactly three weaknesses / main adoption obstacles and fixes

1. **A coordinator cannot readily substitute their own hypothetical planning case in the main workflow.** Hospitals is a read-only scenario catalog, and Optimization runs the active scenario (`Hospitals.jsx:8-19,94-119`; `Optimization.jsx:129-140`). The separate emergency demonstration has fixed synthetic stock and demand (`EmergencyRequests.jsx:60-65`). Fix: add a guided synthetic scenario editor/import with explicit inventory, demand, component, timing and validation preview; carry a single scenario identity through the whole walkthrough. This is a prototype usability improvement, not a demand for clinical deployment.
2. **Research settings and results leave too much translation work to the user.** QAOA demands explicit penalty weights above a theoretical bound (`Optimization.jsx:83-87,152-181`); results put bitstrings and QAOA diagnostics ahead of shipment rows even for classical runs (`Optimization.jsx:448-486`). Transport cost has no displayed currency or declared model-cost unit (`Optimization.jsx:442-445`; `Results.jsx:165,185`). Hospital demand bars are headed “ALLOCATION METER” even though they scale requested demand (`Hospitals.jsx:94-110`). Fix: default to a plainly explained classical planning preset, tuck research controls behind an advanced section, show shipments/shortages first, label cost as synthetic model cost with its definition, and rename the bar Demand.
3. **The handoff from modeled allocation to useful next action is incomplete.** Main shipment rows have no route-specific explanation of why this source/quantity was chosen (`Optimization.jsx:486-523`), saved history resets with the backend (`Results.jsx:139-141`), and the coordination view explicitly has no actual shipment or authorization integration (`Coordination.jsx:26-35`). Fix: provide a downloadable synthetic plan with scenario/configuration, constraints, shortage reasons and proposed coordinator checklist; clearly link or distinguish allocation planning from the donor demo. Persistent reviewable simulation artifacts would already improve adoption without adding live operations.

## Scientific and product judgment

The documented simulator scope and explicit no-advantage statement are credible restraint (`README.md:92-96`). However, the adjacent README claims conflict: line 92 says matched Exact on four scenarios while line 94 says three, with one slightly worse. That weakens the clarity of the headline evidence and should be reconciled against the saved results. I did not resolve it by importing another audit conclusion. The full scenario warning of greater than 16 qubits and the compact-demo alternative are candid (`Optimization.jsx:154-159,204`), but quantum contribution is not yet a coordinator-facing reason to adopt this tool.

Tough question: **Can a non-quantum coordinator enter one new synthetic shortage, obtain a plan, and explain why each unmet unit remains—using only the interface and an export, without a developer interpreting the solver?**

Personal verdict: **Promising and unusually explicit research demonstrator; conditional support for a supervised synthetic planning evaluation, not yet a self-service coordinator product.** Its strongest user benefit is making allocation and shortages inspectable. The next investment should make that benefit easier to exercise and explain before adding more solver controls.
