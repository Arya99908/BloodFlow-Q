# Sealed independent initial vote — Juror 07 / 16

Role: frontend and live-demo examiner. Overall **66/100**. Verdict: credible, unusually candid synthetic research demonstrator; not a validated blood-service operating product, and quantum contribution remains unproved. Confidence: **moderate overall, high for observed desktop behavior**, low-to-moderate for solver internals/security not independently audited here.

Reviewed commit `46693f6519bdd385b67b3b69b2c4a450a058d67a`, branch supplied as `evenmore-fix-and-heartbeat-additon`, on 2026-10-25. Root `/Users/shreeshaks/Documents/BloodFlow-Q-main 3`. Live frontend `http://127.0.0.1:5180`, API `:8000`, isolated runtime supplied by coordinator. No other jury report or prior conclusions read. Source read only; only this report written. Native Chrome UI actions exclusively through cua_repl. HTTP GETs below verify API values, not rendering. No installs, paid requests, large simulations, or test-suite runs.

## Independent weighted score

| Category | Earned / weight | Basis / confidence |
|---|---:|---|
| Problem | 6 / 7 | Relevant allocation/disruption problem, synthetic operational framing; medium |
| User | 5 / 8 | Researcher workflows clear; field-user validation absent from examined evidence; medium |
| Domain | 5 / 8 | Explicit simplified ABO, no Rh in core scenario, no clinical claims; medium |
| UX | 4 / 6 | All routes render, functioning navigation and comparisons; layout and explanation debt; high |
| Architecture | 5 / 6 | Central route registry, separated API services/pages, backend results boundary; medium |
| Testing | 5 / 9 | 31 backend test files plus frontend metric/wiring suites inventoried; not executed; low-medium |
| Data | 5 / 8 | API-consistent synthetic inputs and provenance labels; external validity unestablished; medium |
| Classical | 8 / 10 | Live Greedy/MILP comparison, honest capped Exact status; no independent optimality proof here; medium |
| Quantum correctness | 7 / 10 | Honest simulator/mixer/feasibility distinctions and raw records; internals not derived here; medium |
| Quantum contribution | 2 / 8 | UI explicitly reports no advantage and classical optimum matches; high |
| Experiments | 6 / 7 | Paired studies, failures and historical separation visible; raw suite not reexecuted; medium |
| Performance | 3 / 4 | Fast local classical responses, resource guard visible; no stress test; medium |
| Security | 2 / 4 | Live identity/data paths disabled, synthetic isolation explicit; auth/RLS not exercised; low-medium |
| Adoption | 1 / 3 | Setup-dependent donor operations and no real integrations in this build; medium |
| Pitch | 2 / 2 | Coherent demonstrable prototype with explicit limitations; high |
| **Total** | **66 / 100** | Independent initial vote |

## Three strengths with exact observed evidence

1. **Real outputs rather than fabricated dashboard numbers.** At `/optimization`, default Greedy → RUN OPTIMIZATION produced objective **230.60**, unmet **2**, transport **157.70**, critical satisfaction **100%**, and 12 shipment rows. GET `/results` most recent `/optimize` record at `2026-10-25T04:09:37.931643+00:00` had `total_objective:230.6`, `total_unmet_demand:2`, `transport_cost:157.7`, satisfaction `11/11`, and the same shipments, including Bank A O→Hospital 1 A = 6. GET `/scenario` matched rendered stock 71, demand 38, three banks/three hospitals and eight available/one blocked route.
2. **Research transparency survives into the interface.** `/demo` → PRECOMPUTED EXPERIMENT explicitly says historical artifact, capture October 7, reproduction command, missing telemetry as Not recorded, and displays QAOA 82.6/2 unmet versus Greedy and Exact 25.2/0 unmet. `/reports` states quantum neighborhood tied MILP replacement in 60/60 pairs, LP already exact on eight held-out cases, and no quantum advantage. XY is correctly described as Hamming-weight preserving, not generally allocation-feasibility preserving.
3. **Meaningful synthetic coordination guards and navigation.** `/emergency-requests` → Start synthetic request showed 4 requested, 1 stock, 3 shortfall and Donor Contacted. Dock Coordination → Donor Network → Accept simulated request → dock Collection & transport showed **Donor Accepted**, same `DEMO-BFQ-4UNIT-001`, history, and next appointment control. It consistently says no real donors contacted and distinguishes donor acceptance from inventory, collection, testing and release.

## Three weaknesses with exact evidence

