# BloodFlow-Q Technical Specification

**Status:** reference specification; synthetic data, classical solvers, QUBO, Ising conversion, small local QAOA, emergency re-optimization, and API are implemented  
**Data policy:** synthetic data only  
**Intended use:** research and hackathon demonstration of logistics optimization

This document describes what BloodFlow-Q is planned to do and how its parts
will fit together. It does not define clinical rules. Whenever a formula or
modeling term appears, the explanation gives its plain-English meaning, a
mathematical form, and the planned place for it in code. Names below are
illustrative design names, not existing Python functions or files.

## 1. Project purpose

BloodFlow-Q will demonstrate a reproducible software workflow for assigning
synthetic blood-unit inventory at several synthetic banks to synthetic
hospital demand. It will compare a simple classical allocation method, an
exact method on very small examples, and research experiments using QUBO,
Ising, and QAOA simulation where the model size permits.

The project is about logistics at an aggregate scenario level. It will not
recommend treatment for a person, choose a product for an individual, or
connect to real dispatch or hospital systems. A simulated quantum circuit
produces sampled candidate answers; it does not by itself establish that the
answer is useful or that quantum computing is advantageous.

## 2. Problem definition

Given available synthetic inventory, synthetic hospital demand, a documented
compatibility table, urgency labels, and estimated transport measures, choose
how many units to route from each bank and product group to each hospital and
recipient group. The model should respect the inventory at every bank, account
for every unit of demand as served or unmet, and prefer allocations with a
lower documented objective score.

**Plain English:** choose integer shipment quantities while respecting supply
and accounting for demand.  
**Mathematical representation:** the central decision quantity is
`x[b,h,g,r]`, defined in Section 12; the objective and constraints are in
Sections 13–14.  
**Code representation:** the validated `Scenario` and bounded allocation
variable descriptions are defined in `optimization/models.py`. The classical
objective, feasibility validator, greedy baseline, and capped tiny-instance
exact solver are implemented in `optimization/`. The QUBO, Ising, and QAOA
path is implemented for small instances in `quantum/` and checked through the
shared classical validator.

The initial model is a single planning period. It does not model expiry,
production, uncertainty, storage over time, route capacity, or actual delivery
confirmation. Those could only be added later as explicit model extensions.

## 3. Inputs

An input scenario is planned to be JSON or CSV plus documented metadata. It
will contain:

- unique synthetic bank and hospital identifiers;
- a finite list of product-group labels used consistently by the scenario;
- integer unit inventory by bank and product group;
- integer demand by hospital and recipient-group label;
- a synthetic urgency category or documented priority weight per demand row;
- route availability and synthetic transport time and/or cost per bank-hospital
  pair;
- a compatibility mapping between product-group and recipient-group labels;
- objective settings, including transport scales and weights;
- a scenario identifier, version, and a clear `synthetic` label.

**Plain English:** the input describes the small artificial world being
optimized and the assumptions used to score it.  
**Mathematical representation:** quantities, route data, urgency weights, and
compatibility indicators are parameters such as `I`, `D`, `c`, `t`, `p`, and
`a` defined below; they are inputs and are not chosen by the optimizer.  
**Code representation:** the starter JSON examples live in `data/`, and
`backend/data_loader.py` validates their structure and cross-file references.
Optimization-specific validation and schema/data classes may be added later.

Validation will reject missing identifiers, duplicate keys, negative
quantities, non-integer unit counts, unknown group labels, missing required
route/objective fields, invalid weights, and non-synthetic or unlabelled
examples. Exact validation details and units must be fixed before data
implementation.

## 4. Outputs

A successful run is planned to return:

- units assigned by bank, hospital, supplied group, and recipient group;
- unmet units by hospital and recipient group;
- objective value and its component totals (unmet-demand score and transport
  score);
- constraint/feasibility results from independent validation;
- solver method and run configuration;
- for QAOA experiments, measurement counts or probabilities as available,
  decoded candidates, shot count, and simulator/circuit settings;
- benchmark metadata and explicit labels distinguishing measured results from
  expectations or plans.

