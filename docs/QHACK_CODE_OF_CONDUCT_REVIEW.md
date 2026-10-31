# Q-Hack India 2026 conduct and submission review

**Conclusion: project safeguards are supported by the checks below, but the submission is not unconditionally cleared. A human-recorded demo and complete provenance/licensing disclosure remain required.**

Reviewed on 2026-10-31 against the supplied `Q-Hack_India_2026_Code_of_Conduct.html` (document states last updated 26 September 2026), the [official event page](https://www.quantumweek.tech/hackathon) and [official FAQ](https://www.quantumweek.tech/faq). Scope is the local BloodFlow-Q-main 3 checkout at revision `4d168ea` before these documentation additions, and the previously produced premium film. Private registration records, current round emails and all remote/deployed systems were not audited.

| Requirement | Finding | Status/action |
|---|---|---|
| §4 Round 1 continuity / permitted development | Representative confirms accepted Round 1 project continuing into Round 2/finale; Git contains work from 7 October onward. | Supported by user statement. Retain the accepted submission revision, selection email and permitted-sprint history. Disclose outside material. |
| §4 Registered contributors / organiser conflicts | Representative confirms all contributors registered on the same team, no organiser/judge connection. Existing credits map three people across aliases. | User-attested; confirm broader affiliated-planning exclusion and any roster changes against official records. |
| §4 AI disclosure and honest contribution | Human credits exist; no consolidated significant-AI disclosure was found. AI-produced promotional material is known from this session. | Added submission disclosure; historical code/content AI use still needs each member’s actual account. |
| Official FAQ: human demo and voiceover | Premium film has agent-operated real footage, agent editing and no human voiceover. | **Not a cleared standalone demo. Team must record and explain the project themselves.** |
| §4 Third-party materials and licences | Dependency manifests, references and visible Skiper Tooltip attribution exist. No complete rights inventory for every copied asset/literature item was established. | Added direct/transitive dependency inventories and attribution document. Confirm unrecorded component/logo origins and redistribution rights. |
| §§2–4 Honest scientific claims | README and film explicitly identify synthetic research, simulated QAOA and no demonstrated quantum advantage; results are tied to raw artifacts. | Supported in reviewed materials. Preserve qualifications in live pitch and slides. This review did not reproduce every experiment. |
| §5 Credential protection | No matches in tracked files or reachable historical blobs for the specific high-confidence credential patterns scanned; local env files ignored. | Limited static check passed; not a guarantee about untracked files, remote-only history, unknown secret formats or cloud settings. |
| §§3, 5, 8 Privacy / recording | Reviewed research data is labeled synthetic. Donor extension has consent and role gates; film shows synthetic UI without identifiable people. | Targeted tests passed. Use no real donor/patient data for judging; consent needed for identifiable people in new recordings. No live database security certification. |
| §5 Malicious or unauthorised functionality | Targeted source review found normal API/static-data access and no evident surveillance/exfiltration behavior in reviewed areas. | No intentional abuse identified; not an exhaustive malware/security audit. |
| §§2–3, 6–10 Personal conduct / venue / reporting | Respect, consent, official communication channels, no unfair sharing, venue rules and cooperation are team obligations. | Cannot be certified from code. Team must comply throughout the event. Report concerns through official channels; no organiser messages sent by this audit. |

## Changes made

- Added `QHACK_SUBMISSION_DISCLOSURE.md` covering confirmed AI use, team attestations, provenance gaps and a concrete human-demo recording outline.
- Added `THIRD_PARTY_ATTRIBUTIONS.md` plus machine-readable npm/Python inventories.
- Linked the records from README and qualified the scope of existing contributor credits.
- Saved credential-scan counts, reviewed revision/document hash and test results in `audit/code_of_conduct_20261031/`.
- No application behavior, source history, contributor credit, credentials or deployment was changed. Nothing was submitted or pushed.

## Validation evidence

- 881 tracked files and 1,293 reachable historical blobs scanned. Zero matches for the selected credential formats (private-key headers, GitHub/OpenAI-style/AWS/Slack/Supabase-secret tokens and credential-bearing database URLs). This was a custom heuristic scan, not a claim of comprehensive secret detection.
- `tests/test_donor_network_migration.py`, `tests/test_donor_matching.py`, `tests/test_reporting_telemetry.py`: **25 passed, 9 subtests passed**. Migration tests inspect policy/schema contracts; they do not independently validate a currently deployed database.
- Read the repository’s data/safety guidance, contributor attribution, current package manifests, adapted Tooltip and UI attribution, and selected donor/workflow code.
- The supplied film’s recorded technical verification reports 82 seconds, genuine synthetic application footage, no fabricated quantum advantage, and no voiceover. Technical video quality does not establish competition-demo compliance.

## Remaining actions before submission

1. Record the demonstration and real voiceover with registered team members. Use the premium film only as a disclosed visual aid if the applicable rules permit it.
2. Complete the historical AI-use declaration and exact copied-material/logo/literature rights record. Preserve required third-party notices with the submission.
3. Retain the accepted Round 1 snapshot, registration/selection records and current round instructions. Confirm any stricter instructions or exceptions through the official channel; do not assume this audit overrides them.

These are specific unresolved requirements, not a finding that the team plagiarised, lacks eligibility, or committed misconduct.
