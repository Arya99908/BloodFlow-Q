# Juror 03 — independent initial vote

Role: blood-supply operations domain specialist. Commit inspected: `46693f6519bdd385b67b3b69b2c4a450a058d67a`. Overall **74/100**. Confidence **medium-high for allocation/domain findings; medium overall**, because this bounded review did not execute the UI, quantum simulation, or private database workflows. No other jury reports or prior audit conclusions were read.

| Category | Score / maximum |
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

## Actual scope

A synthetic, aggregate, single-period allocation benchmark with a React/FastAPI interface, emergency scenario mutation, and a separate donor-coordination extension. The core chooses integer quantities between source-bank/group and destination-hospital/recipient-group nodes. Routes are direct source-destination arcs, not vehicle tours. Inventory is a static cap; demand can remain unmet. Compatibility is supplied Boolean eligibility, bundled as simplified ABO-only red-cell assumptions (`data/compatibility.json:4-7`). Models do not establish clinical eligibility.

The observed hard constraints are inventory, demand accounting, compatible group pair, available route, valid identifiers, and nonnegative integer allocation (`optimization/constraints.py:71-80`). There is no core expiry/batch age, replenishment, reserve-stock requirement, vehicle or route capacity, dispatch schedule, cold-chain model, required-by arrival constraint, uncertainty, or delivery execution. This is reasonable for an explicitly scoped mathematical demonstrator; README:206 acknowledges expiry, capacity, uncertain supply and actual delivery omissions.

## Three strengths

1. **Good conservation and shortage semantics.** Supplied group and recipient group are separate fields (`optimization/models.py`, AllocationDecision), preventing substitution from being counted against the wrong stock. Repeated shipments aggregate before source caps and demand bounds are enforced (`optimization/objective.py:190-215`); explicit served plus unmet equalities are checked by `validate_allocation`. MILP uses those same demand and stock rows (`optimization/milp.py:129-164`). Executed focused tests passed.
2. **Generally honest synthetic and compatibility boundaries.** `Scenario.__post_init__` rejects synthetic != true; `data/compatibility.json:4-7` declares red-cell component and simplified ABO-only scope. Frontend About explicitly says no clinical validity, patient outcomes or quantum advantage (`frontend/src/pages/About.jsx:28`), and Optimization rejects non-synthetic scenarios (`frontend/src/pages/Optimization.jsx:133,196`). Donor matching explicitly does not create inventory or certify donation eligibility (`backend/donor_matching.py:1-6,74-78`), which is a useful separation.
3. **Interpretable classical benchmark and metrics.** The linear MILP objective and inventory/demand constraints are inspectable (`optimization/milp.py:103-164`). Per-unit cost and time multiplication is explicitly documented in `optimization/objective.py`'s calculate_objective notes. Results computes mean transport time by dividing quantity-weighted time by shipped units (`backend/services.py:307`) and displays it as minutes (`frontend/src/pages/Results.jsx:166`); this is coherent as a modeled average, rather than elapsed completion time. Shared validation and explicit unmet demand support meaningful comparisons.

## Three weaknesses

1. **The problem pitch outruns the implemented domain.** README:13 says ABO/Rh, golden-hour transit limits and clinical triage priority are constraints, yet bundled compatibility is ABO-only and the core contains no hard transit deadline. README:17 invokes patient survival and asserts manual dispatch cannot re-optimize in real time without supplied operational evidence. README:206 and the UI disclaimers mitigate, but do not resolve, the contradiction. A useful research prototype should describe its actual relaxed allocation problem prominently, without implying those omitted constraints have been solved.
2. **Priority is a tunable price, not guaranteed emergency service.** Only high/critical rows receive the priority-weighted shortage term (`optimization/objective.py:227-239`); medium and low priority weights have no effect on the exact objective, although greedy sorts every category and weight (`optimization/greedy.py:55,74-85`). There is no mandatory critical coverage or lexicographic shortage minimization. Executed a one-unit critical-demand case with priority 1, inventory 1, available route time 120 minutes, cost 100 and weights (10,5,1,0.1,0): MILP sends zero, shortage 1, objective 15, feasible true; greedy sends one, shortage zero, objective 112, feasible true. Both are mathematically correct. An operator could read “critical” and “feasible” too strongly unless these trade-offs are explicit. This also proves there is no golden-hour cutoff: greedy accepts the 120-minute arc.
3. **Operational and quantum significance remain unproven.** Core structure is a linear capacitated allocation network with permitted substitution arcs, not a modeled vehicle-routing or perishable multi-period scheduling problem. Classical MILP is a strong baseline, but a min-cost-flow baseline would further test whether QUBO is adding representational overhead to an easy structure. README:92 describes five one-bank/one-hospital/one-group scenarios; such instances do not test competition between facilities or groups. README:92 says QAOA matches exact on four cases while README:94 says three—an unresolved internal evidence-summary inconsistency. No field validation or actual inventory/dispatch integration was demonstrated in this review. Adoption and quantum-contribution points are correspondingly limited.

## Execution versus inspection

Executed locally, with bytecode writes disabled and pytest cache provider disabled: `../BloodFlow-Q1/.venv/bin/python -m pytest -q -p no:cacheprovider tests/test_objective.py tests/test_constraints.py tests/test_parameter_sensitivity.py tests/test_milp_solver.py`: **23 passed in 0.70s**. Also executed the fresh one-unit scenario above against MILP and greedy; exact numeric outputs were 15 and 112 with both reported feasible. No installation, network/database mutation, UI interaction, or quantum run. Inspected models, objective, constraints, greedy, MILP objective/matrix, QUBO declarations/evaluation structure, service metrics, selected UI source, bundled compatibility and README. The quantum scores are provisional source-level assessments, not circuit certification. No external clinical facts were required or asserted; compatibility was assessed as the repository's declared assumption.

## Tough question

“Using your default weights, show an available-inventory case in which the optimizer deliberately leaves a critical request unmet. Who chooses and validates that cost-versus-shortage trade-off, and how does the UI prevent a feasible mathematical allocation from being interpreted as an acceptable emergency dispatch plan?”

## Personal verdict

A credible educational optimization prototype with unusually useful validation and scope safeguards. I would support a research demonstration, not an operational deployment claim. The domain omissions themselves are acceptable at this stage; the urgent correction is to align the problem/pitch with the actual constraints, explain priority trade-offs visibly, and demonstrate contested multi-facility/group scenarios before making stronger operational or quantum claims.