**Plain English:** a result explains the proposed aggregate allocation and how
it scored, and it identifies whether it passed the model checks.  
**Mathematical representation:** allocations are `x`, unserved demand is `u`,
and score is `F(x,u)` as defined later.  
**Planned code representation:** structured result objects from
`optimization/` and `quantum/`, serialized through `backend/` for display by
`frontend/`.

A returned allocation is only a result for the synthetic model. It is not an
order, dispatch instruction, or patient-care recommendation.

## 5. Blood-bank model

Let `B` be the set of synthetic blood banks. Each bank has an identifier and
inventory by product group. A bank may have an optional synthetic location
label, but coordinates are not required if route times and costs are provided
directly.

**Plain English:** a bank is a source of a limited number of modeled units of
each group.  
**Mathematical representation:** `b ∈ B`; `I[b,g]` is the nonnegative integer
number of available units of group `g` at bank `b`.  
**Planned code representation:** a bank record and an inventory mapping keyed
by group in the scenario schema; inventory totals feed the constraints in
Section 14.

The model assumes inventory is available at the start of the planning period.
It does not simulate new supply or changing stock during the period.

## 6. Hospital model

Let `H` be the set of synthetic hospitals. A hospital has demand rows, each
associated with a recipient-group label and urgency input, plus route data from
each bank.

**Plain English:** a hospital is a destination with aggregate modeled demand;
it is not a record about individual patients.  
**Mathematical representation:** `h ∈ H`; demand is indexed by hospital and
recipient group as `D[h,r]`.  
**Planned code representation:** hospital identifiers and demand rows in the
scenario schema, with no person-level fields.

## 7. Inventory model

Inventory is counted in indivisible whole units. The initial model does not
split a unit, borrow inventory, or allocate more than the listed stock.

**Plain English:** all shipments of a bank's group together must fit within
that bank's available quantity.  
**Mathematical representation:** for each `b,g`,
`sum(h,r) x[b,h,g,r] <= I[b,g]`.  
**Planned code representation:** integer input validation and an inventory
constraint in the model builder; the independent validator recomputes the
left-hand totals from returned allocations.

## 8. Demand model

Demand is a nonnegative integer number of modeled units for each hospital and
recipient-group label in the planning period. It is not patient-level
information. Let `R` be the set of recipient-group labels.

**Plain English:** each demand row must be accounted for either by a compatible
allocation or by an explicit unmet quantity.  
**Mathematical representation:** `D[h,r] ∈ {0,1,2,...}` and
`sum(b,g) x[b,h,g,r] + u[h,r] = D[h,r]`.  
**Planned code representation:** integer demand fields in scenario data and a
demand-balance constraint; the result reports each `u[h,r]` directly.

The initial model does not divide demand into finer time intervals. If a later
version adds periods, inventory and shipment timing constraints will need to
be redesigned and documented.

## 9. Urgency model

Urgency is a synthetic scenario input that sets the relative penalty for
unmet demand. Each row has a category and a positive priority weight `p[h,r]`.
The current objective treats categories `high` and `critical` as critical and uses their priority
weight in the critical-shortage term; all categories are counted in the general
unmet-demand term. This is a modeling convention, not a clinical measure or
triage rule.

**Plain English:** urgency changes how the model ranks unmet-demand rows in
this artificial scenario.  
**Mathematical representation:** the current objective's critical component is
`sum((h,r): category[h,r] == high) p[h,r] * u[h,r]`, where `p[h,r] > 0`; its
general component separately counts `sum(h,r) u[h,r]`.  
**Code representation:** a validated `Urgency` value is attached to each
demand row and both objective components are returned separately. The
priority weight currently affects only the critical component.

Weights and their scale must be shown in scenario details and benchmark
reports. They must never be presented as clinically established priorities.

## 10. Transportation model

For each bank-hospital pair, the scenario may provide a route-available flag,
a synthetic time estimate `t[b,h]`, and a synthetic cost estimate `c[b,h]`.
Unavailable routes cannot be selected. The initial version treats route
measures as per-unit scores for a single planning period; it does not calculate
real routing, road conditions, or delivery guarantees.

