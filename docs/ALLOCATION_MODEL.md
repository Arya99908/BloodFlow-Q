# BloodFlow-Q allocation model (classical, pre-solver)

## Purpose and boundary

`optimization/models.py` defines the Python data structures for one small,
synthetic allocation scenario. It describes a bounded integer model that can
later be used by a classical solver or converted to QUBO. It does not optimize,
choose an allocation, or use quantum computing.

All entities represent aggregate fictional logistics records. Compatibility
and urgency values are model inputs, not clinical guidance. The compatibility
table remains the simplified assumption documented in
[`SYNTHETIC_DATA.md`](SYNTHETIC_DATA.md).

## Decision variables in plain English

A possible shipment needs four identifiers:

1. the source bank;
2. the destination hospital;
3. the supplied inventory group;
4. the recipient-demand group the shipment would count toward.

It also has a whole-number quantity. The recipient group is included because a
scenario's explicit compatibility table may allow one supplied group to count
toward a different demand group. The prototype never guesses that mapping.

`AllocationVariable` describes one allowed shipment choice and its upper
bound. It is **not** a chosen quantity. `AllocationDecision` represents a
concrete candidate quantity, which a future solver could return. No solver is
implemented here.

For one scenario, let `x[b,h,g,r]` be units from bank `b` sent to hospital `h`,
with supplied group `g`, to satisfy demand group `r`. Let `u[h,r]` be unmet
units for that hospital and demand group. Both are non-negative integers.

## Inputs and constraints

- `BloodBank.inventory[g]` is the available integer stock. For each bank and
  supplied group, the total sent cannot exceed this count:
  `sum(h,r) x[b,h,g,r] <= inventory[b,g]`.
- `Hospital.demand[r]` is aggregate integer demand. Served plus unmet units
  must equal it:
  `sum(b,g) x[b,h,g,r] + u[h,r] = demand[h,r]`.
- `Hospital.urgency[r]` stores a category and positive synthetic priority
  weight. The classical objective applies this weight to unmet rows labeled
  `high`; a separate general shortage term counts all unmet units. The weight
  is not a clinical score.
- `Scenario.compatibility[(g,r)]` is explicit `True`/`False` input. A shipment
  variable only exists for pairs marked `True`.
- `Route.status` identifies available and blocked bank/hospital links. Only an
  available route can create a shipment variable. The objective scorer uses
  route time and cost as separate, quantity-weighted terms.
- `u[h,r]` has the simple finite bound `0 <= u[h,r] <= demand[h,r]`.
- Each possible shipment variable has the finite bound
  `0 <= x[b,h,g,r] <= min(inventory[b,g], demand[h,r])`.

The classical objective scorer is described in
[`OBJECTIVE_FUNCTION.md`](OBJECTIVE_FUNCTION.md). Its configured weights and
route units must be recorded because they change the score and trade-off.
`optimization/objective.py` scores supplied allocations but does not search
for one. Deterministic Greedy and size-limited Exact solvers are implemented
separately in `optimization/greedy.py` and `optimization/exact.py`.

The inventory and demand sums are shared across all relevant shipment
variables. The feasibility checker enforces those sums together; each
individual upper bound is not a substitute for the total inventory constraint.

## Why bounded integer variables help later

The bounds make the model finite. A future QUBO design could encode an integer
quantity with a small set of binary bits, then add carefully tested penalties
for inventory and demand equations. This module only reports bounds and
eligibility; it does not create bits, penalties, a QUBO, or an Ising model.

## Python structure

- `BloodBank`: identifier, location label, and inventory by supplied group.
- `Hospital`: identifier, location label, demand by recipient group, and
  urgency inputs by the same group.
- `Route`: source, destination, synthetic travel time, distance, cost, and
  available/blocked status.
- `Scenario`: supported groups plus banks, hospitals, routes, compatibility,
  and a synthetic-data marker. Construction checks ids, groups, numeric bounds,
  route references, and complete route/compatibility tables.
- `AllocationVariable`: eligible integer shipment key and upper bound.
- `UnmetDemandVariable`: hospital/group key and upper bound for unmet units.
- `AllocationDecision`: a concrete candidate shipment quantity.

`Scenario.allocation_variables()` lists eligible bounded shipment variables;
`Scenario.unmet_demand_variables()` lists positive-demand unmet variables.
Neither method solves the problem or changes the scenario.

## Frontend independence

This module imports only Python's standard library. It contains no React,
FastAPI, browser, or user-interface types. A future API layer may translate
validated request data into these classes, while the mathematical model stays
independent of the frontend.
