# Juror 6/16 — Independent initial vote

Scope: UI/UX and accessibility. Primary tree `BloodFlow-Q-main 3`, commit `46693f6`, branch supplied as `evenmore-fix-and-heartbeat-additon`. Reviewed 25 October 2026. No other jury reports or prior audit conclusions read. No app, source, configuration, tests, results, or data changed.

**Overall: 73/100. Verdict: credible research prototype with a strong presentation foundation; conditional advancement, not operational deployment readiness.**

| Criterion | Score/max |
|---|---:|
| Problem | 6/7 |
| User | 6/8 |
| Domain | 6/8 |
| UX | 4/6 |
| Architecture | 5/6 |
| Tests | 6/9 |
| Data | 6/8 |
| Classical | 8/10 |
| Quantum correctness | 8/10 |
| Quantum contribution | 4/8 |
| Experiments | 5/7 |
| Performance | 3/4 |
| Security | 3/4 |
| Adoption | 2/3 |
| Pitch | 1/2 |

Scores outside UI/UX are provisional, based on independently inspected source and README, not reproduced mathematical or benchmark results. I inspected QAOA configuration and normalization, benchmark record contracts, route wiring, feedback components, coordination UI, modal/navigation implementation, responsive CSS, and test file inventory. I did not run the tests or independently validate the claimed quantum results. The README explicitly disclaims quantum advantage; the implementation imports real Qiskit/Aer and has an explicit simulator resource limit. These warrant credit, but neither imports nor documentation establish correctness. README results also say both “matched Exact on four scenarios” and “matched Exact on three ... slightly worse on one”; that inconsistent summary costs pitch clarity and needs reconciliation with raw measurements.

## Evidence boundaries

Actual native Chrome observation: `http://127.0.0.1:5180/coordination`, existing synthetic request `DEMO-BFQ-4UNIT-001`, status Donor Accepted. Screenshot and accessibility tree captured successfully. The page showed a structured four-card workflow, consistent dark palette, visible heading, sample-data badges, action button, and audit timeline. The 2400×1706 screenshot is an image dimension, not a verified CSS viewport. I did not test mobile rendering.

Tool-control blocker, **not an application defect**: AX clicking the Research dock button and a supported Command-L/type/Return navigation attempt did not change the observable state. A coordinate click returned `noWindowsAvailable`; rebinding `cua.getApp('com.google.Chrome')` restored the accessibility observation but keyboard navigation still showed the existing page. I therefore stopped attempts and did not label any destination route broken. Browser released to parent.

All 16 navigation registry entries map to lazy imports and render cases in `frontend/src/navigation.js` and `frontend/src/App.jsx`: `/`, `/dashboard`, `/blood-banks`, `/hospitals`, `/network`, `/optimization`, `/emergency`, `/demo`, `/donor-network`, `/emergency-requests`, `/coordination`, `/results`, `/reports`, `/quantum-lab`, `/flow`, `/about`. Only `/coordination` was actually observed. The remaining 15 are **source-wired, runtime untested**. Unknown-route fallback is source-present, runtime untested. No loading/network error state was forced; feedback assessment below is source-only.

## Three strengths

1. **Strong trust boundaries in the actual coordination screen.** Route `/coordination`; observed heading explicitly says live authorization/integrations are not configured, banner says simulated demo/no real donors, cards say no clinical result, and helper text rejects live GPS, dispatch, shipment, and testing claims. Reproduce by reaching the accepted-donor synthetic session and opening Collection & transport. This helps users distinguish a demonstrator from a clinical service. Preserve these disclosures while making the workflow shorter to scan; no corrective fix required for the boundary messaging itself.

2. **Navigation has a single auditable source of truth and substantive keyboard intent.** Source `navigation.js`, `App.jsx:145–164`, and `components/Dock.jsx` (menu key handling around 300–325, named toolbar/menu items around 347–378 and 929–959). All 16 routes receive labels/titles/group membership; popstate is handled; malformed/unrecognized paths get a fallback. Dock declares accessible labels, expanded/current state, arrow-key navigation, Escape dismissal, focus restoration, and reduced-motion handling. Reproduce with keyboard through each group and browser Back when native controls are available; this is a verification recipe, not an executed pass. Preserve registry-driven wiring and add browser-level checks rather than duplicating route definitions.