**Plain English:** the score can prefer routes with lower entered time or cost,
but those values are only as meaningful as the synthetic assumptions.  
**Mathematical representation:** let `e[b,h] ∈ {0,1}` indicate whether the
synthetic route is available. For a documented mix weight `rho ∈ [0,1]`, define
`q[b,h] = rho*c[b,h]/C_ref + (1-rho)*t[b,h]/T_ref`, with positive reference
scales `C_ref` and `T_ref`; omit an unavailable route by requiring its `x` to
be zero. If only one metric is supplied, the scenario must select and document
that metric instead of silently filling in the other.  
**Planned code representation:** route records and objective configuration
will be validated in the scenario layer; the normalized `q` score and its
components will be reported. `C_ref`, `T_ref`, `rho`, and the overall trade-off
weight must be explicit configuration values.

Normalization makes time and cost comparable in the formula; it does not make
their values accurate or imply a real-world route. If the route score is part
of the objective, its trade-off against unmet demand must be documented and
checked so an arbitrary scale does not accidentally dominate the model.

## 11. Compatibility model

Let `G` be the set of supplied product-group labels and `R` the set of
recipient-group labels. A synthetic, explicit table `a[g,r]` determines
whether the model permits that product group to serve that demand label. The
table is a configurable modeling assumption for logistics experiments. It is
not medical guidance and must not be treated as authoritative compatibility
advice.

**Plain English:** the model only creates allocation choices for group pairs
that the scenario's declared table marks as allowed.  
**Mathematical representation:** `a[g,r] ∈ {0,1}`; when `a[g,r]=0` or
`e[b,h]=0`, require `x[b,h,g,r]=0`. Equivalently, only tuples in
`E = {(b,h,g,r): e[b,h]=1 and a[g,r]=1}` are permitted.  
**Planned code representation:** a compatibility mapping and route filter run
before decision-variable creation. Unknown group pairs are validation errors,
not presumed allowed. The exact table and its source/assumption note must be
reviewed and documented before implementation.

The project will not infer compatibility from a patient's information. The
initial model contains no patient records. The starter file uses an ABO-only
red-cell assumption and prominently documents that it is incomplete; see
`docs/SYNTHETIC_DATA.md` for scope, review requirements, and reference material.

## 12. Decision variables

Decision variables are the unknown quantities the optimizer is allowed to
choose. Only eligible tuples in `E` receive a shipment variable.

**Plain English:** `x[b,h,g,r]` says how many units from bank `b`, supplied
group `g`, are assigned to hospital `h` to count toward demand label `r`;
`u[h,r]` says how many units of that demand row are left unmet.  
**Mathematical representation:**

```text
x[b,h,g,r] ∈ {0,1,2,...}  for (b,h,g,r) ∈ E
u[h,r]       ∈ {0,1,2,...}  for h ∈ H, r ∈ R
```

The upper bounds can be set from available inventory and demand, so the search
space is finite.  
**Planned code representation:** named integer variable records in
`optimization/`, with stable keys so solutions can be decoded into readable
bank/hospital/group rows. Later, QUBO conversion will replace bounded integer
values with binary variables.

## 13. Objective function

The objective is a numerical score that ranks feasible allocations. The
implemented classical evaluator separately scores high-urgency unmet demand,
all unmet demand, transport cost, transport time, and optional named secondary
penalties.

**Plain English:** lower is better under the selected assumptions. The first
term adds a critical premium to rows labeled `high`; the general shortage term
also counts those rows. Transport measures are multiplied by shipped quantity
and weighted separately.  
**Mathematical representation:**

```text
F(x,u) = w_critical * sum(high h,r) p[h,r] * u[h,r]
       + w_unmet * sum(h,r) u[h,r]
       + w_cost * sum(b,h,g,r) c[b,h] * x[b,h,g,r]
       + w_time * sum(b,h,g,r) t[b,h] * x[b,h,g,r]
       + w_secondary * sum(k) secondary[k]
```

Here `p[h,r]` is the synthetic urgency priority weight for high rows; `c` and
`t` are route cost and time, and every `w` is explicitly configured and
non-negative. These units and trade-offs must be documented.  
**Code representation:** `optimization/objective.py` computes and returns each
term separately from scenario parameters, an explicit weight configuration,
and a candidate allocation. It does not select or improve allocations.
The detailed result contract and example are in
`docs/OBJECTIVE_FUNCTION.md`.

