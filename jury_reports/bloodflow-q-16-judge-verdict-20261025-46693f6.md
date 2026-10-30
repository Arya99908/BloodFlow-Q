# BloodFlow-Q: 16-Judge Hackathon Verdict

**Audited 25 October 2026. Selected submission:** `evenmore-fix-and-heartbeat-additon`, commit `46693f6519bdd385b67b3b69b2c4a450a058d67a`, in `/Users/shreeshaks/Documents/BloodFlow-Q-main 3`.

## 1. Executive verdict

**Official score: 70/100. Competition tier: credible contender; substantial research prototype, not presently a winning submission or a demonstrated strong finalist.**

The central achievement is a functioning, inspectable synthetic allocation laboratory: shared feasibility checks, strong classical references, actual simulated QAOA variants, emergency re-optimization, and unusually candid experiment records. It is more substantial than a decorative optimization dashboard. Its strongest evidence supports research and education; it does not establish a superior hospital allocation product or useful quantum advantage.

**Three differentiators:**

1. A real API-to-dashboard optimization path with independently checked objectives and allocation feasibility, including exact/MILP references (J7, J12).
2. Genuine QAOA, LP-based warm starts, and XY variants with observable sample feasibility and provenance—not a classical allocator renamed “quantum” (J13).
3. Saved paired experiments, held-out instances, classical replacement controls, and negative results that can be recomputed rather than accepted on faith (J11, J15).

**Three largest risks:**

1. Front-door claims overstate implemented constraints, classical difficulty, and timing; one README result count is wrong (F3).
2. Lower weighted cost can deliberately leave much more demand unmet, including critical demand. Mathematical feasibility is not an approved operational policy (F4).
3. Boundary failures and incomplete user/privacy/compute lifecycles undermine a skeptical demo and any deployment claim (F1, F5, F7–F9).

**Most important competition improvement:** demonstrate one contested, small multi-facility case with an explained shortage policy, the exact classical reference, and honest quantum comparisons. Make the project's memorable claim “we can audit where quantum helps or fails,” supported by the existing negative evidence.

### Panel integrity and scope

There were **exactly 16 voting evaluators: the chair plus 15 genuine specialist subagents; no simulated jurors**. Concurrency was limited to four, so reviews ran in batches. Three additional, unscored subagent instances were stopped when inherited conversation history was found to contain earlier summaries; fresh context-isolated replacements produced their accepted ballots. Those discarded instances cast no votes. Thus 18 specialist instances were launched, but only 15 specialist evaluations counted.

Every accepted juror submitted an initial report before cross-examination. All 16 then independently finalized their votes. The chair's rubric recommendation does not overwrite those votes. Initials, finals, revisions, raw chair API responses, and the cross-examination docket are retained in `jury_reports/`.

**Mean corrected initial score: 67.69; median: 68; range: 60–73. Final mean: 67.69; median: 68.5; range: 61–73.** J3's initial headline was 74 but its categories summed to 69; J3 confirmed an arithmetic error before deliberation. The original remains preserved. Including that erroneous headline would give an initial mean of 68.00 and range 60–74.

The shared conclusion is a credible synthetic research prototype with no demonstrated quantum advantage or clinical benefit. There is no unanimous competition-ranking claim: the consumer juror remains least convinced, while the design juror gives more credit to presentation and prototype scope.

## 2. Sixteen individual jury scorecards

The linked ballots contain separate investigations, category assessments, commands, source references and final deliberations. **J1–J16 below are evidence identifiers**, not interchangeable reviewer opinions. Code paths throughout this report refer to the selected checkout.

| Juror | Scope | Initial | Final |
|---|---|---:|---:|
| J1 | Chief Hackathon Judge and Panel Chair | [68](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror01-initial.md>) | [70](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror01-final-addendum.md>) |
| J2 | Consumer and End-User Advocate | [60](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror02-initial.md>) | [61](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror02-final.md>) |
| J3 | Blood-Supply Operations Domain Specialist | [69](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror03-initial.md>) | [69](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror03-final.md>) |
| J4 | Social Impact, Ethics, and Responsible Use | [70](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror04-initial.md>) | [69](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror04-final.md>) |
| J5 | Product Strategy, Adoption, and Pitch | [65](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror05-initial.md>) | [65](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror05-final.md>) |
| J6 | UI/UX and Accessibility Specialist | [73](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror06-initial.md>) | [73](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror06-final.md>) |
| J7 | Frontend and Live-Demo Examiner | [66](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror07-initial.md>) | [65](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror07-final.md>) |
| J8 | Adversarial QA and Test Engineer | [69](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror08-initial.md>) | [69](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror08-final.md>) |
| J9 | Reliability and Edge-Case Investigator | [68](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror09-initial.md>) | [67](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror09-final.md>) |
| J10 | Software Architecture and Code Quality | [65](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror10-initial.md>) | [65](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror10-final.md>) |
| J11 | Data Quality and Statistical Validity | [68](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror11-initial.md>) | [68](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror11-final.md>) |
| J12 | Classical Optimization and Operations Research | [67](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror12-initial.md>) | [67](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror12-final.md>) |
| J13 | Quantum Algorithm and QAOA Specialist | [70](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror13-initial.md>) | [70](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror13-final.md>) |
| J14 | Quantum Research and Literature Reviewer | [66](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror14-initial.md>) | [66](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror14-final.md>) |
| J15 | Experimental Design and Reproducibility | [70](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror15-initial.md>) | [70](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror15-final.md>) |
| J16 | Performance, Scalability, Security, and Deployment | [69](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror16-initial.md>) | [69](</Users/shreeshaks/Documents/BloodFlow-Q-main 3/jury_reports/juror16-final.md>) |

### J1 — Chief hackathon judge and chair

**68 → 70; confidence medium-high overall.** Scope: complete submission and evidence integration.

**Strengths:** working live demo pipeline; credible exact-classical references; transparent quantum and synthetic limitations. **Weaknesses:** weak incremental quantum value; default shortage-policy interpretation; optional donor privacy lifecycle and overstated pitch. Evidence: chair API artifacts, `optimization/objective.py:calculate_objective`, J12/J13, and independently inspected donor SQL.

**Toughest question:** why is MILP leaving 27 units unmet preferable to Greedy leaving two, and who validated that tradeoff? **Personal verdict:** credible contender, not a winner. Verification increased technical credit; weaker adoption/pitch evidence and confirmed full-profile access persistence reduced it. An intermediate 71 was reduced to 70 after the privacy cross-check.

### J2 — Consumer and end-user advocate

**60 → 61; confidence moderate on workflow, lower on solver internals.** Scope: a non-quantum coordinator's task.

**Strengths:** visible synthetic boundaries; shipment/shortage tables; explicit unavailable-result and session-history explanations. **Weaknesses:** no straightforward full-network scenario creation in the main catalog; research terminology, cost-unit ambiguity and misplaced diagnostics; no durable, explained plan handoff. Evidence: `Hospitals.jsx:94–119`, `Optimization.jsx:442–523`, `Results.jsx:139–177`, observed `/coordination`.

**Toughest question:** can a coordinator configure a hypothetical shortage and explain every unmet unit without a developer? **Verdict:** suitable for supervised synthetic evaluation, not yet self-service. Cross-examination verified existing emergency demand/inventory/route/priority edits, earning one User point; this is not an entirely fixed-input application.

### J3 — Blood-supply operations specialist

**69 → 69; confidence medium-high on domain/model findings.** Scope: conservation, compatibility, urgency and logistics assumptions.

**Strengths:** donor and recipient groups remain distinct; shortages and stock conservation are checked; per-unit time/cost metrics have coherent definitions. **Weaknesses:** core ABO-only model lacks claimed Rh/deadline constraints; priority is a price rather than guaranteed service; no expiry, capacity or operational validation. Evidence: `constraints.py:71–80`, `objective.py:190–254`, `milp.py:129–164`; 23 focused tests passed.

**Toughest question:** show a case where available stock is withheld from critical demand and explain the policy. **Verdict:** credible educational optimization prototype. Its 120-minute/cost-100 example produced MILP objective 15 with no shipment, versus Greedy 112 with one shipment. Both are mathematically correct. Tiny quantum demos do not mean the underlying model cannot represent multiple facilities.

