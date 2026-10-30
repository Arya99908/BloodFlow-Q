# Juror 4 initial independent vote — Social impact, ethics, responsible use

**Overall: 70/100. Personal verdict:** A useful and unusually explicit synthetic logistics research demonstration, with sensible donor-consent boundaries. I would support it as a research/education prototype, not yet as a deployable public-health coordination service. Impact on patients and quantum advantage remain unestablished. Score confidence: **moderate (0.70)**; high confidence in the cited local implementation, low confidence in deployed policy enforcement or actual user outcomes.

Reviewed repository `/Users/shreeshaks/Documents/BloodFlow-Q-main 3`, verified HEAD **46693f6**. No jury report contents were read. File discovery revealed report filenames only. Existing safety-document statements surfaced during keyword discovery; I do not treat their claimed validation or prior audit findings as evidence. Findings below rely on independently inspected implementation and fresh execution.

## Scorecard

| Category | Points |
|---|---:|
| Problem | 6/7 |
| User | 6/8 |
| Domain | 5/8 |
| UX | 5/6 |
| Architecture | 5/6 |
| Tests | 7/9 |
| Data | 6/8 |
| Classical | 8/10 |
| Quantum correctness | 7/10 |
| Quantum contribution | 3/8 |
| Experiments | 5/7 |
| Performance | 2/4 |
| Security | 3/4 |
| Adoption | 1/3 |
| Pitch | 1/2 |
| **Total** | **70/100** |

The lower-confidence quantum/experiment/performance points are provisional breadth judgments, not independently reproduced research results. The strongest basis of this vote is consent, authorization design, objective semantics, and impact framing.

## Three strengths

1. **Concrete separation of donor willingness, medical eligibility, and available inventory.** `backend/donor_matching.py:73-78,92-99,125-134` filters availability/consent and prior declined/contacted requests, returns limited suggestion records, and explicitly requires authorized confirmation. `frontend/src/pages/EmergencyRequests.jsx:327,346,361,365` explains label matching, absence of SMS/email, and centre confirmation after collection/testing. These are useful operational distinctions rather than a disclaimer alone. The synthetic interface says acceptance is not eligibility or donation (`:68`).
2. **Consent and institutional access have substantive implementation.** `supabase/migrations/202610130001_donor_emergency_network.sql:274-291` requires accepted notification plus current contact-sharing consent and an authorized related institution before contact viewing; `:294-320` records consent changes and withdraws pending notifications on opt-out; `:451-489` checks verified hospital roles and sends one in-app request through the sequential workflow; `:841-865` enables RLS and gates donor-profile reads. Frontend consent defaults are false (`frontend/src/pages/DonorNetwork.jsx:14-15`). These are source-supported safeguards, not a claim that the hosted database was tested by me.
3. **Trade-offs are inspectable, and the main landing page sets the research boundary.** `optimization/objective.py:32-56,218-254` names explicit weights and separates weighted urgent unmet demand, overall unmet demand, transport cost/time, and secondary terms. This makes policy choices discussable. `frontend/src/pages/Home.jsx:35,42,51` identifies synthetic research and disclaims clinical decisions. `quantum/qaoa_solver.py:389-445` actually builds and samples local simulated circuits; research interest need not depend on implying deployed quantum hardware.

## Three weaknesses, with proportionate safeguards

1. **The objective expresses priorities but does not demonstrate fair allocation.** High and critical categories enter the same weighted urgent term (`optimization/objective.py:227-230`), and all modeled costs trade in one weighted sum (`:236-254`). No minimum service guarantee or distributional equity criterion is present in this inspected objective. Donor ordering favors matching area and profile age (`supabase/migrations/202610130001_donor_emergency_network.sql:470-474`); repeat exclusion is per request, not an overall donor-contact burden control. This is reasonable for a toy model but could disadvantage remote demand or repeatedly burden a small candidate pool if operationalized. **Safeguard:** add synthetic stress cases reporting unmet demand by facility/region/urgency under weight perturbations, explain that urgency weights are policy assumptions, and test opt-in cooldown/rotation before any real outreach. Do not silently assert clinical fairness from feasibility.
2. **Privacy is thoughtfully gated but retention and accountability are incomplete.** Contact permission checks accepted notifications and consent, but `may_view_donor_contact` has no request-closure or time-expiry predicate (`supabase/migrations/202610130001_donor_emergency_network.sql:274-291`). Thus, on this source reading, a historic accepted relationship can continue granting contact access while consent stays true. The optimizer keeps only 100 in-memory results (`backend/services.py:398-411`) and exposes the list via `/results` without a route-level identity check (`backend/routes/results.py:11-13`, `backend/services.py:528-529`). That is acceptable only for intentionally public synthetic submissions, not a durable individual decision audit. **Safeguard:** clearly label shared synthetic result history, require request-scoped/time-bounded contact access for a live pilot, and define retention plus accountable override records before connecting any real data. I did not attempt access to private records.
3. **Social-benefit rhetoric exceeds demonstrated outcomes.** `README.md:13-17` invokes fatal shortages, survival, golden-hour limits, and clinical triage; the product actually demonstrates aggregate synthetic objective reduction. Main-page restraint is stronger than this pitch. Local QAOA simulation (`quantum/qaoa_solver.py:436-445`) does not establish patient benefit or quantum advantage. I did not find outcome/user-validation evidence within the bounded implementation review and did not independently reproduce benchmark claims. **Safeguard:** pitch measurable research outputs—feasibility, unmet synthetic demand, runtime, reproducibility—and keep patient-outcome claims explicitly prospective. User evaluation with authorized logistics professionals can test comprehension and workflow value without clinical deployment.

## Execution and limits

Executed `git rev-parse --short HEAD` and read-only source inspection. Executed **`python3 -B -m unittest tests.test_donor_matching tests.test_objective tests.test_donor_network_migration -q`: 23 tests passed**. The migration suite checks source structure; this is not execution against PostgreSQL or proof of deployed RLS. An initial pytest attempt failed because the selected Python lacks pytest, then the native unittest runner succeeded. No files besides this report were deliberately written; `-B` suppressed Python bytecode writes.

No live API mutations, database calls, real outreach, auth changes, clinical advice, or external factual assertions were needed. I did not execute the frontend, quantum benchmarks, concurrency tests, hosted auth flows, or a real pilot. No external research was used to infer medical validity. Potential concurrent-call donor-notification behavior remains untested; the one-at-a-time conclusion above describes ordinary sequential code flow only.

## Tough question

When transport cost competes with urgent unmet demand, who is authorized to choose the weights, what evidence shows remote hospitals are not persistently disadvantaged, and how would a reviewer reconstruct and challenge one allocation after the process restarts?

**Vote:** credible synthetic research demonstration; advance with explicit research framing and equity/retention work as the next milestones. Do not award clinical-impact or quantum-advantage credit on the present evidence.
