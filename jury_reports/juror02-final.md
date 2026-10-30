# Juror 02 — Consumer / end-user advocate — independent final vote

**61/100, revised upward by one point for User.** Verdict: support a supervised synthetic planning evaluation; not yet a self-service coordinator product. Confidence moderate for user-facing workflow and interpretation, lower for technical categories outside my direct tests. Initial ballot is preserved. No consensus target was used.

| Criterion | Score / maximum |
|---|---:|
| Problem | 5/7 |
| User | 6/8 |
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
| **Total** | **61/100** |

Category array in shared order: `[5,6,5,4,4,6,5,7,6,3,4,2,2,1,1]`.

## Cross-examination challenge and resolution

Read the released docket, J7 initial, and J3 final. **I challenge the possible inference from J7’s successful sixteen-route rendering and demonstrated donor acceptance flow to end-user readiness.** Rendering establishes reachable content, and the demonstrated acceptance transition establishes a functioning synthetic interaction. Neither establishes that a nontechnical coordinator can configure a new hypothetical shortage, interpret the allocation policy, and produce a reviewable plan without developer help. J7 itself acknowledges absent field-user validation and limited action coverage; its own route table marks many routes PARTIAL. Resolution: I accept J7’s positive live observations as J7’s evidence and withdraw no corresponding defect, since my initial report expressly classified my native navigation trouble as unresolved tooling/navigation. I retain the self-service and explanation objections. There is no factual contradiction between a functioning route and a user struggling to complete an unfamiliar planning task.

**I tested the interpretation of J3’s critical-shortage example against source.** `optimization/milp.py:129-164` encodes demand as shipment plus unmet quantity, with inventory bounds. `optimization/objective.py:219-251` prices critical and total unmet quantities alongside transport cost/time. This supports J3’s explanation that critical shortage can be mathematically optimal under the chosen weights; it is not evidence of a defective optimizer. J3’s numerical execution remains J3’s reproduction, not mine. J7’s live Greedy 2 unmet versus MILP 27 unmet is likewise attributed to J7.

The user issue is especially concrete: `frontend/src/pages/Optimization.jsx:538-578` presents Objective, Critical unmet, Total unmet, Transport cost and Feasible, but the table does not explain the marginal shortage-versus-transport tradeoff. The broader result view places diagnostics before shipments (`448-486`). A reader can see a larger shortage and a better objective without learning why that is the policy-selected outcome. “Feasible” means the encoded constraints are satisfied; it does not promise all critical requests are served. The visible synthetic disclaimer is appropriate but does not teach this distinction.

## Revision rationale

J7 increases confidence that the research workflow genuinely runs, which supports my existing positive marks for inspectable outputs and honest evidence states. J3 strengthens the need for policy interpretation, already included in my research-to-user translation weakness. These alone do not change the central verdict. The docket’s broader test and research findings are useful corroboration but were not independently executed by me; I have not increased scope-distant scores merely to match other jurors.

The three adoption priorities remain: guided whole-network synthetic scenario creation; plain-language objective policy and explicit units with shipments first; and a durable exported plan explaining shortages and next review steps. As a concrete improvement to the second, show a policy card beside each result: weights, modeled cost units, what “critical” guarantees, and which expensive shipments were traded for shortage. This can be done without claiming clinical validity or enabling live operations.

## Remaining uncertainty

No new browser or solver run was performed during cross-examination. Source reads were limited to objective construction, MILP constraint rows, and result comparison UI. My initial live coordination observation remains valid; its interrupted navigation remains unassigned as an application defect. End-user comprehension, completion time, input-error recovery, export usefulness, and accessibility need observed task testing with intended research users. Hosted authorization enforcement and practical operational benefit remain outside my verification.

Tough question remains: can a non-quantum coordinator enter one new synthetic shortage, obtain a plan, and explain why each unmet unit remains using only the interface and an export? The reviewed evidence demonstrates substantial parts of a research prototype, but not that whole user task.

## Late cross-examination correction accepted

J7 challenged my broad scenario-entry criticism. Fresh source reading confirms `/emergency` offers demand change, inventory reduction, route disruption and priority change, builds those events in `EmergencySimulation.jsx:60-70`, and provides new-demand/urgency controls at `131-142`. Also, `Optimization.jsx:21` defaults to Greedy; QAOA penalties are not required for the basic classical path. I therefore correct any implication that users cannot enter a new hypothetical shortage or must understand QAOA to run a plan. The narrower missing capability is whole-network creation/editing in the main scenario catalog, alongside durable explanatory export. My User score rises from 5 to 6, bringing the final total to **61**. Remaining categories and verdict are unchanged. The toughest question should now emphasize independently understanding and exporting the resulting shortage policy, rather than implying the emergency input controls are absent.

J6 challenged scope: a read-only catalog is not inherently defective in a fixed-case research workspace. I agree. The scenario-editor recommendation concerns broader self-service research evaluation and coordinator adoption, not a failure to meet a claimed clinical operating requirement. The cost-unit and objective-interpretation issues apply within the existing research scope.

Terminology clarification: synthetic coordination is account-free. Live staff authorization is unconfigured, not verified; no authentication success is claimed.