### J4 — Social impact, ethics and responsible use

**70 → 69; confidence moderate, high on inspected safeguards.** Scope: consent, fairness, impact claims and accountability.

**Strengths:** willing donors are not counted as usable inventory; consent and institution checks are implemented; objective components and synthetic limits are visible. **Weaknesses:** no demonstrated distributional fairness; donor full-profile read eligibility can outlast request closure; public-health rhetoric exceeds measured synthetic outcomes. Evidence: `donor_matching.py:73–134`, donor migration `274–320,616–627,863–865,956–959`; 23 unittest checks passed, not a live database audit.

**Toughest question:** who authorizes the weights, audits persistent regional shortage, and expires donor access? **Verdict:** advance as research, not a deployed health service. Security fell one point after independently confirming closure behavior and full-row visibility; no hosted breach was alleged.

### J5 — Product strategy, adoption and pitch

**65 → 65; confidence high on positioning, lower on technical certification.** Scope: target user, differentiation and presentation.

**Strengths:** researcher-oriented workflow is coherent; real scenario/solver execution paths exist; coordination distinguishes acceptance, testing, release and receipt. **Weaknesses:** emergency-network claims exceed compact-demo evidence; no demonstrated institutional adoption bridge; research and donor-product stories compete for attention. Evidence: `Home.jsx`, `DemoMode.jsx`, `backend/demo_scenarios.py`, `donorNetwork.js`; live health/catalog GETs only in its initial review.

**Toughest question:** who returns to use this, and what decision improves beyond using MILP alone? **Verdict:** research/education demonstrator. Recommended pitch: “Explore synthetic allocation changes, compare classical solvers with simulated QAOA, and inspect feasibility and failure.” It challenged J7's initially full pitch score despite accepting the live-demo evidence.

### J6 — UI/UX and accessibility

**73 → 73; confidence medium overall.** Scope: visual cohesion, navigation and assistive interaction.

**Strengths:** observed coordination screen clearly marks simulation; a shared route registry and keyboard-aware dock exist; feedback and table components contain useful accessibility scaffolding. **Weaknesses:** welcome-dialog focus behavior is incomplete in source; route changes lack explicit focus transfer; visible raw status labels such as `not_confirmed` need translation. Evidence: `App.jsx:141–143,189,201`, `Dock.jsx`, `Coordination.jsx:29–34`.

**Toughest question:** demonstrate keyboard-only onboarding and orientation across all routes. **Verdict:** conditional advancement with a strong presentation foundation. Only coordination was directly observed by this juror; native-control failures blocked further interaction. Modal/focus findings remain source-supported risks, not executed accessibility failures. J7's route passes do not resolve them.

### J7 — Frontend and live-demo examiner

**66 → 65; confidence high for observed desktop behavior, moderate overall.** Scope: all 16 route bodies and selected real workflows.

**Strengths:** live Greedy results matched API records; historical results are visibly distinguished from live runs; synthetic request → donor acceptance → coordination worked through SPA navigation. **Weaknesses:** MILP/Greedy shortage tradeoffs lack sufficient interpretation; hard-coded seven-node/222-bit explanations misdescribe the scenario and Exact search; live private operations remain unconfigured. Evidence: observed `/optimization`, `/demo`, `/reports`, coordination routes, `Optimization.jsx:587–597`.

**Toughest question:** explain 27 versus two unmet units without implying the cheaper plan serves more demand. **Verdict:** candid research demonstrator. Pitch fell one point after J5's challenge. Reported viewport overflow remains provisional because browser zoom was not independently established.

### J8 — Adversarial QA and test engineering

**69 → 69; confidence high on executed tests/boundaries.** Scope: existing suites and 17 custom API cases.

**Strengths:** 194 Python tests plus 21 subtests passed under explicit scoped discovery; 53 frontend tests passed; malformed quantities, duplicates, blocked routes and empty results have useful coverage. **Weaknesses:** root pytest fails collection; boolean inventory becomes one unit; valid all-zero QAOA returns 502. Evidence: `pytest.ini`, `schemas.py:25`, `ising.py:84–86`, QA05/QA17 in its report.

**Toughest question:** why does HTTP validation defeat the domain's explicit boolean rejection? **Verdict:** credible contender. Visible error handling does not make every error classification correct. Passing utility tests do not certify the browser or every scenario.

### J9 — Reliability and edge cases

**68 → 67; confidence high on executed API cases, medium on concurrency risks.** Scope: complete result and failure paths.

**Strengths:** real shortages remain feasible with explicit unmet demand; quantum fallback/error provenance is visible; stale-read protection and bounded history exist. **Weaknesses:** API coercion; mutation completions lack the read-path generation protection; no complete execution deadline/cancellation contract. Evidence: `services.py:283–313,531–555`, `latestRequest.js`, `App.jsx:120–124`, `api.js:4–18`.

**Toughest question:** can a newer Quick Optimization reliably supersede an older pending local run? **Verdict:** conditional support, not operational reliability. Quantum correctness fell one point after a fresh zero-instance reproduction. The mutation race remains source-traced, not browser-reproduced.

### J10 — Architecture and code quality

**65 → 65; confidence high on cited architecture/boundary findings.** Scope: interfaces, dependencies, history and branch differences.

**Strengths:** domain/solver/API separation; explicit provenance and production error boundaries; useful focused tests and exact references. **Weaknesses:** coercive “StrictModel”; shared process result state and incomplete compute admission; large service/UI surface with repeated configuration and no Python lockfile. Evidence: `schemas.py:10–32`, `services.py:390–410`, `milp.py:169`, manifests; 31 tests plus four subtests passed.

**Toughest question:** what verified quantum improvement reaches a user through a bounded, isolated job lifecycle? **Verdict:** advance as research/demo engineering. Shared synthetic history is not evidence that actual donor/patient records leaked; the separate private path must be judged separately.

### J11 — Data quality and statistics

**68 → 68; confidence high on recomputed arithmetic.** Scope: fixtures, generators, denominators and charts.

**Strengths:** clear synthetic provenance and units; no duplicate keys in the checked 992-record study; all 11 aggregate optimal-feasible probabilities matched independent recomputation. **Weaknesses:** README's four-match count is false; tiny generator distributions lack operational calibration; eight held-out templates cannot establish population-level benefit. Evidence: `data/*.json`, `instances.py`, `analyze.py`, `researchMetrics.js`; 20 data tests plus four subtests passed.

**Toughest question:** what operational sampling scheme would test whether benefit survives correlated demand and realistic logistics? **Verdict:** credible synthetic research. Ten optimizer seeds do not create ten independent hospital instances. Historical corrected boundary artifacts must not be reported as current failures.

### J12 — Classical optimization and operations research

**67 → 67; confidence high on classical mathematics.** Scope: objectives, feasibility, exact/MILP/LP and baseline fairness.

**Strengths:** 100 independently enumerated random cases matched exact/MILP/LP; the bundled MILP/LP objective is 202.7; bounded QUBO/Ising checks support formulation consistency. **Weaknesses:** the original model has an integral network-flow LP structure, weakening hardness claims; Greedy can ignore unfavorable marginal cost; dense matrices and missing solve budgets limit engineering. Evidence: `milp.py:115–169`, `greedy.py:117–128`; 37 selected tests passed.

**Toughest question:** what does quantum add after the original LP already reaches an integral optimum? **Verdict:** strong classical prototype, unproved winning quantum contribution. Integrality means an integral optimal vertex exists, not that every optimal LP point is integral or that hypothetical fixed-dispatch extensions inherit the property.

### J13 — Quantum algorithms and QAOA

**70 → 70; confidence high on inspected/executed quantum behavior.** Scope: mapping, gates, preparation, sampling and simulator parity.

**Strengths:** genuine circuit execution; meaningful energy/bit-order/warm-start checks; sample feasibility and seed provenance are exposed. **Weaknesses:** XY does not preserve allocation feasibility; research empty-graph XY differs from production; incremental benefit after classical preparation remains unproved. Evidence: `qaoa_solver.py:167–256,259–345,390–489`, `algorithms.py:72–73`; 23 tests plus four subtests and all four tiny variants executed.