3. **Reusable asynchronous and tabular accessibility scaffolding.** Source `components/Feedback.jsx` provides status/live loading, alert errors with retry, and empty status; `/optimization` has backend-disconnected messaging and Retry, and named focusable overflow regions at `Optimization.jsx:335,364,488,545`. The observed coordination screen exposed meaningful heading levels, named action, named theme switch, breadcrumb, and skip link in the AX tree. Reproduce API outage and keyboard table scrolling for runtime verification. Keep this shared pattern and extend it to successful workflow transitions.

## Three weaknesses

1. **Welcome modal lacks the interaction behavior implied by aria-modal.** Source-only, any first-visit route including `/`, `App.jsx:201`. The backdrop renders a dialog with `aria-modal=true`, but App has no modal-entry focus placement, focus trap, background inertness, Escape dismissal, or focus-return mechanism. Stepper's internal pane focus is not a full modal trap. Expected repro: fresh browser storage, visit `/`, press Tab repeatedly and Escape; verify focus cannot reach covered page/dock controls and dismissal works. I could not execute this repro due to native-control blocker. Fix with a tested dialog primitive/native dialog, explicit initial focus, contained Tab order, Escape close, inert background, and focus restoration. Severity: high accessibility risk; source confidence high, runtime confidence unverified.

2. **Route changes do not place focus in the new content.** Source-only, all dock/breadcrumb navigation, `App.jsx:141–143,189`. Navigation pushes history, updates state, and scrolls but does not focus the new heading/main region or announce its title. Main has an id but no programmatic focus target; Dock's dismissal restores trigger focus. A keyboard/screen-reader user may stay at the bottom navigation while the new page loads above. Repro: keyboard select Research → Solver Lab and inspect active focus and announcement, then Tab; not executed. Fix by focusing a `tabIndex=-1` page heading/main after route settlement, preserving sensible Back behavior, and testing screen-reader announcement. Severity: medium; source confidence high. The existing skip link is valuable but does not itself solve route-change orientation.

3. **Workflow status presentation exposes raw data tokens and misses success announcements.** Actual observed `/coordination`: Collection/checks showed `not_confirmed` twice and Transport showed `not_assigned`, alongside human-readable “Not arranged” and “Not confirmed.” Source `pages/Coordination.jsx:29–34` inserts raw collection/testing/transport values, and the changing progress/timeline has no live status region. Repro: inspect accepted-donor session; underscore tokens were directly seen. Advancing action and screen-reader announcement were not tested. Fix via centralized human-readable status labels, distinguish collection from testing explicitly, and a concise polite live message after successful transitions. Severity: low visual comprehension / medium assistive workflow risk; high confidence on visible raw labels.

## Responsive, loading and visual consistency limits

The observed desktop screen has a clear heading hierarchy, ample spacing, consistent card treatment, readable main text, and a coherent dark theme. This is a subjective visual assessment, not a measured WCAG contrast pass. Source `styles.css` includes narrow-layout rules, reduced-motion overrides, focus-visible styling, and bottom scroll padding for the fixed dock. Their existence is encouraging but does not prove absence of clipping/overlap on phones. Light theme, 200%/400% zoom, mobile portrait/landscape, screen readers, new-user modal, error/loading recovery, and all other route renders remain unverified; they should not be represented as failed or passed.

Confidence: **medium** for the overall vote, **high** for observed coordination labels and source omissions, **low** for whole-product runtime accessibility and non-UX rubric categories.

Cross-examination question: What browser-level evidence demonstrates keyboard-only first-visit onboarding and focus orientation across all 16 routes, and can you show an accessible announcement of each coordination checkpoint without moving focus away from the action?