The formula is a research-model choice, not a policy. Its weight choices must
be explored with synthetic examples and shown to users. No particular weight
is medically meaningful.

## 14. Constraints

Constraints are rules that every accepted allocation must obey.

### Inventory limit

**Plain English:** shipments cannot exceed a bank's listed stock.  
**Mathematical representation:** `sum(h,r) x[b,h,g,r] <= I[b,g]` for every
`b,g`.  
**Planned code representation:** one bounded-supply constraint per inventory
entry and an independent total-by-bank/group check.

### Demand accounting

**Plain English:** the model accounts for every demand unit as assigned or
unmet, exactly once.  
**Mathematical representation:**
`sum((b,g): (b,h,g,r) in E) x[b,h,g,r] + u[h,r] = D[h,r]` for every `h,r`.
  
**Planned code representation:** one equality constraint per demand row and a
validator that recomputes served plus unmet totals.

### Eligibility and nonnegativity

**Plain English:** quantities cannot be negative, and unavailable or
disallowed allocation combinations cannot receive units.  
**Mathematical representation:** `x,u >= 0`, integral; variables for tuples
outside `E` are absent (or equivalently fixed to zero).  
**Planned code representation:** only eligible variables are generated,
integer bounds are enforced, and the validator rejects unexpected keys or
negative/non-integer quantities.

Additional constraints such as route capacity, shipment minimums, time windows,
or multiple periods are out of scope until specified. They must not be
silently assumed.

## 15. Unmet-demand representation

An allocation may not cover every demand row because supply, compatibility, or
route availability can be limited. The model represents the uncovered amount
explicitly instead of hiding it.

**Plain English:** `u[h,r]` is the count of demand units not assigned in the
synthetic solution.  
**Mathematical representation:** `u[h,r]` is a nonnegative integer and
`served[h,r] + u[h,r] = D[h,r]`; therefore `0 <= u[h,r] <= D[h,r]`.  
**Code representation:** greedy and exact result objects include an unmet count
for every demand row (including zero), and the objective evaluator recomputes
the same values from the allocation. A future dashboard should label this
“unmet modeled demand,” not imply a patient-level outcome.

## 16. Classical baseline

The classical baseline is a transparent non-quantum reference method. The
implemented baseline is a deterministic greedy heuristic: repeatedly
choose an eligible allocation that best improves the declared unmet-demand
and route score, while never exceeding remaining inventory or demand. Its
tie-breaking order must be fixed so the same scenario gives the same result.

**Plain English:** a simple conventional rule gives us a reference allocation
without quantum circuits. It may be feasible without being globally best.  
**Mathematical representation:** the heuristic returns feasible `x,u` under
the constraints of Section 14; its score is `F(x,u)`. It makes no claim that
`F` is the smallest possible score.  
**Code representation:** `optimization/greedy.py` shares the scenario,
objective evaluator, and validator with the exact solver.

The tie-breaking is deterministic and documented in
`docs/CLASSICAL_BASELINES.md`. Benchmark comparisons use the same input,
objective, and validator.

## 17. Exact small-instance solver

An exact solver is implemented for tiny synthetic cases where all feasible integer
allocations can be enumerated. “Exact” means it checks every candidate in the
defined finite search space and returns one with minimum objective, subject to
the formulation being correct.

**Plain English:** for a very small example, try every allowed allocation,
discard infeasible ones, and keep the lowest-scoring one.  
**Mathematical representation:** for finite feasible set `S`, return
`(x*,u*) ∈ argmin_{(x,u)∈S} F(x,u)`.  
**Code representation:** the deliberately size-limited enumerator in
`optimization/exact.py` checks the estimated state count before running and
raises a clear limit error when an instance is too large. Enumeration time
grows rapidly with problem size.

This exact solver is a correctness reference for small cases, not a promise of
practical performance on large cases. A future mathematical-programming
solver may be evaluated separately and identified by its actual optimality
status.

## 18. QUBO formulation

QUBO means “quadratic unconstrained binary optimization.” It describes a score
using binary variables (bits) and terms involving up to pairs of bits. The
word “unconstrained” means the constraints are represented as score penalties
rather than passed separately to the QUBO solver.

