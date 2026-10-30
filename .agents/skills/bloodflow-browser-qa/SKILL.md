---
name: bloodflow-browser-qa
description: Validate BloodFlow-Q user journeys, evidence filters, allocation graphics, themes, and accessibility in a real browser, retaining reproducible screenshots and measured failures.
---

# BloodFlow-Q browser QA

Inspect `frontend/package.json`, `frontend/vite.config.js`, `backend/main.py` and environment availability before starting services. Use an existing compatible Python virtual environment or a project-local one; do not rely on a machine-wide Python having the research dependencies.

## Start a verifiable session

1. Run the API with `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000` from the root, then Vite from `frontend/`. Check `/health` and `/scenario` before testing solver interactions. Development origins allow localhost/127.0.0.1 on 5173; do not silently move the UI to another port without matching CORS.
2. Use Playwright MCP when callable. If it is configured but unavailable to the session, disclose the limitation and use the installed Playwright CLI or a direct MCP client. Confirm real browser interaction rather than counting a build as browser validation.
3. Capture console errors and failed API/asset requests. Record expected unsupported/resource-limited responses separately from regressions.
4. Handle the actual welcome dialog by accessible controls. Theme is stored as `bloodflow-theme`, applied through the root `data-theme`; verify the toggle changes computed styles rather than only its label.

## Journey and page checks

- `/dashboard`: load live synthetic metrics and follow its optimization action.
- `/network`: select a bank, hospital and route; inspect stock/demand and compatibility; use search, blood-group/status filters, zoom/reset and keyboard selection. A validated overlay must match the displayed scenario. Verify before/after values if that control exists.
- `/demo`: run the flagship story and both policy comparisons on matching inputs. Confirm quantities against response allocations and check that different policy objectives are not treated as a common score.
- `/emergency`: submit a real synthetic disruption through the form steps, inspect original/modified scenarios and before/after fulfillment. Check resource-flow conservation and empty allocation behavior.
- `/optimization`: run an available classical solver; test a small permitted QAOA case where feasible. Confirm loading, cancellation/error handling, feasibility and result provenance.
- `/results` and `/reports`: change family, scenario, solver and metric filters; inspect a plotted value against its original observation. Test no-matches, failures/skips and missing metrics; verify paired sample counts and methodology/export controls.
- `/quantum-lab`: switch saved executions, validate count total against shots, inspect QAOA p separately from compiled depth, and confirm simulation and unavailable circuit/hardware states are explicit.

Use fresh browser snapshots after navigation or filter changes before targeting controls. For each changed page, capture desktop and mobile in both themes under `output/playwright/`, using filenames with route, viewport and theme. Record exact dimensions and browser version in the release report.

## Layout and accessibility

Test at a desktop size and a narrow mobile size (for example 1440×1000 and 390×844). Check horizontal document overflow, clipped axis labels, tooltip visibility, scrollable tables, dock/content overlap and modal containment. Chart data must remain readable through an accessible table or equivalent text. Navigate filters, SVG nodes and dialogs with keyboard; verify labels, focus visibility, focus return, contrast and reduced-motion behavior.

Keep screenshots and exports limited to synthetic/public evidence. Do not enable the private Supabase pilot or perform real outreach for a visualization test. SQL source guardrail tests do not establish that live RLS has been exercised.

After fixing a defect, replay the failing interaction and capture the corrected state. Handover records commands, routes/actions, screenshots, console/request findings and remaining unverified behavior; it distinguishes tested functionality from an unexecuted checklist.