**Toughest question:** what improvement survives replacing quantum processing with the same classical seed/search budget? **Verdict:** technically substantial contender. Cross-examination showed the empty-graph defect does not affect the two checked primary studies, while universal parity remains false.

### J14 — Quantum literature reviewer

**66 → 66; confidence high on literature applicability.** Scope: primary scientific foundations and useful next experiments.

**Strengths:** recognizable QAOA semantics; serious classical/seed controls; failures and sample-quality metrics are inspectable. **Weaknesses:** qubit count overstates decision complexity on tiny cases; XY preserves the wrong invariant for full feasibility; ideal training and precomputed tables limit attribution. Evidence: production/research source and the seven verified papers in section 7.

**Toughest question:** what falsifiable workload could show a benefit beyond an already optimal LP seed? **Verdict:** educational/research demonstration. It corrected its warm-start wording to affine regularization followed by numerical clipping and rejected both automatic advantage and automatic impossibility claims.

### J15 — Experimental design and reproducibility

**70 → 70; confidence high on saved-artifact recomputation.** Scope: protocols, raw studies, denominators and timing attribution.

**Strengths:** instance-paired statistics and retained failures; identical-wrapper quantum replacement tests; useful configuration/source provenance. **Weaknesses:** README arithmetic/timing claims; toy instances and answer-revealing preprocessing; version-specific, partly amortized timing and incomplete dependency hashing. Evidence: study/necessity JSONL, configurations, analysis scripts; 21 research unit tests passed freshly.

**Toughest question:** which held-out workload retains benefit after all table construction, preparation, training and synthesis costs? **Verdict:** unusually well-instrumented research prototype; quantum necessity unproved. It corrected attribution of a 2.0179-second unproved solve to the hypothetical fixed-dispatch extension, not the original formulation.

### J16 — Performance, security and deployment

**69 → 69; confidence high on local source/measurements, low on hosted readiness.** Scope: runtime limits, trust boundaries and reproducible startup.

**Strengths:** real QAOA/exact/history caps; production origin/error configuration checks; substantive optional authorization SQL. **Weaknesses:** QUBO allocation occurs before its qubit guard; shared results and incomplete donor-access expiry; unpinned Python environment and absent end-to-end deadlines. Evidence: `services.py:539–543`, `qubo.py:434`, `milp.py:169`, donor migration; 16 tests plus 13 subtests passed.

**Toughest question:** what pre-allocation size, concurrency and total-time budgets protect public endpoints? **Verdict:** credible demo; public deployment engineering incomplete. No stress failure, hosted breach, clean install or production capacity was claimed.

## 3. Final weighted rubric

These are the chair's evidence-weighted awards, **not the average of votes**.

| Category | Maximum | Award | Evidence-based justification |
|---|---:|---:|---|
| Problem definition and potential impact | 7 | 6 | Important allocation question; no measured operational/patient outcome (J3/J4). |
| End-user utility and workflow | 8 | 5 | Real workflows and outputs; configuration and policy explanation remain research-oriented (J2/J7). |
| Domain and constraint fidelity | 8 | 5 | Conservation/compatibility/shortage implemented; aggregate ABO-only core lacks expiry/deadlines/capacity (J3). |
| UI/UX, accessibility, demo experience | 6 | 4 | All route bodies observed; selected workflows work; accessibility and responsive coverage incomplete (J6/J7). |
| Architecture and code quality | 6 | 5 | Good mathematical separation; service/configuration complexity and state boundaries need work (J10). |
| Testing and reliability | 9 | 7 | Substantial passing scoped suites; root collection and real boundary failures remain (J8/J9). |
| Data quality and statistical validity | 8 | 6 | Synthetic provenance and arithmetic strong; external validity narrow (J11). |
| Classical optimization and baselines | 10 | 9 | Independent enumeration and LP/MILP agreement; weak Greedy interpretation and runtime metadata limits (J12). |
| Quantum algorithm correctness | 10 | 8 | Genuine, tested circuits and encoding; zero-variable and research-parity boundaries remain (J13/J9). |
| Quantum contribution and novelty | 8 | 3 | Useful integration/controlled research; known algorithms and no useful advantage established (J13–J15). |
| Experimental rigor/reproducibility | 7 | 6 | Paired controls, held-out cases, raw provenance and negative findings; timing/version limitations (J15). |
| Performance/scalability | 4 | 2 | Fast local classical results; simulation and request resource limits constrain scale (J16). |
| Security/privacy/responsible use | 4 | 2 | Honest scope and consent checks; confirmed access-lifecycle gap and untested hosted enforcement (J4/J16). |
| Adoption/product viability | 3 | 1 | No demonstrated institutional use, durable handoff or real integrations (J2/J5). |
| Pitch clarity/presentation | 2 | 1 | Attractive research story weakened by numerical/domain/complexity overclaims (J5/J7). |
| **Total** | **100** | **70** | **Arithmetic independently checked.** |

Largest category disagreements in final votes: User **4–6/8**, Testing **5–7/9**, Data **4–6/8**, Classical **7–9/10**, Quantum correctness **6–8/10**, Quantum contribution **2–4/8**, Experiments **4–6/7**. They mostly reflect different professional priorities and evidence depth. Lower-confidence broad scores were not treated as independent mathematical certifications.

Material resolutions: critical shortage is a policy issue, not a solver bug; original flow integrality does not transfer to fixed-dispatch extensions; empty-graph XY mismatch does not invalidate the checked main studies; saved historical MILP boundary failures were corrected; rendered routes do not establish accessibility. Unresolved: mutation race reproduction, controlled-viewport overflow, hosted authorization behavior, operational weight validation and general quantum value. J5's pitch reservations remain stronger than the design juror's overall enthusiasm.

## 4. Application and functionality audit

### Actual project state and branch coverage

Primary checkout was clean before new reports. Language/framework: Python/FastAPI/Pydantic, NumPy/SciPy HiGHS, Qiskit/Aer, React/Vite. Entry points: `backend/main.py:create_app`, top-level `main.py`, `frontend/src/main.jsx`; startup scripts `setup.sh`, `dev.sh`. Source spans `backend`, `optimization`, `quantum`, `emergency`, `frontend`, `research`, `experiments`, `tests`, `data`, `supabase`.

The running API `127.0.0.1:8000` and frontend `127.0.0.1:5180` belong to `/private/tmp/bloodflow-mobile-review`, at the same commit. Tracked application source matched the primary copy; seven CSV differences disappeared after newline normalization. Live observations therefore apply to the selected source, with runtime configuration caveats.

Read-only history/diffs covered primary `main`/`origin/main` **50c3b24**, `origin/quantum-optimizer-fix` **0f13187**, `fixing-warm-QAOA` **0d66dce**, `quantum-warm-optimization-fix` **345a42a**, intermediate **ebd8f30/90b593b**, and current/somemore aliases **46693f6**. In `BloodFlow-Q1`, distinct UI/research branches **b59a72b**, **d3ec6d2**, **539a13e** received targeted source/history inspection. Beezsy and warm-push copies were inventoried against equivalent commits. Three non-git snapshots received representative byte comparisons and relevant schema/QAOA diffs; this was not an exhaustive historical runtime audit (J10).

No checkout, fetch, reset, commit or push occurred. The user-supplied GitHub branch URL matched local origin configuration and tracking ref, but the web fetch failed; **the current live remote head was not independently verified**. Historical branches were not executed. Existing user audit/report directories were not overwritten.

### Route and interaction inventory

PASS means the listed expectation was actually checked, not that every control passed. J7 observed all 16 page bodies; deeper interactions remain explicitly partial.

