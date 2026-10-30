# Optimization UI and semantic-theme engineering report

Implemented locally on 2026-10-30 in `BloodFlow-Q-main 3`, starting from `6e06f50`. These changes are not deployed. The production screenshot and reproduction were from `https://bloodflow-q.vercel.app/optimization`; after-fix verification used Vite on port 5173 and the actual local API on port 8000. The deployed build has older explanatory copy than this checkout.

## Root causes and corrections

1. **Alert contrast:** `.benchmark-skip-notice` assigned fixed light-theme colors to `strong`, `p`, `li`, and its action text. Dark mode only changed the parent surface/foreground, so these descendants stayed dark. Removed those overrides and added paired information, success, warning, and error tokens. Shared notices and status badges now consume those tokens. Headings use the existing primary text token; links are underlined; icons and body use semantic foregrounds. Inline success/error messages and error cards use the same palette.
2. **Layout:** the document is the scroll container, while scroll padding was set on non-scrolling `main`. Several independent viewport-based padding values and the dock's inline bottom offset obscured the clearance contract. Dock height, bottom offset, safe-area inset, and breathing space now define shared clearance for content, the final footer, document scroll padding, and toasts. The dock remains fixed in its existing position and retains its design. Additionally, the comparison panel's automatic grid minimum width expanded it to 1091px inside a 354px mobile card, clipping the explanatory content. Shrinkable grid/card children now allow only the wide table to scroll horizontally; the alert wraps within the card.
3. **Runtime:** `run_baseline_benchmark` started its timer before `ExactSolver.solve`. That solver builds bounded shipment variables, multiplies their range sizes, and raises `ExactSolverLimitError` before enumeration. The displayed approximately 0.0002 seconds was preflight/safety-check elapsed time, not solver search or job dispatch. All safety-refusal branches now return `runtime_seconds=None`, including the generic benchmark adapter and QAOA resource-refusal path. A shared frontend formatter also suppresses legacy skipped timings and incomplete/failed-attempt timings. Actual completed or infeasible measured executions retain their runtime, including legitimate zero.
4. **Status semantics:** Completed, Completed (infeasible), Running, Skipped · safety limit, Not selected, Unsupported by backend, Failed, and Not run / variant unavailable have distinct labels/explanations. Unselected QAOA is named simply QAOA instead of suggesting a missing recorded variant. Changing the checkbox after a response cannot relabel that recorded result. Loading text names only selected methods. The Exact explanation includes the backend's actual candidate count and configured cap, and explains the product of `(upper bound + 1)` shipment ranges separately from QUBO bits.
5. **Application-wide findings:** removed opacity-based fading of readable pipeline steps; strengthened light-theme secondary/subtle and quantum visualization text; fixed the About algorithm tag; paired the pale dark-theme primary button surface with a dark foreground via `--on-primary`; gave disabled primary buttons readable theme colors. Research and chart tooltips now use theme surfaces/foregrounds, with research tooltips above the dock. Toasts reserve dock clearance.

## Verification

- Reproduced the production dark-mode failure with Playwright MCP and captured `output/playwright/optimization-before.png`.
- The original heading/body contrast measured **1.05:1 / 1.34:1**. The corrected alert measures **11.92:1 / 9.80:1** in dark mode and **13.19:1 / 8.01:1** in light mode.
- A backend regression assertion first failed with a non-null skipped runtime. After the fix, `python -m pytest tests/test_api.py tests/test_benchmark.py -q`: **35 passed**.
- `npm --prefix frontend test`: **77 passed**, including legacy runtime suppression, execution-state distinctions, real zero runtime, and absent/invalid runtime cases.
- Production build succeeds with a valid HTTPS API-origin configuration. The pre-existing large JavaScript chunk warning remains. The verification build used `https://example.org` only as a non-secret validation placeholder; it is not a deployment artifact configured for production service.
- Real local `/benchmark` response: Greedy/MILP completed with measured durations; Exact `skipped_too_large` with null runtime; QAOA `not_requested` with null runtime.
- Playwright MCP checked all **16 routes × 2 themes × 2 viewport widths (1440 and 390, height 900)**. All 64 checks passed document-width and final-footer dock-clearance checks. Desktop footer content ends about 25px above the dock; mobile has additional clearance.
- axe-core 4.10.3 color-contrast scans were run while scrolling through each page, not solely at its initial viewport. The initial audit exposed additional issues, which were fixed. The final targeted Optimization/Reports matrix has no reported contrast violations. Expanded legacy Reports content also passes in both themes. JSON files retain the intermediate findings and the recheck rather than overwriting evidence.
- Focused alert checks confirm its entire bounds are within the viewport width and above the dock at desktop/mobile sizes in both themes. On mobile, the alert ends at approximately y=697 while the dock begins at y=840.
- Research tooltips show readable paired foreground/surface colors in both themes. Mobile research dock menus are inside the viewport and pass center-point hit testing. The mobile solver dropdown is visible within the viewport. The welcome dialog occupies the browser top layer and passes center-point hit testing.
- Screenshots were visually inspected for the mobile alert and complete Optimization page. Full-page screenshots cover Optimization, Reports, Dashboard, Results, Emergency, and Demo/Flagship in both themes and widths.

