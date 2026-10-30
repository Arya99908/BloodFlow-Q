# Juror 03 — independent final vote

**Final score: 69/100, unchanged from the arithmetic-corrected sealed vote.** Personal verdict: credible educational and comparative optimization prototype; insufficient evidence for operational deployment or quantum advantage. Confidence medium-high on core domain behavior, medium overall. Original report and separate arithmetic correction remain preserved.

| Category | Points / maximum |
|---|---:|
| Problem | 6/7 |
| User | 5/8 |
| Domain | 5/8 |
| UX | 4/6 |
| Architecture | 5/6 |
| Tests | 7/9 |
| Data | 5/8 |
| Classical | 9/10 |
| Quantum correctness | 7/10 |
| Quantum contribution | 4/8 |
| Experiments | 4/7 |
| Performance | 3/4 |
| Security | 3/4 |
| Adoption | 1/3 |
| Pitch | 1/2 |

Category array in shared order: `[6,5,5,4,5,7,5,9,7,4,4,3,3,1,1]`; sum **69**.

## Actual challenge, resolution, and limits

After initial ballots were released, read the cross-examination docket, J12 final and J5 initial.

**Challenge to J5's product evidence interpretation:** Does a one-bank controlled quantum demonstration establish that the product cannot represent competing facilities? Fresh source inspection confirms `backend/demo_scenarios.py:29-30` deliberately restricts the controlled demo for the simulator limit; its demand-spike and route-block variants reuse this compact case. However, `data/blood_banks.json` contains bank_a/b/c and `data/hospitals.json` contains multiple hospitals with O/A/B/AB demand. The Scenario and shared inventory rows can represent competing facilities. Resolution: J5's carefully scoped statement about the strongest controlled demo is supported, but any broader reading that the application is exclusively single-facility is rejected. My initial weakness similarly applies to the cited five-case evidence, not all repository scenarios or all later research. The correct criticism is missing demonstrated operational benefit, not absence of a network-capable data model.

**Challenge to J12's current flow-integrality conclusion:** Could realistic omitted constraints invalidate the claim that the current model has an integral LP optimum? Current source `optimization/milp.py:129-164` supplies demand equalities and bank/group inventory inequalities; permitted shipment arcs each connect one supply row to one demand row. With sign-flipped supply rows this is a network incidence structure, including unit unmet columns and integer bounds. The current model therefore admits an integral optimum in its LP relaxation. This supports J12 and strengthens the case for an LP/min-cost-flow baseline. It does not assert every LP optimum is integral. Expiry, routing, fixed dispatch charges or other domain extensions must each be analyzed separately; realistic-sounding omissions do not make the existing matrix computationally hard. Conversely, difficulty of a hypothetical fixed-charge extension must not be attributed to the current production model. No new LP execution was performed by me; J12's 100-case tests remain J12's evidence.

J12 independently reproduced my critical-demand case and correctly challenged whether it is a solver defect. It is not: leaving one unit unmet costs 15 while shipment costs 112 under the stated weights. My initial report explicitly said both outputs are mathematically correct. The issue remains operational policy and interpretation: feasibility certifies the encoded constraints, and critical is a weighted shortage label rather than a guaranteed service rule.

## Why the vote remains unchanged

These challenges sharpen scope and attribution without overturning the three main findings: sound conservation/validation; synthetic safeguards; and a gap between advertised emergency constraints and actual weighted, single-period allocation. I retain high classical credit and limited adoption/quantum-contribution credit. The released larger-research evidence is relevant and means the five-case example is not the complete experimental program; I have not independently audited enough of that program to revise its category score. No consensus adjustment was made.

## Execution and remaining uncertainty

Original fresh execution remains 23/23 focused tests passing, plus the separately constructed critical one-unit MILP/greedy case. During cross-examination I performed source reads only, including the compact demo builder, bundled bank/hospital data, and necessity-model solver references; no new solver, UI or database run. No application files changed.

Remaining uncertainties include operator approval of weights, interpretation of “feasible” and critical service in the UI, end-to-end institution integration, held-out multi-facility benefits, and quantum incremental value after full classical costs. The toughest question remains who authorizes the shortage-versus-transport trade-off and how that policy is made visible to a user. I would advance this as a research demonstration with a corrected, scoped pitch, not as an emergency dispatch system ready for real operations.