**Plain English:** represent bounded integer quantities using bits, then add a
large penalty whenever a bit assignment breaks an inventory or demand rule.
The lowest-score bit pattern should correspond to a good feasible allocation
when penalty weights are chosen correctly.  
**Mathematical representation:** represent each bounded integer `v` using
binary bits, for example `v = sum(k=0..K) 2^k z[k]` with `z[k] ∈ {0,1}` and a
bound-aware encoding. Add binary slack variables `s[b,g]` for unused
inventory. A proposed penalty objective is

```text
Q(z) = F(x(z),u(z))
     + A * sum(b,g) (sum(h,r) x[b,h,g,r] + s[b,g] - I[b,g])^2
     + B * sum(h,r) (sum((b,g): eligible) x[b,h,g,r] + u[h,r] - D[h,r])^2
```

The `x` and `u` values are decoded from their bits; slack is nonnegative and
bounded. Squaring these linear expressions creates only constant, single-bit,
and pair-of-bit terms after using `z*z=z`, so the result is quadratic. `A` and
`B` are penalty weights. A feasible assignment has zero constraint penalties;
an invalid assignment pays a penalty. Choosing weights that are too small can
make invalid states look attractive, while excessive weights can make
optimization numerically difficult.  
**Code representation:** `quantum/qubo.py` builds bounded integer encodings,
slack encodings, and configurable penalty terms. The tests compare its
polynomial against decoded objective and penalty values on small assignments.
Penalty values are explicit settings, not clinical constants.

This formulation is a design sketch, not proof that every chosen encoding or
penalty scheme will be correct or efficient. Any added bound or penalty must be
documented and validated.

## 19. Ising conversion

An Ising model uses variables with values `+1` or `-1` (often called spins)
instead of bits. It is another way to express the same energy-ranking problem.

**Plain English:** convert every QUBO bit into a spin so Qiskit's quantum
workflow can express the score as an operator. A correct conversion preserves
which bit patterns have lower score.  
**Mathematical representation:** for bit `z[i] ∈ {0,1}`, define spin
`Z[i] = 1 - 2*z[i] ∈ {+1,-1}` (equivalently `z[i]=(1-Z[i])/2`). Substituting
this mapping into a QUBO yields an Ising energy
`H = constant + sum(i) h[i] Z[i] + sum(i<j) J[i,j] Z[i] Z[j]`.  
**Code representation:** `quantum/ising.py` maps QUBO coefficients to a
Qiskit `SparsePauliOp`; tests compare QUBO and Ising energies for every
bitstring in a tiny model.

The constant changes absolute energy values but not which bitstring is best.
Coefficient and operator conventions must be recorded to avoid sign or
factor-of-two mistakes.

## 20. QAOA workflow

QAOA (Quantum Approximate Optimization Algorithm) is a parameterized circuit
workflow that samples bitstrings intended to have low cost under a supplied
binary objective. In this project it runs on a local simulator, not on a
patient-care system.

**Plain English:** prepare a circuit, adjust its parameters using a classical
optimizer, measure it repeatedly, and collect candidate bit patterns. The
candidate with lowest evaluated score is not automatically feasible.  
**Mathematical representation:** starting from a cost Hamiltonian `H_C` derived
from the Ising model and a mixing Hamiltonian `H_M`, a depth-`p` circuit has the
form `U(γ,β)=Π(l=1..p) exp(-i β[l] H_M) exp(-i γ[l] H_C)`. Measurements sample
bitstrings from a parameter-dependent distribution. `γ`, `β`, circuit depth
`p`, and the number of shots are experimental settings.  
**Code representation:** `quantum/qaoa_solver.py` builds the circuit, runs
Qiskit Aer, records optimizer and seed settings, collects measured counts, and
hands candidates to the mapping-driven decoder. The local simulator enforces
a configured qubit limit.

QAOA settings require tuning and simulator work may be costly. There is no
assumption that this workflow is faster, more accurate, or better than the
classical baseline. Its measured output is only the sample produced by the
recorded experiment.

## 21. Bitstring decoding

Decoding turns measured bits back into human-readable integer assignments.