| Route | Expected / actually verified | Status and limit |
|---|---|---|
| `/` | Research home and dock navigation render; bank navigation worked | PASS for observed entry/navigation; fresh onboarding keyboard behavior untested |
| `/dashboard` | Scenario totals and latest result | PASS: 71 stock, 38 demand, API-connected display; existing result only |
| `/blood-banks` | Bank stocks and group labels | PASS: 25/23/23; card actions untested |
| `/hospitals` | Demand and urgency catalog | PASS: 13/14/11 demand, 11 high-priority units; catalog is read-only |
| `/network` | Facilities, routes, allocation overlay | PARTIAL: six nodes/nine routes and blocked arc rendered; filter/pan controls not exercised |
| `/optimization` | Run solver, compare and display backend result | PASS for Greedy/comparison/API agreement; F3/F4 explanatory defects; other controls partial |
| `/emergency` | Edit and re-optimize an event | PARTIAL: demand controls/wizard observed; named scenarios executed through demo API, not this form |
| `/demo` | Live/historical separation and comparison | PARTIAL UI: switched historical mode; all three live scenarios executed through API |
| `/donor-network` | Synthetic inbox and optional private profiles | PARTIAL: simulated acceptance worked; private CRUD BLOCKED by configuration |
| `/emergency-requests` | Inventory-first request creation | PARTIAL: synthetic 4 requested/1 stock/3 shortfall/contact flow worked; live path BLOCKED |
| `/coordination` | Carry accepted request through checkpoints | PARTIAL: accepted state/timeline carried through SPA; remaining completion checkpoints not clicked |
| `/results` | Solver/history/research results | PARTIAL: page rendered; initially loading research subsection not rechecked; no loading defect inferred |
| `/reports` | Saved experiments with limitations | PASS for rendered results/provenance; selectors not exercised |
| `/quantum-lab` | Inspect saved quantum records | PARTIAL: controls/bitstrings/missing values rendered; selectors/export not exercised |
| `/flow` | Explain pipeline | PASS for rendered five-stage explanation; every action not tested |
| `/about` | Methodology and limitations | PASS for rendered explanation and disclosures |

The synthetic request journey is real local state, not real outreach. Hard reload loses its browser-page state; SPA navigation retained it. Live authorization, SMS/email, GPS, clinical eligibility, actual collection and dispatch were not demonstrated. These are disclosed limitations, not secretly working integrations.

Observed visual issue: raw status tokens on coordination. Source-only accessibility risks: modal focus containment/Escape/background inertness and route-focus transfer. J7 saw horizontal overflow, but unknown zoom prevents a general responsive verdict. Mobile, screen-reader, measured contrast, keyboard-first onboarding and forced network-error recovery remain NOT TESTED. Native browser-control inconsistencies prevented further tests; they were not attributed to the application.

## 5. Scenario execution and runtime report

### Environment and measurement meaning

Primary live runtime used the existing `BloodFlow-Q1/.venv`: Python **3.14.7**, FastAPI **0.146.0**, Qiskit **2.6.0**, Aer **0.17.2**, SciPy **1.18.1**, NumPy **2.5.4**, Pydantic **2.14.1**, macOS **27.0.1 arm64**. Some QA/OR tests used the existing main-2 environment with Qiskit **2.5.2** and FastAPI **0.143.1**. Versions are not silently combined into one reproducibility claim.

No dependency installation was performed. Default Python lacked some dependencies; the primary `.venv/bin/python` path was absent. Reusing sibling environments resolved most execution blockers but **does not verify a clean setup**. Node tests used Node **26.10.0**.

### Fresh named demo executions

One bank, one hospital, one O group, one route. Normal demand 4, stock 12; spike demand 16; disruption blocks the route. Default objective weights `(10,5,1,0.1,0)`. QAOA: standard X, p=1, 128 shots, COBYLA max_iterations=15, seed=7, one restart, normalized cost, both penalties 10,000. One request per cell; no statistical inference.

**Every cell below returned HTTP 200 and a feasible allocation.** Times are measured HTTP end-to-end seconds. Emergency requests include before-and-after work.

| Scenario | Greedy | MILP | Exact | QAOA | Objective, all methods | Unmet, all methods |
|---|---:|---:|---:|---:|---:|---:|
| Normal | .01219 | .00493 | .00205 | .18004 | 25.2 | 0 |
| Demand spike | .00267 | .00389 | .00276 | .32199 | 215.6 | 4 |
| Route disruption | .00252 | .00411 | .00259 | .19213 | 140.0 | 4 |

QAOA after-case sizes were **10/13/7 qubits**; raw feasible-shot rates **31.25%/11.71875%/52.34375%**. A best feasible sample can coexist with many infeasible shots. Bounded optimizer termination is not convergence certification.

Normal QAOA solver wall time was **.17699 s**, including optimization **.08115**, compilation **.07460**, and final sampling **.00588**. Statevector and circuit-construction times overlap optimization; **do not sum inclusive fields**. Spike/disruption after-only solver times were **.20506/.08107 s**, excluding their before solve and other HTTP work. No time here is physical quantum-device time. Full inputs, outputs and timing fields: `chair-demo-runtime.json`, `chair-demo-summary.json`, `chair-runtime-environment.json`.

J13 also freshly executed four variants on a 3-qubit stock=demand=1 fixture, p=1, 128 shots, 15 iterations, seed 7. All found objective **1.1**. Feasible-shot rates: standard **85.16%**, warm **92.97%**, XY **49.22%**, warm XY **55.47%**; solver wall times **.08953/.07131/.06851/.07020 s**. All were bounded, nonconvergence-marked runs. These demonstrate execution, not repeatable superiority.

### Tests and adversarial cases

| Check | Actual outcome | Status |
|---|---|---|
| `pytest tests -q -p no:cacheprovider` | 194 passed, 21 subtests, 3.86 s | PASS |
| Root `pytest -q -p no:cacheprovider` | Archive/current module-name collision; exit 2, 1.30 s | FAIL |
| Frontend `npm test` | 53 passed; runner .531 s | PASS; not browser E2E |
| Research unittest modules | 21 passed, .396 s | PASS |
| Independent OR enumeration | 100 random 2×2 one-group cases, seed 12025; no MILP/exact/LP mismatches | PASS |
| Greedy marginal-cost case | Cost100 versus shortage1: Greedy100, exact/MILP1 | PASS reproduction of acknowledged weak heuristic |
| Critical shortage case | Cost100/time120/default weights: MILP15/unmet1, Greedy112/unmet0 | PASS reproduction of policy tradeoff |

Focused suites reported by other jurors overlap the main suite; **their counts must not be added as unique tests**.

QA fixture: bank b stock O=2; hospital h demand O=1, high priority 2; available route cost1, time5, distance2; O→O; default Greedy unless stated. Times below are single in-process HTTP request wall seconds.

| ID | Input / expectation | Actual | Status | Seconds |
|---|---|---|---|---:|
| QA01 | Valid fixture | 200, objective1.5, unmet0 | PASS | .03019 |
| QA02 | Demand0 | 200, objective0 | PASS | .00191 |
| QA03 | Inventory0 | 200 feasible shortage1, objective25 | PASS | .00145 |
| QA04 | Inventory−1; reject | 422 | PASS | .00125 |
| QA05 | Inventory true; reject | 200, treated as one unit | FAIL | .00179 |
| QA06 | Inventory1.5; reject | 422 | PASS | .00115 |
| QA07 | Duplicate bank | 422 | PASS | .00139 |
| QA08 | Conflicting duplicate compatibility | 422 | PASS | .00160 |
| QA09 | Blocked route | 200 feasible, shipment0/unmet1 | PASS | .00164 |
| QA10 | QAOA shots0 | 422 | PASS | .00135 |
| QA11 | Wrong initial-parameter length | 422 | PASS | .00140 |
| QA12 | Empty benchmark scenario list | 200, empty results | PASS | .00194 |
| QA13 | Zero stock/demand, Greedy | 200, objective0 | PASS | .02681 |
| QA14 | Same, Exact | 200, objective0 | PASS | .00214 |
| QA15 | Same, MILP | 200, objective0 | PASS | .00316 |
| QA16 | Same QAOA, omitted required penalties | 422 | PASS | .00171 |
| QA17 | Same QAOA, valid penalties/p1/shots16/iterations4/seed7 | 502 zero-variable Ising error | FAIL | .02632 |

Reproduction details and the complete tiny payload recipe are in J8; J9 independently reproduced the coercion and zero-QAOA failures. No large denial-of-service load was attempted.

### Historical experiment inventory

PASS in this table means **artifact arithmetic/provenance checked**, not a new experiment execution.