1. **Default objective outcome needs stronger operational interpretation.** `/optimization` → RUN COMPARISON (QAOA unchecked) returned Greedy objective 230.60/unmet 2 and MILP **202.70/unmet 27**, both feasible, zero critical unmet. Lower modeled cost legitimately buys much more unmet demand. This is not an API mismatch or proof the MILP is wrong; it is a serious user-explanation and objective-calibration issue for a blood allocation pitch. The tested page does not make the marginal tradeoff clear alongside the result.
2. **Presentation contains hard-coded/scaling inaccuracies.** Same comparison says “full **7-node** operational scenario” while its baseline and `/network` show **3 banks + 3 hospitals = 6 facilities**. `frontend/src/pages/Optimization.jsx:587` hard-codes 222 bits and 10^66 states; line 592 describes Exact as brute-force evaluation of 222 bits. This text conflates QUBO bit-space with the exact allocation reference's capped candidate search. On the observed 2400×1706 screenshot, comparison run control and right table edge extend beyond the viewport, and the explanatory blue panel text is low contrast. Browser zoom was not independently reset, so layout severity is provisional rather than a universal responsive claim.
3. **Operational and quantum value remain bounded demonstrations.** `/donor-network` explicitly reports Supabase unconfigured; `/emergency-requests` disables live entry; `/coordination` reports no configured staff authorization/team integrations. `/reports` admits no quantum advantage and classical optimality on tested held-out examples. These are candid limitations, but reduce adoption and incremental quantum-value marks. README also asserts MILP <15 ms while my comparison displayed **0.0262 s** (one local observation, not a performance study).

## Route inventory and reproduction

Status refers to tested scope, not blanket certification. Direct addresses entered in Chrome for initial page checks. All sixteen route bodies rendered; none assessed through HTTP alone.

| Route | Status | Actual observation / reproduction |
|---|---|---|
| `/` Home | PASS | Welcome researcher, synthetic labels, workflow buttons; Workspace dock opened and Blood banks selected successfully. |
| `/dashboard` | PASS | API connected; 71 stock, 38 demand, existing MILP 27 unmet, hospital allocation 4/4/3 and disabled private counts. Initial existing result only. |
| `/blood-banks` | PASS | Menu navigation rendered stocks 25/23/23 and explicit no inferred Rh labels. Card action controls not exercised. |
| `/hospitals` | PASS | Three hospitals, demands 13/14/11, high-priority 11, group/urgency records. |
| `/network` | PARTIAL | Six facility nodes, nine routes, blocked C→2, existing validated MILP overlay and accessible filters/zoom controls. Filtering/panning not exercised. |
| `/optimization` | PASS | Greedy run and default comparison completed; API parity checked. Exact shown Skipped (Too Large), QAOA Not Run, no fictitious numbers. Presentation caveats above. |
| `/emergency` | PARTIAL | Event wizard rendered demand change, hospital/group/demand controls and Next; no submit performed in this bounded review. |
| `/demo` | PARTIAL | Live mode controls available; switched to historical mode successfully and observed provenance/output. No new QAOA run performed. |
| `/donor-network` | PARTIAL | Synthetic inbox accepted request; live path unavailable. Profile CRUD/decline not tested. |
| `/emergency-requests` | PARTIAL | Started synthetic request and observed inventory-first shortfall/contact history. Live path blocked by configuration. |
| `/coordination` | PARTIAL | Accepted request carried over via SPA dock, appointment control available; remaining collection/testing/release/receipt not advanced. |
| `/results` | PARTIAL | Solver Lab and benchmark/history sections rendered; saved research subsection was still Loading at initial observation, not rechecked. No conclusion of a loading defect. |
| `/reports` | PASS | Historical/new study distinctions, counts, infeasible runs and no-advantage findings rendered. Scenario selectors not exercised. |
| `/quantum-lab` | PARTIAL | Saved QAOA inspector, scenario/seed selectors, bitstrings, validation and explicit missing values rendered. Export/selectors not tested. |
| `/flow` | PASS | Five-stage supply-to-response explanation and navigation controls rendered. |
| `/about` | PASS | QUBO/Ising/QAOA/decoder/validator explanation and scope disclaimers rendered. |

Additional observation: hard address-bar reload loses the synthetic coordination session; using the app dock correctly preserves it. This is consistent with its browser-page-only design and is not scored as a cross-route state defect. A native typing interruption once omitted the initial h in http and opened a search; corrected using paste and not attributed to app behavior. Mobile, authentication, screen-reader keyboard journey, export, error injection, load, and full regression suite remain NOT TESTED.

## Toughest question

Your live exact-classical optimizer leaves 27 of 38 units unmet while Greedy leaves 2, because the chosen objective prefers cost/time savings. Who validated those tradeoffs for the intended research user, and what independently held-out problem family makes the quantum component useful beyond a simulator demonstration when LP/MILP already reaches the optimum?

Final initial judgment: **66/100**, support as a transparent research/demo project, withhold claims of clinical readiness, proven operational benefit, or quantum advantage. This vote is sealed pending cross-examination.