**Plain English:** map each measured bit to its documented variable, combine
weighted bits into `x`, `u`, and slack values, and form a candidate allocation.
Some measured strings may decode to allocations that break the original
constraints.  
**Mathematical representation:** for encoded variable `v`,
`v = sum(k) w[k] z[k]`, with weights `w[k]` and bit values read in the exact
recorded bit order. Decoding maps a measured string to `(x,u,s)` and then
evaluates its feasibility and `F(x,u)`.  
**Code representation:** `optimization/decoder.py` uses the encoding metadata
produced by the QUBO builder and reports infeasible candidates without
repairing them. Any later repair procedure must be a separate, named step and
retain both the original and repaired candidates for analysis.

Bit ordering, integer bounds, and unused binary encodings must be tested
explicitly. The application must not silently present an invalid candidate as
a valid allocation.

## 22. Classical validation

Classical validation independently checks a candidate against the original
scenario and recomputes reported metrics. “Independent” means it does not
trust the solver's feasibility flag or QUBO penalty value.

**Plain English:** check the returned quantities directly: no negative values,
no overdrawn bank stock, no disallowed route or group pair, and exact demand
accounting. Recalculate unmet quantities and score from the original inputs.
  
**Mathematical representation:** verify integrality and nonnegativity;
verify for each `b,g` that `sum(h,r)x <= I`; verify for each `h,r` that
`sum(b,g)x + u = D`; verify that every nonzero `x` belongs to `E`; then
recompute `F(x,u)`.  
**Planned code representation:** a validator in `optimization/` that returns
structured pass/fail checks, violations, recomputed totals, and score. All
solver outputs go through it before being labeled feasible.

## 23. Emergency simulation

An emergency simulation is a synthetic change to scenario inputs, such as
increasing a demand row or marking a route unavailable. It is a way to see how
the model responds to a changed artificial scenario.

**Plain English:** copy a synthetic scenario, apply a clearly described
change, validate the new input, and run the same optimization and validation
workflow again.  
**Mathematical representation:** if the original demand is `D[h,r]`, an event
may define a nonnegative change `Δ[h,r]`; the new scenario uses
`D'[h,r]=D[h,r]+Δ[h,r]`. The event may also change documented route parameters.
  
**Planned code representation:** an event record and scenario transformation
under `emergency/`; the original and modified scenarios will receive distinct
identifiers and both will be retained in the synthetic experiment record.

This feature will not send alerts, orders, or dispatch instructions and will
not respond to a real emergency.

## 24. Benchmarking

Benchmarking compares methods on the same named synthetic scenarios and
objective. It should report both solution quality and computational context;
one number alone is not enough to characterize a method.

**Plain English:** record what was run, on what synthetic input, how long it
took, whether it produced a feasible candidate, what score it received, and
how the run was configured.  
**Mathematical representation:** useful measures include objective gap to a
known exact optimum on tiny cases,
`gap = (F_method - F_exact)/max(|F_exact|, epsilon)` where the convention for
zero/negative denominators must be specified; feasible-sample rate
`N_feasible/N_measured`; and elapsed wall-clock time under a stated timing
boundary. The exact-optimum gap is available only where an exact reference is
known.  
**Planned code representation:** structured experiment records under
`quantum/` or `data/` and summary tables generated by benchmark tooling. Records
will include scenario version, code/package versions, hardware, solver,
random seeds where available, shots, QAOA depth/settings, runtime boundary,
and validation outcomes.

Measured results will be labeled as measured and include enough configuration
to interpret them. Expected results, hypotheses, or planned experiments will
be labeled as expected/planned and never mixed into measured tables. Simulated
QAOA results do not establish quantum advantage.

## 25. Frontend

The planned React and Vite frontend lets a user load or edit a synthetic
scenario, submit it, and inspect aggregate allocations, unmet modeled demand,
score components, validation, and experiment settings.

**Plain English:** the page is a way to explore and explain a synthetic run,
not a medical interface.  
**Mathematical representation:** it displays values computed from `x`, `u`,
`F`, and validation checks; it does not independently redefine those
quantities.  
**Planned code representation:** React components in `frontend/` will call the
backend API and label scenario assumptions, method, and measured/expected
status. They will not display patient-specific recommendations.

## 26. Backend

The planned FastAPI backend receives scenario requests, validates their
structure, coordinates optimization and quantum experiment modules, and
returns structured results and errors.