| Experiment | Verified extent | Status |
|---|---|---|
| Original five-case/15-run benchmark | Means96.42/95.64/107.38; QAOA three matches; mean gap47.2889%, median0 | PASS arithmetic; README count FAIL |
| Paired warm comparison | Six compact cases, seeds301–310, p1/shots64/iterations8; full outcome recomputation not completed here | PARTIAL |
| Original primary research study | 992 records, 112 training/880 held-out; 11 methods×8 cases×10 seeds; all11 means recomputed; no duplicate keys | PASS artifact checks; fresh full rerun NOT TESTED |
| Primary study inference | Reduced−standard optimal-feasible probability .2597565; Holm p=.0234375 within the stated family | PASS recomputation; narrow eight-case inference |
| Later primary-study rerun | 992 completed records; XY boundary coverage/parity metadata checked | PARTIAL; not freshly rerun |
| Necessity replacement study | 240 runs/960 rounds; classical replacement ties quantum quality in compared wrappers; saved quantum times higher | PASS recomputation; not general speed claim |
| Necessity scaling | 16 cases/32 solver calls; original eight optimal, max16.268 ms; hypothetical fixed-dispatch seven/eight proven, one2.0179 s unproved | PARTIAL saved scaling checks |
| Production-v2 matrix | 1410 records:1377 completed/33 skipped; six historical MILP boundary infeasibilities retained | PARTIAL; historical only |
| Corrected boundaries | 81 records:66 completed/15 skipped, no false feasibility; current tiny classical zeros also pass | PASS saved-status check; not a full matrix rerun |
| Supplementary studies | 240 Grover, 27 Aer gate-noise, 38 scaling records including two quantum skips counted | PARTIAL; noisy experiments not independently rerun |
| Hosted private auth/RLS | Configuration absent in observed UI; no credentials/integration exercised | BLOCKED for live workflow |
| Clean installation, load, mobile/screen-reader, hardware, operational outcomes | Not executed | NOT TESTED |

The 2.0179-second unproved solve belongs to an explicitly hypothetical extension; it is **not evidence that the current production formulation failed optimality**. Both the original16.268 ms artifact and J7's .0262-second comparison disprove an unconditional “<15 ms” promise.

## 6. Quantum credibility assessment

**Formulation — verified on bounded checks.** Shipment, unmet and inventory-slack quantities use bounded binary encodings. Inventory/demand equalities become penalties; blocked/incompatible shipment variables are excluded. Independent energy/Ising and small exact checks support correctness. They do not prove every possible input or a scalable advantage (`quantum/qubo.py:build_qubo`, `ising.py`, J12/J13).

**QAOA execution — verified.** Production builds RZ/RZZ cost phases and X, warm or paired RXX/RYY mixers. Classical optimization uses ideal statevector expectations; final samples come from local Aer. Four variants and named API scenarios executed. There is no physical-hardware result in this audit. Separate saved noisy-simulator research exists and must not be erased by describing the production path as noiseless.

**Warm start — verified implementation; benefit limited in scope.** LP-derived quantity information becomes binary marginals; validated Greedy/uniform fallbacks are reported. Probabilities receive affine shrinkage, then numerical clipping. This is not automatically the exact literature construction or a guarantee-bearing rounding scheme. Saved primary-study mean optimal-feasible probability is about **.68355 warm versus .06964 standard**, independently recomputed (J11). That is a repeat-seed result on eight small synthetic cases, **not evidence of improvement over the classical LP solution or end-to-end advantage**.

**XY — correct excitation exchange, not a feasible-allocation mixer.** Hamming-weight conservation does not preserve weighted register values, stock and demand equations. A fresh tiny basis-state test leaked **.657794 probability** outside allocation feasibility. Do not advertise general constraint preservation. An additional boundary defect makes research XY fall back to X when the exchange graph is empty, while production applies identity. One-qubit probabilities differed **[.77821339,.22178661] versus [.5,.5]**. All15 generator graphs and both checked primary-study XY subsets were nonempty, so those studies are not invalidated by this defect (J13 final).

**Classical references — strong and central.** The original matrix is a capacitated bipartite allocation/flow structure with an integral optimal LP vertex for integer bounds. It is not made computationally hard merely by a large binary encoding. MILP/exact matched independent enumeration; LP also matched. Greedy is a fulfillment-first heuristic and can be objectively poor. Claims must compare equal instances, weights and feasibility, not different workloads or best-shot energy alone.

**Actual contribution:** a substantive implementation and controlled exploration of representation, initialization and sampling behavior. The project has not established useful quantum speed, quality, feasibility or operational advantage against its strong classical alternatives. Its negative replacement evidence is scientifically valuable. Better sampling than unseeded QAOA is a narrower achievement that deserves accurate credit.

**Remove/qualify:** universal quantum/classical difficulty assertions; allocation-feasible XY language; automatic warm-start guarantees; hardware implications; universal simulator parity; “quantum is better” inferred from one minimum sample. Preserve measured seeds, distributions, preprocessing cost, failure denominators and the explicit no-advantage conclusion.

## 7. Scientific literature recommendations

Ranked by practical relevance. These are research directions, not claims that new algorithms were implemented during judging.

