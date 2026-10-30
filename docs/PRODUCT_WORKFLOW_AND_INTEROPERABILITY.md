# BloodFlow-Q product workflow and interoperability boundaries

## Product scope

BloodFlow-Q is a synthetic-network decision-support and research prototype. It models bank inventory, hospital demand, compatibility, routes and transportation costs; compares allocation methods; and applies synthetic disruptions before re-optimization. Its distinct research question is how candidate initialization affects a constrained post-disruption allocation search. It does not identify live stock, contact a facility, reserve units, authorize a transfer, or confirm delivery.

The primary workflow is: select a synthetic scenario → inspect bank/hospital supply and demand → identify a bottleneck → run an allocator → review allocations and unmet demand → apply a simulated demand, inventory or route event → re-optimize on the changed scenario → compare before/after results in the saved session.

## Existing Indian blood-service workflows

e-RaktKosh already provides blood-availability search across registered centres with state, district, blood group, component and location filters, along with centre directory, donation-camp and donor services. Its own system description covers centralized blood inventory and other blood-centre management functions. BloodFlow-Q must not claim that these services are absent. A possible future role is a separately authorized optimization and resilience layer that evaluates allocation alternatives across a modeled network under changing demand or route conditions; it would complement, not replace, existing inventory, request or clinical workflows.

The public portal describes availability search and centre discovery. The blood-bank login page says stock is entered by blood banks and access requires authorization/approval. In the sources reviewed for this sprint, we did not find published public API documentation suitable for an authorized integration. This is a limited finding, not proof that no private, partner, or otherwise authorized interface exists. No portal scraping, access-control bypass, or live data integration is used.

## Quantum research direction

Selected direction: **post-disruption multi-bank/multi-hospital reallocation, testing QAOA candidate initialization as a warm start for the existing bounded classical local search**. The existing Round 2 artifact is a pilot: it contains a synthetic two-bank/two-hospital/four-route tradeoff, ten QAOA seeds, ten classical-multistart seeds, and QAOA-seeded local refinement, with a 100 objective-evaluation search budget and independent feasibility checks. It is not a large disruption benchmark and does not demonstrate quantum advantage.

Next confirmatory experiment: create paired pre-event and post-event versions of larger synthetic networks; apply route-capacity disruption or demand spike to generate the second case; compare QAOA-derived feasible starts against greedy and seeded feasible classical starts under the same objective, feasible neighborhood, evaluation budget, and preregistered seed schedule. Report raw QAOA feasibility separately; do not repair infeasible samples into successful starts. Independently validate every allocation. Record feasible-run rate, objective distribution, unmet demand, runtime (QAOA time and search time separately), first-feasible/time-to-target, and variability. Retain failed/skipped runs and specify the target before execution. This proposed extension still needs to be run before making claims about this problem class.

## Research transparency

The Quantum Optimization Lab reads its sample, histogram counts, circuit depth, shot count, seed, runtime, objective and validator checks from the saved raw experiment artifact. It shows the twelve highest-count observed bitstrings only when the bit lengths and count totals pass consistency checks. The complete sample remains inspectable and exportable. The Solver Lab and Experiment Reports remain the detailed locations for measured findings, including negative and infeasible outcomes.

## Product inspiration and scope boundaries

The referenced Blood Boys segment (about 08:12–10:18) presents an urgent path from blood group/location to nearby centre discovery, then a fallback to eligible and responsive donors with a low-friction request and response flow. The transferable product principle is to make the next useful action obvious and keep the urgent workflow short. BloodFlow-Q applies that principle to operations research: inspect shortage, run the allocation, and show what changes after a modeled disruption. Donor-facing UX and real outreach remain outside this research workflow; no simulated request is represented as an actual donor contact or delivery.

## Government references

