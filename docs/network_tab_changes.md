# Interactive Network tab

24 October 2026. Implemented in `frontend/src/pages/Network.jsx`, its dedicated `Network.css`, and `frontend/src/utils/networkGraph.js`. No visualization dependency or backend schema was added. The existing theme and `/network` route are retained.

## Data and model

The original Network page displayed facility and route cards with an available/blocked filter. It did not contain a graph canvas. The replacement renders a deterministic SVG bipartite graph from `GET /scenario`: blood banks on the left, hospitals on the right, and actual transport routes between them. These are schematic positions, explicitly not geographical coordinates. Positions are sorted by stable facility ID and remain unchanged when searching or filtering.

The inspector uses the API's stock, demand, urgency, location ID, compatibility rows, route status, travel time in minutes, distance in km, and per-unit transport cost. It does not invent route capacity. Available routes are limited by shared bank inventory and hospital demand; blocked routes permit no shipments. A blood-group filter means positive stock/demand of that group, not proof of donor/recipient compatibility. Compatible pairs are listed separately in the route inspector.

`GET /results` supplies an optional proposal overlay. Only `/optimize` records with a matching scenario ID, backend feasibility=true, and readable allocation/unmet arrays are candidates. Before rendering, the UI rechecks every shipment's integer quantity, route availability, compatibility, inventory totals, and served-plus-unmet demand against the **currently displayed scenario**. The latest record passing those checks is used. The UI labels it a saved proposal, never an actual dispatch or finalized delivery. Infeasible, mismatched, stale-to-constraints, malformed, or missing results are not converted into a zero-allocation result. This display safeguard supplements the backend validator; it does not validate clinical suitability or certify objective optimality.

## Interactions

| Interaction | Behavior |
| --- | --- |
| Pan | Pointer drag on empty canvas; pointer capture keeps dragging continuous. SVG screen-to-view coordinate conversion also handles mobile letterboxing. |
| Zoom | Explicit +/− buttons, 10%–400% limits, displayed zoom percentage; focused canvas supports +/− keys. Zoom holds the center world point fixed. |
| Fit/reset | Fit visible uses current node bounds; Home fits the focused canvas. Reset all clears filters, selection and hover and fits the entire graph. |
| Selection | Click or Enter/Space on a focusable SVG node/route. Inspector shows exact node quantities or route constraints; selected state is exposed with aria-pressed. Escape clears selection and neighbor mode. |
| Hover/focus | Native title tooltip plus a nonobstructive readout below the canvas; keyboard focus populates the same readout. |
| Search | Case-insensitive name, ID, location or blood-group text. Matching facilities retain connected context under the other filters. |
| Filters | Facility category, actual route status, positive stock/demand blood group, selected facility/direct neighbors, and routes with proposed shipments. Unavailable proposal/neighbor controls are disabled with visible context. |
| Neighbors | Inspector route buttons open individual routes; “Explore direct neighbors” resets conflicting filters and keeps only the selected facility and incident connections. |
| Hidden selection | A filtered-out selection remains inspectable with an explicit warning and a clear-filters action. Removed IDs on data refresh clear selection. |
| Refresh | Reloads both scenario and session results; current-constraint validation is repeated. An unavailable results service does not conceal the network. |
| Keyboard alternative | Expandable facility and route list offers ordinary HTML buttons alongside focusable SVG items. Arrow keys pan when the canvas itself has focus. |
| Empty/errors | API errors have retry; nonsynthetic/unavailable scenario is explicit; no-match filters have reset; missing proposal has a link to Optimization. Duplicate/dangling routes/IDs are diagnosed and excluded. |
| Responsive layout | Inspector stacks below the graph below 1100px; filters become one column below 600px; graph, list and inspector retain full-width controls. No force-layout animation or random movement. |

## Verification evidence

- `node --test frontend/tests/networkGraph.test.js`: **10 tests passed** after final helper edits. They cover deterministic layout, search context, group/category/status/neighbor/allocation filters, fit bounds, zoom-anchor invariance and limits, duplicate/dangling data, allocation feasibility rejection, current-result selection, the bundled scenario normalized as the API does, malformed quantity/compatibility data, changed-stock rejection, and a 48-facility / 576-route graph.
- `npm --prefix frontend test`: **53 frontend tests passed** at the final integration run, including three asynchronous request-ordering/cleanup regressions.
- `VITE_API_BASE_URL=https://bloodflow-q-api.vercel.app npm --prefix frontend run build`: production build passed after FullReviewStudy integration. Measured command evidence is saved in `audit/full_review_20261024/frontend_validation.json`; detailed logs beside it are ignored by Git.
- Live HTTP check loaded `/scenario`, executed a synthetic Greedy `/optimize`, fetched `/results`, and applied the actual frontend helper to that response: `synthetic_default`, **6 nodes, 9 routes, 3 allocated routes, 36 proposed units**. These are observed fixture outputs, not new performance claims. The check added a synthetic result to process-local history and sent no notifications.
- Native Brave was opened on `http://127.0.0.1:5173/network`. Its accessibility tree showed the loaded graph with **6/6 facilities, 9/9 routes**, eight available and one blocked route, all filters, zoom/fit controls, inspector and explicit missing-overlay state.
- Native interactions verified Bank A selection and its inventory **O=12, A=8, B=3, AB=2**, three connected routes, zoom changing **106% → 128%**, and direct-neighbor filtering changing visibility to **4/6 facilities and 3/9 routes**. Focus/hover readout showed Bank A's ID/location/stock metadata.

### Explicit incomplete browser checks

The final read-only native recheck found an active presentation in the browser, so no further UI inputs were sent. Browser connector inventory was empty. Native Brave access initially timed out, then succeeded. Further search-entry and interaction attempts were interrupted twice by “The user changed '/Applications/Brave Browser.app'”; the active native surface changed during testing. No settings were modified or restrictions bypassed. Therefore browser-console inspection, pixel-level rendering review, pointer-drag verification, full keyboard traversal, responsive viewport verification, search text entry, remaining dropdown filters, allocation-refresh rendering, and reset/fit clicks are **not claimed as browser-verified**. Their pure filter/viewport/validation behavior is tested, and the handlers compile, but those do not replace a complete end-to-end interaction pass.

To finish: open `/network`, select a node/route with both mouse and keyboard, search `bank_c` and a nonexistent ID, apply Available/Blocked and blood-group filters, test neighbor and allocation-only switches, drag blank canvas, zoom, fit, reset, refresh after a feasible Optimization run, inspect DevTools Console, and check 390px and desktop widths. Keep the current synthetic API running at port 8000. Do not call a shell HTTP 200 response proof of visual or interaction correctness.

## Final source review

Malformed quantity maps now exclude the affected facility with a visible warning, and malformed compatibility rows cannot crash proposal validation. Refresh clears stale hover metadata. The bundled-source fixture is explicitly normalized into the public API demand-map shape before testing.

The shared `useApi` hook previously let an older request overwrite newer data or clear the newer request's loading/error state. A small generation guard now publishes only the newest response and invalidates outstanding callbacks on effect cleanup. Three deferred-promise tests independently verify out-of-order success, stale failures, and cleanup followed by another load. It guards state publication; it does not cancel the underlying HTTP work.