1. **Egger, Marecek and Woerner, _Warm-starting quantum optimization_, Quantum5,479 (2021), arXiv:2009.10095, DOI10.22331/q-2021-06-17-479.** Connects classical relaxations and quantum initialization; its guarantees depend on the construction. Compare the actual affine binary-marginal preparation against direct LP/Greedy decisions and existing seed-retention/zero-angle controls, charging all preprocessing. A warm-versus-uniform win is insufficient. [Primary paper](https://arxiv.org/abs/2009.10095).

2. **Hadfield, Wang, O'Gorman, Rieffel, Venturelli and Biswas, _From the Quantum Approximate Optimization Algorithm to a Quantum Alternating Operator Ansatz_, Algorithms12(2),34 (2019), arXiv:1709.03489, DOI10.3390/a12020034.** Provides constrained-ansatz design principles; feasibility and reachability must be proved for the encoding. A useful next tiny experiment is an explicitly feasible transition graph with layer-by-layer leakage and connectivity tests, counting added qubits/gates. [Primary paper](https://arxiv.org/abs/1709.03489).

3. **Rønnow et al., _Defining and detecting quantum speedup_, Science345,420–424 (2014), arXiv:1401.2910, DOI10.1126/science.1252319.** Distinguishes speedup claims and benchmark pitfalls; its device-specific findings are not a theorem against QAOA. Predeclare time-to-target workloads and compare full preparation/training/sampling/decoding cost with LP/MILP and matched search. [Primary paper](https://arxiv.org/abs/1401.2910).

4. **Bärtschi and Eidenbenz, _Grover Mixers for QAOA: Shifting Complexity from Mixer Design to State Preparation_, IEEEQCE2020,72–82, arXiv:2006.00354, DOI10.1109/QCE49297.2020.00020.** Feasible-uniform preparation is a substantive assumption. Audit the existing enumerated feasible-state experiments against classical feasible sampling and report explicit preparation/inverse/synthesis costs; an exhaustive table is not an efficient scalable oracle. [Primary paper](https://arxiv.org/abs/2006.00354).

5. **Huangfu and Hall, _Parallelizing the dual revised simplex method_, Mathematical Programming Computation10,119–142 (2018), arXiv:1503.01889, DOI10.1007/s12532-017-0130-5.** Supports taking sparse LP seriously as an algorithm, not merely a seed. Establish the application's own flow-integrality argument and extend sparse LP/MILP scaling; this paper itself does not prove BloodFlow-Q's integrality or universal MILP latency. [Author-institution record](https://www.research.ed.ac.uk/en/publications/parallelizing-the-dual-revised-simplex-method/).

6. **Wang, Fontana, Cerezo, Sharma, Sone, Cincio and Coles, _Noise-Induced Barren Plateaus in Variational Quantum Algorithms_, Nature Communications12,6961 (2021), arXiv:2007.14384, DOI10.1038/s41467-021-27045-6.** Gives noise/depth-dependent trainability results under specific models, not a blanket impossibility claim. Extend the existing noisy checks to finite-shot noisy training; separate readout effects from gate noise and report total shots and feasible-success distributions. [Publisher](https://www.nature.com/articles/s41467-021-27045-6).

7. **Farhi, Goldstone and Gutmann, _A Quantum Approximate Optimization Algorithm_, arXiv:1411.4028 (2014).** Foundational QAOA proposal; problem-specific guarantees do not transfer automatically to this penalized QUBO. Preserve energy/phase verification and compare depth with matched evaluation/shot budgets, rather than assuming higher depth improves a bounded optimizer. [Primary paper](https://arxiv.org/abs/1411.4028).

J14's separate ballot records fuller authorship, assumptions and findings. No paper here establishes advantage for BloodFlow-Q.

## 8. Critical defects and judging risks

**No P0 established.** No observed incorrect classical optimum, concealed quantum replacement, real clinical deployment failure or private-data breach justifies that severity.

| ID / priority | Evidence and impact | Reproduction/verification | Proposed resolution |
|---|---|---|---|
| F1 P1 | Coercive API turns true into stock; violates intended quantity contract | QA05; `schemas.py:25`, domain bool rejection | Strict API quantities and complete HTTP-boundary regression |
| F2 P1 | Default test command fails before execution | Root pytest exit2; archived `audit/warm_qaoa_before/tests` module collisions | Explicit current test discovery, preserving archives |
| F3 P1 | Contradictory result count; unsupported Rh/deadline/<15ms/complexity claims | README13,23,81,92; Optimization587–597; raw five-case results | Correct three matches, actual model scope and measured timings; derive size labels and describe Exact correctly |
| F4 P1 | Feasible/lower-cost can be mistaken for better service | Default230.6/unmet2 vs202.7/unmet27; critical case15 vs112 | Display shortage policy, marginal tradeoffs, per-facility outcomes and configuration alongside recommendation |
| F5 P2 | Valid trivial QAOA request misclassified as502 | QA17; `ising.py:84–86` | Explicit constant-instance handling with truthful “no quantum execution” provenance |
| F6 P2 | Research/production empty-graph XY parity false | J13 one-qubit reproduction | Match identity semantics and add boundary parity check; retain checked-study scope |
| F7 P1 for public robustness | Dense construction precedes qubit cap; no total job budget | services539–543, qubo434, milp169; source risk, no exhaustion attempted | Early input/batch limits, sparse matrices, deadline-limited jobs and bounded concurrency |
| F8 P1 before private pilot | Accepted relation can retain full donor-profile access after closure | SQL274–291,616–627,863–865,956–959; source-proven, hosted untested | Active-request/expiry checks, minimum-field access, live authorization matrix before real profiles |
| F9 P2 | Source-traced stale mutation race and focus omissions | App120–124,141–143,201; no browser reproduction | Request-generation cancellation; tested dialog/focus behavior; reproduce with delayed responses/keyboard |
| F10 P2/P3 | Ambiguous cost units, demand bars called allocation, raw statuses | J2/J6 observed/source evidence | Synthetic-cost labels, accurate demand labels, human-readable status mapping |

Shared result history is intentional process-local synthetic-demo behavior, but it needs explicit labeling and isolation before private multi-user use. It is not evidence of an observed private-data leak. Unknown-zoom overflow is an unresolved responsive check, not a verified universal defect.

## 9. Prioritized improvement roadmap

Effort labels are qualitative; no invented numerical score gains are assigned.

| Tier / action | Expected impact | Effort | Dependencies | Completion evidence |
|---|---|---|---|---|
| **A: strict quantities, trivial QAOA and test discovery** | Remove reproducible judging failures | Small | Existing schemas/solver boundaries | QA05/QA17 return intended semantics; root suite collects current tests |
| **A: correct pitch, counts and complexity labels** | Restore scientific credibility | Small | Raw artifacts and source model | Three-match summary; no false Rh/deadline/latency guarantees; dynamic six-facility explanation |
| **A: explain objective-policy tradeoffs** | Prevent misleading result interpretation | Medium | Agreed synthetic policy | Users explain27-vs2 unmet result; every result retains weights and shortage decomposition |
| **A: fix empty-graph parity** | Make admitted-boundary research claims accurate | Small | Current circuit/reference code | One-qubit probability agreement and provenance regression |
| **A: keep private path disabled until lifecycle fix** | Address concrete optional-path privacy gap | Medium | SQL/auth test environment | Closed/cancelled/expired/consent-revoked request access tests; minimum fields only |
| **B: one coherent small multi-facility demonstration** | Highest practical improvement in utility and differentiation | Medium | Valid fixture within simulator cap; clear weights | End-to-end scenario→shock→validated plan→LP/MILP/QAOA comparison with failures visible |
| **B: guided synthetic scenario entry and plan export** | Improve self-service research use | Medium | Existing emergency edits/API schema | New full scenario entered without code; reviewable export includes provenance, units and reasons |
| **B: one authoritative versioned evidence manifest** | Make existing rigor easy to defend | Small–medium | Existing raw protocols and reports | Exact commands, dependency lock, source hashes, denominators and timing boundaries reproduce key tables |
| **C: strengthen seed-only and matched-classical attribution** | Clarify what quantum adds, including negative outcomes | Medium | Existing ablation/retention controls | Held-out comparisons to direct LP, seed sampling and matched-budget search with total costs |
| **C: test feasible mixers only where justified** | Research differentiation with a clear mathematical question | Large | Proven invariant/reachability and efficient preparation | Leakage/connectivity tests, compiled overhead and feasible-uniform classical controls |
| **C: finite-shot/noisy training study** | More realistic scientific evidence | Medium–large | Existing supplementary noise work | Separate gate/readout noise, shot budgets, variability and failure distributions |
| **D: bounded jobs, sparse constraints, isolated history** | Public-demo reliability and scaling | Medium–large | Resource policy and storage ownership | Early rejections, cancellations, bounded concurrency and restart/worker behavior tested |
| **D: operator-led domain expansion** | Potential operational relevance | Large | Actual workflow research and authorized data governance | Validated need for expiry/capacity/deadlines; independently checked model and outcomes |

Do not add artificial complexity merely to manufacture a quantum use case. If the relevant workflow remains an efficiently solvable flow problem, that is a useful result and should guide the product.

## 10. Mock final jury Q&A

1. **What actually works today?** The local synthetic API/dashboard, classical runs/comparison, three named demo scenarios, four tiny QAOA variants, and the request-to-donor-acceptance coordination segment were exercised. Remaining live private operations, full checkpoint completion and many secondary controls were not verified.

2. **Does “feasible” mean all hospitals receive enough blood?** No. Unmet demand is explicitly allowed. Feasible means the modeled inventory, eligibility and accounting constraints hold. It is not a clinical or dispatch approval.

3. **Why does MILP leave more unmet demand than Greedy?** The configured weighted sum prices shortages against per-unit transport cost/time. On the default case MILP scores202.7 with27 unmet, versus Greedy230.6 with2. The code supports that optimum; the weights are synthetic policy assumptions, not validated clinical priorities.

4. **Why use quantum if LP already solves the model?** The current defensible purpose is comparative research and education. The original flow-like model has an integral optimal LP vertex. No operational necessity for quantum processing has been established.

5. **Is this real QAOA or a classical allocator under a quantum label?** Real circuits and local simulation execute. Optimization uses ideal statevectors; final measurements use Aer. That is genuine algorithm simulation, not physical quantum hardware.

6. **Does warm-start improve anything?** Saved small-study optimal-feasible probability is higher than standard QAOA, and the arithmetic was recomputed. That does not show improvement over the LP seed itself or a classical end-to-end baseline. Direct-seed and matched-budget attribution remain essential.

7. **Does XY guarantee valid allocations?** No. It conserves excitation count, not the weighted allocation constraints. A tiny verified case leaks feasibility. The UI's honest Hamming-weight explanation should be retained.

8. **Are the comparisons reproducible?** Many saved inputs, seeds, records and analyses are available, and key arithmetic/tests were independently checked. Full studies were not all rerun; dependency versions differ, some historical source hashes changed, and timing includes version-specific amortization.

9. **How fast does it scale?** Small classical cases are fast. Fresh normal demo HTTP times were about.002–.012s classical and.180s QAOA; these are single local measurements. There is a16-qubit production simulation guard, dense preprocessing and no demonstrated public-load capacity. No universal15ms guarantee is defensible.

10. **Is the dataset real and clinically complete?** No. It is synthetic. Core compatibility is simplified ABO-only; expiry, route capacity and hard arrival deadlines are absent. The optional donor module is a separate workflow, not a clinical compatibility engine.

11. **Can you deploy it with real donor or hospital data?** This audit does not support that claim. Hosted authorization was not exercised, private integrations were unconfigured, and an access-expiry gap exists in source. Keep the demo synthetic while those lifecycle and operational requirements are resolved.

12. **Why should this win rather than an ordinary optimization dashboard?** It has actual circuit methods, independently checkable classical references, visible feasibility and unusually honest research controls. Those distinguish it technically. Winning-level incremental user value or quantum contribution is still missing; the best next evidence is a coherent contested-scenario demonstration and a prespecified comparison that could falsify the claimed benefit.

## 11. Final competition recommendation

**70/100 — credible contender, substantial research prototype; not presently a winning entry.** Submit as a synthetic optimization research project after the small correctness/claim fixes. If the deadline is immediate, disclose them and do not pitch it as an operationally validated quantum blood-allocation service.

**Five priorities:**

1. Fix API boolean coercion, trivial QAOA handling and default test discovery.
2. Correct the result count, model-scope claims and hard-coded complexity explanation.
3. Explain and demonstrate the shortage-versus-cost policy on a contested multi-facility case.
4. Package the existing exact-baseline, seed-control and negative-result evidence into one reproducible demo/manifest.
5. Close donor access lifecycle gaps before real private data; bound public computation before broader exposure.

**Strongest live feature:** a route disruption or demand spike followed by a validated before/after allocation and exact classical comparison, with QAOA feasibility and provenance visible.

**Weakest claim to avoid:** “quantum is needed or better because the allocation encoding has222 bits and an enormous search space.”

**Most important missing evidence:** a prespecified, repeatable, end-to-end improvement in a clearly defined user outcome or optimization target over the strong classical reference on representative held-out multi-facility cases.

All16 distinct accepted initial and final votes exist; no simulated voters were used. Application source, tests, configurations, datasets and experiment results were left unchanged. Runtime and artifact checks retain their actual statuses; unresolved disputes are visible. Final arithmetic and the following JSON were programmatically validated.

## 12. Machine-readable scorecard

```json
{
  "project": "BloodFlow-Q",
  "commit": "46693f6519bdd385b67b3b69b2c4a450a058d67a",
  "branch": "evenmore-fix-and-heartbeat-additon",
  "date": "2026-10-25",
  "final_weighted_score": 70,
  "rubric": [
    {
      "category": "Problem definition and potential impact",
      "maximum": 7,
      "points": 6
    },
    {
      "category": "End-user utility and workflow",
      "maximum": 8,
      "points": 5
    },
    {
      "category": "Domain and constraint fidelity",
      "maximum": 8,
      "points": 5
    },
    {
      "category": "UI/UX, accessibility, and demo experience",
      "maximum": 6,
      "points": 4
    },
    {
      "category": "Software architecture and code quality",
      "maximum": 6,
      "points": 5
    },
    {
      "category": "Testing and reliability",
      "maximum": 9,
      "points": 7
    },
    {
      "category": "Data quality and statistical validity",
      "maximum": 8,
      "points": 6
    },
    {
      "category": "Classical optimization correctness and baselines",
      "maximum": 10,
      "points": 9
    },
    {
      "category": "Quantum algorithm correctness",
      "maximum": 10,
      "points": 8
    },
    {
      "category": "Quantum contribution and technical novelty",
      "maximum": 8,
      "points": 3
    },
    {
      "category": "Experimental rigor and reproducibility",
      "maximum": 7,
      "points": 6
    },
    {
      "category": "Performance and scalability",
      "maximum": 4,
      "points": 2
    },
    {
      "category": "Security, privacy, and responsible use",
      "maximum": 4,
      "points": 2
    },
    {
      "category": "Adoption feasibility and product viability",
      "maximum": 3,
      "points": 1
    },
    {
      "category": "Pitch clarity and presentation",
      "maximum": 2,
      "points": 1
    }
  ],
  "panel": {
    "voting_evaluators": 16,
    "independent_voting_subagents": 15,
    "chair": 1,
    "discarded_unscored_context_contaminated_subagents": 3,
    "simulated_voters": 0
  },
  "jurors": [
    {
      "id": 1,
      "role": "Chief Hackathon Judge and Panel Chair",
      "provisional_score": 68,
      "final_score": 70,
      "final_category_points": [
        6,
        5,
        5,
        4,
        5,
        7,
        6,
        9,
        8,
        3,
        6,
        2,
        2,
        1,
        1
      ],
      "verdict": "Credible contender; substantial research prototype, not a winner"
    },
    {
      "id": 2,
      "role": "Consumer and End-User Advocate",
      "provisional_score": 60.0,
      "final_score": 61.0,
      "final_category_points": [
        5.0,
        6,
        5.0,
        4.0,
        4.0,
        6.0,
        5.0,
        7.0,
        6.0,
        3.0,
        4.0,
        2.0,
        2.0,
        1.0,
        1.0
      ],
      "verdict": "Supervised synthetic evaluation; not a self-service coordinator product"
    },
    {
      "id": 3,
      "role": "Blood-Supply Operations Domain Specialist",
      "provisional_score": 69.0,
      "final_score": 69.0,
      "final_category_points": [
        6.0,
        5.0,
        5.0,
        4.0,
        5.0,
        7.0,
        5.0,
        9.0,
        7.0,
        4.0,
        4.0,
        3.0,
        3.0,
        1.0,
        1.0
      ],
      "verdict": "Credible educational optimization prototype"
    },
    {
      "id": 4,
      "role": "Social Impact, Ethics, and Responsible Use",
      "provisional_score": 70.0,
      "final_score": 69.0,
      "final_category_points": [
        6.0,
        6.0,
        5.0,
        5.0,
        5.0,
        7.0,
        6.0,
        8.0,
        7.0,
        3.0,
        5.0,
        2.0,
        2,
        1.0,
        1.0
      ],
      "verdict": "Advance as research; privacy lifecycle and equity work needed"
    },
    {
      "id": 5,
      "role": "Product Strategy, Adoption, and Pitch",
      "provisional_score": 65.0,
      "final_score": 65.0,
      "final_category_points": [
        6.0,
        5.0,
        5.0,
        4.0,
        5.0,
        6.0,
        5.0,
        8.0,
        7.0,
        3.0,
        4.0,
        2.0,
        3.0,
        1.0,
        1.0
      ],
      "verdict": "Research/education demonstrator; operational adoption unproved"
    },
    {
      "id": 6,
      "role": "UI/UX and Accessibility Specialist",
      "provisional_score": 73.0,
      "final_score": 73.0,
      "final_category_points": [
        6.0,
        6.0,
        6.0,
        4.0,
        5.0,
        6.0,
        6.0,
        8.0,
        8.0,
        4.0,
        5.0,
        3.0,
        3.0,
        2.0,
        1.0
      ],
      "verdict": "Conditional advancement with accessibility limitations"
    },
    {
      "id": 7,
      "role": "Frontend and Live-Demo Examiner",
      "provisional_score": 66.0,
      "final_score": 65.0,
      "final_category_points": [
        6.0,
        5.0,
        5.0,
        4.0,
        5.0,
        5.0,
        5.0,
        8.0,
        7.0,
        2.0,
        6.0,
        3.0,
        2.0,
        1.0,
        1
      ],
      "verdict": "Candid research demonstrator; pitch needs correction"
    },
    {
      "id": 8,
      "role": "Adversarial QA and Test Engineer",
      "provisional_score": 69,
      "final_score": 69,
      "final_category_points": [
        6,
        5,
        5,
        4,
        5,
        7,
        5,
        8,
        7,
        4,
        5,
        2,
        3,
        2,
        1
      ],
      "verdict": "Credible prototype/contender"
    },
    {
      "id": 9,
      "role": "Reliability and Edge-Case Investigator",
      "provisional_score": 68.0,
      "final_score": 67.0,
      "final_category_points": [
        6.0,
        6.0,
        6.0,
        4.0,
        4.0,
        7.0,
        5.0,
        8.0,
        7,
        4.0,
        4.0,
        2.0,
        2.0,
        1.0,
        1.0
      ],
      "verdict": "Conditional support; operational reliability incomplete"
    },
    {
      "id": 10,
      "role": "Software Architecture and Code Quality",
      "provisional_score": 65.0,
      "final_score": 65.0,
      "final_category_points": [
        6.0,
        4.0,
        5.0,
        4.0,
        4.0,
        7.0,
        5.0,
        8.0,
        8.0,
        3.0,
        5.0,
        2.0,
        2.0,
        1.0,
        1.0
      ],
      "verdict": "Advance as research/demo engineering"
    },
    {
      "id": 11,
      "role": "Data Quality and Statistical Validity",
      "provisional_score": 68.0,
      "final_score": 68.0,
      "final_category_points": [
        6.0,
        5.0,
        5.0,
        4.0,
        5.0,
        7.0,
        6.0,
        8.0,
        7.0,
        3.0,
        5.0,
        3.0,
        2.0,
        1.0,
        1.0
      ],
      "verdict": "Credible synthetic research demonstrator"
    },
    {
      "id": 12,
      "role": "Classical Optimization and Operations Research",
      "provisional_score": 67,
      "final_score": 67,
      "final_category_points": [
        6,
        5,
        5,
        3,
        5,
        7,
        4,
        9,
        7,
        3,
        4,
        3,
        3,
        2,
        1
      ],
      "verdict": "Strong classical prototype; quantum value unproved"
    },
    {
      "id": 13,
      "role": "Quantum Algorithm and QAOA Specialist",
      "provisional_score": 70,
      "final_score": 70,
      "final_category_points": [
        6,
        5,
        5,
        4,
        5,
        7,
        5,
        8,
        8,
        4,
        5,
        2,
        3,
        2,
        1
      ],
      "verdict": "Technically substantial contender; advantage unproved"
    },
    {
      "id": 14,
      "role": "Quantum Research and Literature Reviewer",
      "provisional_score": 66.0,
      "final_score": 66.0,
      "final_category_points": [
        6.0,
        5.0,
        5.0,
        4.0,
        5.0,
        7.0,
        5.0,
        8.0,
        8.0,
        3.0,
        4.0,
        2.0,
        2.0,
        1.0,
        1.0
      ],
      "verdict": "Educational/research demonstration; no advantage claim"
    },
    {
      "id": 15,
      "role": "Experimental Design and Reproducibility",
      "provisional_score": 70.0,
      "final_score": 70.0,
      "final_category_points": [
        6.0,
        5.0,
        5.0,
        4.0,
        5.0,
        7.0,
        6.0,
        9.0,
        8.0,
        3.0,
        6.0,
        2.0,
        2.0,
        1.0,
        1.0
      ],
      "verdict": "Well-instrumented research prototype; necessity unproved"
    },
    {
      "id": 16,
      "role": "Performance, Scalability, Security, and Deployment",
      "provisional_score": 69.0,
      "final_score": 69.0,
      "final_category_points": [
        5.5,
        6.0,
        6.0,
        4.0,
        4.5,
        7.0,
        5.5,
        8.0,
        7.0,
        4.0,
        4.5,
        2.0,
        2.0,
        1.5,
        1.5
      ],
      "verdict": "Credible demo; public deployment engineering incomplete"
    }
  ],
  "statistics": {
    "corrected_provisional_mean": 67.6875,
    "corrected_provisional_median": 68,
    "final_mean": 67.6875,
    "final_median": 68.5,
    "final_range": [
      61,
      73
    ]
  },
  "arithmetic_correction": "Juror 3 submitted headline74 but category sum69; independently confirmed69 before deliberation. Original retained.",
  "critical_findings": [
    {
      "id": "F1",
      "priority": "P1",
      "finding": "API accepts boolean inventory as one unit",
      "evidence": [
        "backend/schemas.py:25",
        "optimization/models.py:_require_nonnegative_integer",
        "juror08-initial.md:QA05",
        "juror09-final.md"
      ]
    },
    {
      "id": "F2",
      "priority": "P1",
      "finding": "Default root pytest fails archive/current module collection",
      "evidence": [
        "pytest.ini",
        "juror08-initial.md:root pytest exit 2"
      ]
    },
    {
      "id": "F3",
      "priority": "P1",
      "finding": "Pitch and comparison explanation overstate constraints and complexity",
      "evidence": [
        "README.md:13,23,81,92",
        "frontend/src/pages/Optimization.jsx:587-597",
        "juror12-final.md"
      ]
    },
    {
      "id": "F4",
      "priority": "P1",
      "finding": "Feasible minimum-cost output needs explicit shortage-policy interpretation",
      "evidence": [
        "chair-api-observations.json",
        "juror03-initial.md:critical-shortage reproduction",
        "juror12-final.md"
      ]
    },
    {
      "id": "F5",
      "priority": "P2",
      "finding": "Valid zero-variable QAOA returns 502",
      "evidence": [
        "quantum/ising.py:84-86",
        "juror08-initial.md:QA17",
        "juror09-final.md"
      ]
    },
    {
      "id": "F6",
      "priority": "P2",
      "finding": "Research empty-graph XY differs from production; checked main studies unaffected",
      "evidence": [
        "research/quantum_experiments/algorithms.py:72-73",
        "quantum/qaoa_solver.py:342-345",
        "juror13-final.md"
      ]
    },
    {
      "id": "F7",
      "priority": "P1",
      "finding": "No early size/batch admission or end-to-end compute deadline; source-supported risk",
      "evidence": [
        "backend/services.py:539-543",
        "quantum/qubo.py:434",
        "optimization/milp.py:169",
        "juror16-final.md"
      ]
    },
    {
      "id": "F8",
      "priority": "P1 before private pilot",
      "finding": "Optional donor full-profile access may survive request closure",
      "evidence": [
        "supabase/migrations/202610130001_donor_emergency_network.sql:274-291,616-627,863-865,956-959",
        "juror04-final.md"
      ]
    },
    {
      "id": "F9",
      "priority": "P2",
      "finding": "Mutation response race and keyboard focus concerns are source-supported, not runtime-proven",
      "evidence": [
        "frontend/src/App.jsx:120-124,141-143,201",
        "juror09-final.md",
        "juror06-final.md"
      ]
    }
  ],
  "scenario_statuses": {
    "live_demo": {
      "normal": {
        "greedy": "PASS",
        "milp": "PASS",
        "exact": "PASS",
        "qaoa": "PASS"
      },
      "emergency_demand_spike": {
        "greedy": "PASS",
        "milp": "PASS",
        "exact": "PASS",
        "qaoa": "PASS"
      },
      "transport_disruption": {
        "greedy": "PASS",
        "milp": "PASS",
        "exact": "PASS",
        "qaoa": "PASS"
      }
    },
    "qa": {
      "QA01": "PASS",
      "QA02": "PASS",
      "QA03": "PASS",
      "QA04": "PASS",
      "QA05": "FAIL",
      "QA06": "PASS",
      "QA07": "PASS",
      "QA08": "PASS",
      "QA09": "PASS",
      "QA10": "PASS",
      "QA11": "PASS",
      "QA12": "PASS",
      "QA13": "PASS",
      "QA14": "PASS",
      "QA15": "PASS",
      "QA16": "PASS",
      "QA17": "FAIL"
    },
    "python_scoped_suite": "PASS",
    "frontend_node_suite": "PASS",
    "root_pytest_collection": "FAIL",
    "research_unit_suite": "PASS",
    "historical_study_arithmetic": "PASS",
    "full_historical_study_fresh_rerun": "NOT TESTED",
    "paired_warm_outcomes_full_recompute": "PARTIAL",
    "historical_gate_noise_records": "PARTIAL",
    "live_private_auth": "BLOCKED",
    "fresh_install": "NOT TESTED",
    "mobile_and_screen_reader": "NOT TESTED",
    "physical_quantum_hardware": "NOT TESTED"
  },
  "final_verdict": "70/100: credible contender and substantial research prototype; not presently a winning submission. Submit with explicit synthetic/simulator scope and correct misleading claims."
}
```