## Evidence and reproduction

- [Before screenshot](../output/playwright/optimization-before.png)
- [Dark mobile alert after](../output/playwright/audit/alert-dark-390.png)
- [Dark desktop alert after](../output/playwright/audit/alert-dark-1440.png)
- [Light mobile alert after](../output/playwright/audit/alert-light-390.png)
- [Full route audit function](../output/playwright/audit-routes.cjs)
- [Targeted recheck function](../output/playwright/audit-recheck.cjs)
- [Initial findings](../output/playwright/audit/initial-results.json)
- [Scrolling route audit](../output/playwright/audit/route-results.json)
- [Final Optimization/Reports recheck](../output/playwright/audit/recheck-results.json)

The browser functions are Playwright MCP `browser_run_code_unsafe` callback files. They expect the local frontend/API, onboarding dismissed, and axe-core at `/tmp/bloodflow-axe.min.js` (downloaded from the versioned cdnjs 4.10.3 distribution). Screenshot paths target this checkout.

## Verification limits

This is a targeted visual/contrast regression audit, not a certification of every accessibility rule or every interactive state. Axe retains incomplete items for off-screen, animated, or complex backgrounds; scrolling checks, explicit alert color calculations, and screenshot inspection supplement its results. Authenticated external-service workflows and every possible chart tooltip datum were not exercised. Browser validation was in the MCP Chromium environment; physical iOS safe-area behavior was not device-tested. Deployment is still required for these changes to affect the referenced public site.

## Palette restoration requested by user

Restored the deployed Vercel colors on 2026-10-30 by reading the live site's computed CSS variables in both themes. The newer scientific-workbench palette had overridden the deployed theme globally. Its canvas, surface, text, border, primary, and accent overrides now match Vercel: dark canvas `#171a2a`, surface `#202438`, vivid red primary `#d90429`; light canvas `#f5f7fb`, surface `#ffffff`, primary `#920942`. Both primary buttons use white foregrounds again. This supersedes the earlier pale-pink button pairing described above. Existing alert contrast fixes, safe-area/dock clearance, mobile table containment, and runtime/status corrections remain. Pipeline step numbers use the existing muted token to avoid restoring their old contrast defect.

Repeated the eight Optimization/Reports desktop/mobile and light/dark scrolling checks after restoration: zero reported axe contrast violations, no document horizontal overflow, and footer clearance passed. Evidence: [palette recheck](../output/playwright/audit/palette-restoration-results.json), [restored dark palette](../output/playwright/audit/restored-vercel-palette.png). The full-page Optimization/Reports screenshots now show the restored palette; earlier focused alert images document the preceding palette. Production build passes. Changes remain local and are not deployed.

### Final original-palette match

A second direct comparison against deployed computed component styles found remaining research CSS overrides: new cyan/blue visualization accents, a brighter information border, a different font stack, and an opacity of 0.2 on the original red heartbeat backdrop. Removed the global research palette/surface/font overrides altogether, so the original `styles.css` theme is authoritative. Research visualization tokens now reference original application accents. Information borders match the original light/dark colors; corrected text foregrounds remain readable. Sampled dark-mode canvas, panels, controls, table, alert surface/border, topbar, dock, and font styles now match production (excluding transient reveal-animation opacity). The eight Optimization/Reports contrast/overflow/clearance checks pass again. [Final matched screenshot](../output/playwright/audit/original-palette-matched.png). Changes remain local.
