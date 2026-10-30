# Juror 4 final vote — Social impact, ethics, responsible use

**Final score: 69/100 (initial 70). Security revised from 3/4 to 2/4; other categories unchanged.** Confidence: moderate, 0.72. Personal verdict: credible synthetic logistics research and education prototype, deserving credit for explicit consent and human-confirmation boundaries. It has not demonstrated clinical benefit, deployment readiness, or quantum advantage. Advance as research with privacy lifecycle and distributional evaluation as concrete next milestones.

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
| Security | 2/4 |
| Adoption | 1/3 |
| Pitch | 1/2 |
| **Total** | **69/100** |

## Cross-examination challenge and resolution

The chair relayed Juror 16's challenge: my initial security 3/4 may be generous because contact permission has no closure/expiry and RLS grants access to donor rows, with hosted enforcement untested. I independently reopened the relevant source; I did not read another juror's report.

**Verified and sharpened finding:** In `supabase/migrations/202610130001_donor_emergency_network.sql:274-291`, `may_view_donor_contact` requires an accepted notification, current sharing consent, and institutional relationship; it does not test whether the request is closed or access has expired. The cancellation handler (`:616-627`) withdraws only `contacted` notifications, leaving previously accepted notifications unchanged, and completion does not withdraw them. The SELECT policy at `:863-865` grants donor-profile row visibility using this function. The table-level SELECT grant at `:956-959` is not column-limited, and the row contains name, phone, email, blood group, area, and availability (`:46-59`). Therefore this is broader than visibility of a minimal contact card and can survive completion/cancellation while consent and institutional role persist. This is a source-proven authorization-lifecycle gap, not a demonstrated data breach.

**Why revise:** Initial review already identified indefinite contact access; cross-examination confirmed closure handling does not neutralize it and established full-profile visibility. That concrete additional scope warrants the one-point reduction. I do **not** deduct merely because another reviewer could not run hosted auth. Untested deployment is uncertainty, not proof that RLS fails. Nor do I demand clinical-grade infrastructure from a synthetic demonstration. However, the implemented optional private donor pathway explicitly collects personal fields, so a privacy-lifecycle gap belongs in its security evaluation even while the demo itself uses fictional data.

**Proportionate remedy:** retain the synthetic demo; before using real donor profiles, restrict the contact-sharing read surface to necessary fields and active request relationships with explicit expiry, and execute authenticated/unauthorized/closed-request/consent-revocation database tests. A durable access/override policy should accompany any real institutional pilot. No live data or permission changes were attempted.

## Retained findings

Three strengths: (1) donors are not counted as usable inventory, and authorized centre confirmation is explicit (`frontend/src/pages/EmergencyRequests.jsx:327,346,365`); (2) opt-in defaults, consent history, opt-out withdrawal, and verified-institution checks are implemented (`frontend/src/pages/DonorNetwork.jsx:14-15`; migration `:294-320,451-489`); (3) objective terms are decomposed and the landing page plainly labels synthetic research (`optimization/objective.py:218-254`; `frontend/src/pages/Home.jsx:35,42,51`).

Three weaknesses: (1) weighted urgency and transport trade-offs are inspectable but not evidence of equitable service; test facility/region/urgency outcomes and donor-contact burden under synthetic stress (`optimization/objective.py:227-254`; migration `:470-474`); (2) donor access lifecycle is incomplete and optimization history is shared, process-local, and bounded to 100 results rather than a durable decision audit (`backend/services.py:398-411,528-529`; `backend/routes/results.py:11-13`); (3) README survival/clinical-triage rhetoric (`README.md:13-17`) exceeds synthetic optimization evidence, while local simulated QAOA does not establish advantage (`quantum/qaoa_solver.py:436-445`).

## Executed versus inspected; uncertainty

HEAD verified as `46693f6`. Initial fresh execution: `python3 -B -m unittest tests.test_donor_matching tests.test_objective tests.test_donor_network_migration -q` passed **23 tests**. Migration tests inspect source structure, not PostgreSQL enforcement. Initial pytest attempt failed because that interpreter lacked pytest. Cross-examination performed additional read-only source inspection only; no new runtime tests were required for the precise SQL predicate/grant observation. No application files changed; only this report was added in this round.

No hosted authorization, real outreach, frontend interaction, quantum experiments, concurrency stress, or clinical outcomes were executed or independently validated. Quantum/experiments/performance scores remain provisional, lower-confidence breadth assessments. No external medical or legal claim is made. There is no consensus target behind this revision.

**Tough question:** Who authorizes the urgency weights, how will persistent regional disadvantage be detected, and what expires a hospital's access to a donor's full profile after the associated request ends?