**Plain English:** the backend is the connector between the browser and the
model code; it should not contain a second, conflicting copy of the
mathematics.  
**Mathematical representation:** it passes model parameters and candidate
`x,u` values between modules and exposes the returned `F` and validation
results.  
**Planned code representation:** API schemas and endpoints in `backend/`,
calling reusable scenario/model functions in `optimization/` and the optional
simulator workflow in `quantum/`. Initial storage remains JSON/CSV; database
infrastructure is not part of this specification.

## 27. Data flow

**Plain English:** one validated synthetic scenario flows through filtering,
modeling, solving, validation, and presentation. Each stage receives explicit
inputs and produces inspectable outputs.  
**Mathematical representation:** scenario parameters `(I,D,p,c,t,a,e)` produce
eligible set `E`, candidate variables `(x,u)`, objective `F`, and independent
feasibility checks under the constraints in Section 14.  
**Planned code representation:**

```text
JSON/CSV synthetic scenario
  -> backend schema and scenario validation
  -> compatibility and route filtering
  -> optimization model, classical baseline, and tiny exact solver
  -> optional QUBO -> Ising -> QAOA simulator -> bitstring decoding
  -> independent classical validation and score recomputation
  -> benchmark record
  -> FastAPI response -> React/Vite display
```

Emergency simulation creates a new synthetic scenario and re-enters at
validation. Each reported candidate, whether classical or quantum-generated,
must pass through the same classical validator.

## 28. Testing

Tests will be added as implementation milestones introduce behavior. The
initial loader tests use synthetic fixtures only.

**Plain English:** small predictable examples help verify that each stage
follows the documented rules and that later encodings preserve the model.  
**Mathematical representation:** on tiny cases, tests can enumerate feasible
`S`, check `argmin F`, compare QUBO energies to the constrained score plus
penalties, and compare QUBO and Ising energies for every bitstring up to an
additive constant.  
**Code representation:** `tests/test_data_loader.py` currently checks initial
dataset loading and strict schema/error behavior. Future automated checks under
`tests/` will cover eligibility filtering, bounds, demand accounting, objective
components, exact enumeration, encoding/decoding round trips, Ising
coefficients, candidate validation, emergency scenario changes, and API
schemas. Randomized tests, if later added, will use fixed seeds and synthetic
inputs.

## 29. Limitations

- All initial examples and experiments are synthetic and may not represent
  real inventory, demand, travel, or operations.
- The first model is static, aggregate, single-period, and deterministic.
- Compatibility is a declared modeling table requiring careful review; this
  document does not supply clinical rules.
- Objective weights are assumptions; different weights can produce different
  allocations.
- The exact enumerator is only for tiny cases because the number of candidates
  grows quickly.
- QUBO encodings can use many bits and require penalty choices; unsuitable
  sizes or encodings must be disclosed.
- QAOA simulator output is sampled and can be infeasible or suboptimal.
- Benchmark results depend on implementation, simulator, hardware, settings,
  and scenario size; no speed or quality advantage is assumed.
- The prototype will not perform real delivery, connect to live hospital
  systems, or observe patient outcomes.

## 30. Ethical and safety boundaries

BloodFlow-Q is a non-clinical logistics research demonstration. It will use
synthetic data, show assumptions, preserve the distinction between a modeled
scenario and real operations, and clearly flag infeasible or unvalidated
candidate solutions. It will not include names, medical records, patient
identifiers, or real hospital operational feeds. The compatibility mapping
and urgency weights are modeling assumptions, not clinical guidance. No
result may be used to decide whether or what an individual patient should
receive.

## Things We Must Never Claim

- **Quantum advantage:** no claim that QAOA or a quantum workflow is faster,
  cheaper, more accurate, or better than classical methods without suitable
  evidence; this prototype makes no such claim.
- **Clinical validity:** no claim that the model, compatibility assumptions,
  urgency weights, or outputs are clinically validated.
- **Real-world hospital deployment:** no claim that the prototype is deployed,
  integrated, or ready for use by real hospitals.
- **Medical decision-making:** no claim that the system selects treatment,
  makes patient-level decisions, or should guide care.
- **Real patient outcomes:** no claim about patients helped, harm avoided,
  lives saved, or any other real patient outcome.