- [e-RaktKosh portal: availability search and services](https://eraktkosh.mohfw.gov.in/eraktkoshPortal/)
- [e-RaktKosh system description](https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/about.cnt)
- [e-RaktKosh blood-bank login and stock entry / authorization notice](https://eraktkosh.mohfw.gov.in/eRaktKosh/hissso/loginLogin)
- [DGHS: Blood Transfusion Services and national framework](https://dghs.mohfw.gov.in/bts.php)
- [MoHFW: National Standards for Blood Centres](https://www.mohfw.gov.in/sites/default/files/National%20Standards%20for%20Blood%20Centres.pdf)

## Design-toolchain review and interface direction

**Reviewed:** 15 October 2026. This section records the available project foundation and tool choices so future UI work does not introduce competing systems.

### Product journeys and information architecture

The product flow follows the actual app journeys:

```mermaid
flowchart LR
    A[Understand synthetic network] --> B[Inspect supply, demand, routes]
    B --> C[Identify bottleneck]
    C --> D[Run comparable solvers]
    D --> E[Decode and validate candidate]
    E --> F[Inspect research evidence]
    F --> G[Apply synthetic disruption]
    G --> H[Re-optimize and compare delta]
    H --> I[Save or export result]
```

The intended design is a restrained research console: neutral slate surfaces and text, rose as the BloodFlow-Q brand accent, blue/emerald/amber for distinct analytical states, compact tabular numbers, and charts with visible units, denominators, solver identity, and unavailable/error states. The existing `frontend/src/styles.css` is the design source of truth through its `:root` variables (`--bg-*`, `--border-*`, `--text-*`, `--primary`, `--accent-*`, typography, radii, and shadows). Continue extending those variables and the existing reusable React components instead of adding a parallel token system.

### Tool and component decisions

- **Connected design services:** no TypeUI, Product Design, Miro, Figma, Penpot, or Vercel integration surfaced in the current Codex tool environment. No design file or board was supplied. This review therefore uses the equivalent product-flow map and design notes above; it does not claim those services were used.
- **Primary UI foundation:** keep React 18, Vite, and the existing hand-authored CSS system. The frontend has no Tailwind configuration. shadcn/ui's current Vite instructions style components with Tailwind, and DaisyUI is a Tailwind plugin, so adding either would introduce a second styling foundation for no demonstrated gap. Use native project components and Radix primitives for focused accessible interactions.
- **Existing specialized component:** `frontend/src/components/Tooltip.jsx` adapts Skiper UI's free Custom Tooltip using the already-installed Radix Tooltip package. Skiper documents that the free component permits personal/commercial use with attribution; the app footer currently links to Skiper UI. Keep that attribution if this implementation remains. Do not copy premium blocks or add its broader Tailwind/animation dependency set for this tooltip.
- **Icons:** continue using the already-installed `lucide-react` family with consistent sizing and stroke width. Do not add another icon package.
- **Research charts:** keep the current project-native CSS/HTML visualizations. They derive from validated backend responses or checked-in research artifacts, and their accessible labels expose measured values. Add a charting package only if a concrete chart cannot be expressed clearly with the existing approach.
- **Motion:** keep state-driven CSS transitions; do not add a second animation framework. Respect `prefers-reduced-motion` and never animate fabricated solver progress or imply that motion is quantum execution.
- **Storybook:** it is not installed and there is no `.storybook` setup. Defer it for this sprint: the key charts and comparison panels are application-specific and already have project tests for research metrics. Reconsider Storybook if the component set grows enough to justify maintaining a separate component harness; it must use the same component props and synthetic fixtures as the app.
- **Design source of truth:** no Figma or Penpot artifact is currently connected. Keep CSS variables and working application components authoritative; adopt one design tool if the team later provides an approved design file, rather than maintaining duplicate systems.
- **Preview deployment:** no Vercel connector surfaced here. Use the configured local Vite/API environment and production build for this pass. A preview deployment should be attempted only through the existing authorized project setup, never by publishing a production change just to inspect UI.

### Interaction and accessibility rules

- Navigation and data cards should help users move from network context to an actual solver result, emergency change, and evidence view.
- Animate only a real state change (such as a selected scenario, returned result, expanded explanation, or before/after chart). Keep status and result text available without relying on motion or color alone.
- Preserve keyboard focus visibility, semantic headings, labelled controls, table scroll regions, and chart text alternatives. Check mobile layouts at the existing CSS breakpoints and honor reduced-motion preferences.
- Keep loading, empty, partial, failed, infeasible, and unavailable states distinct. Never show placeholder success metrics where a solver response or artifact is missing.

### References reviewed

- [TypeUI Codex guide](https://www.typeui.sh/docs/guides/codex) (connection/setup guide; MCP not connected here)
- [Product Design overview](https://openai.com/business/plugins/product-design/) (no capability available in this coding environment)
- [shadcn/ui Vite installation](https://ui.shadcn.com/docs/installation/vite) and [manual setup](https://ui.shadcn.com/docs/installation/manual)
- [DaisyUI introduction](https://daisyui.com/docs/intro/)
- [Skiper Custom Tooltip and license](https://skiper-ui.com/v1/skiper101) and [Skiper quick start](https://www.skiper-ui.com/docs/quick-start)
- [Storybook React + Vite](https://storybook.js.org/docs/get-started/frameworks/react-vite)
- [Figma](https://www.figma.com/), [Penpot](https://penpot.app/), [Miro](https://miro.com/), [Lucide](https://lucide.dev/), [Magic UI](https://magicui.design/), [Aceternity UI](https://ui.aceternity.com/), and [Motion Primitives](https://motion-primitives.com/) were considered as references, not used as connected integrations or installed dependencies.
