# BloodFlow-Q QUBO formulation

This document describes the binary model built by `quantum/qubo.py`. The QUBO
builder constructs and evaluates the mathematical representation; it does not
execute an optimizer itself. The separate `quantum/qaoa_solver.py` module
converts the model to an Ising cost operator, runs QAOA on a local simulator,
and returns measured candidate bitstrings. All scenarios are synthetic
logistics examples, and the compatibility table is a simplified prototype
assumption rather than a transfusion guidance system.

## Variables

For each compatible blood-bank/hospital/group route, the model has an integer
shipment quantity `x[b,h,g,r]`: units supplied as group `g` to satisfy demand
for recipient group `r`. For every positive demand row it has unmet quantity
`u[h,r]`. For each positive bank/group inventory it has unused inventory
`s[b,g]`, added to convert the inventory limit into an equality.

Each bounded integer is represented by binary bits. The weights are chosen so
all values from zero through the declared upper bound can be represented and
no decoded value exceeds that bound. For example, an upper bound of 3 uses
weights 1 and 2, so `x = z0 + 2*z1`.

`variable_mapping` gives each bit's index, kind, bit weight, quantity bound,
source/hospital/group details where applicable, and a plain-language meaning.
In code, call `result.decode(bits)` to reconstruct an allocation and the
unmet/slack maps.

## Cost and constraints

The unpenalized objective is the same additive cost as the classical model:

`C = critical_unmet_weight * priority_weighted_critical_unmet`
`  + total_unmet_weight * total_unmet`
`  + transportation_cost_weight * transport_cost`
`  + transportation_time_weight * transport_time`
`  + secondary_penalty_weight * sum(optional_secondary_amounts)`

High-urgency rows are the prototype's definition of “critical”; this is only
an operational scenario label. Every shipment incurs the route's configured
per-unit time and cost. Optional secondary penalty amounts are currently
constants because no corresponding decision feature exists yet.

Demand accounting is encoded as the equality

`sum_b,g x[b,h,g,r] + u[h,r] = demand[h,r]`.

Inventory is encoded as

`sum_h,r x[b,h,g,r] + s[b,g] = inventory[b,g]`.

Each equality contributes `P * (left_side - right_side)^2`. A satisfied
equality adds zero. Any integer mismatch adds at least its penalty weight.
`QUBOPenaltyConfig` makes both penalty weights explicit. The builder requires
each to be strictly greater than a conservative upper bound on the full
non-penalty objective. Thus a violated equality cannot be compensated for by
any possible reduction in the non-negative objective terms. This is a safe
but potentially large bound for tiny demonstrations, not a tuning claim.

Compatibility and route availability are hard-filtered: `Scenario` only
creates shipment variables for compatible pairs on available routes. There is
no bit that can request an incompatible or blocked shipment.

## Matrix and energy convention

The builder expands the linear objective and squared penalties into

`E(z) = constant_offset + z.T @ Q @ z`,

where each `z[i]` is zero or one and `Q` is symmetric. Because `z[i]**2 = z[i]`
for binary values, squared terms become diagonal linear terms. Each
off-diagonal pair coefficient is split evenly across `Q[i,j]` and `Q[j,i]`.
The constant cannot be represented by the matrix quadratic form when all bits
are zero, so it is returned separately. Omitting the constant leaves the
minimizing bit strings unchanged but shifts reported energy values.

## Hand-checkable one-unit example

Use one bank, one hospital, one group, inventory 1, demand 1, and a zero-cost,
zero-time available route. Let the demand urgency be high with priority weight
1, and use objective weights `(critical=2, total=1, cost=0, time=0,
secondary=0)`. The objective upper bound is 3, so choose both equality
penalties as 4. In the mapping order `x, u, s`, the model is

`3u + 4(x + s - 1)^2 + 4(x + u - 1)^2`.

The matrix and constant are:

```text
Q = [ -8   4   4 ]
    [  4  -1   0 ]
    [  4   0  -4 ]

constant_offset = 8
```

Shipping the unit (`x=1,u=0,s=0`) has energy 0. Leaving it unmet while keeping
inventory unused (`x=0,u=1,s=1`) has energy 3. Setting all bits to zero has
energy 8 because both equalities are violated.

Run the executable version from the project root with
`python3 -m examples.inspect_tiny_qubo`. Its source is
`examples/inspect_tiny_qubo.py`; the exact values are asserted in
`tests/test_qubo_consistency.py`.

## Verification and limits

`QUBOResult.evaluate_assignment` computes the decoded classical additive cost
and both squared penalty terms, including for infeasible bit strings. The
consistency tests compare that independent calculation with the matrix energy
for seeded random assignments, check feasible decoded assignments against the
classical objective/validator, and compare the minimum on a tiny instance with
the exhaustive exact solver.

This is intended for tiny synthetic research/hackathon examples. Binary
encodings increase the bit count, dense Q matrices grow quadratically in
storage, and large penalty weights can make optimization numerically harder.
No runtime, performance, quantum advantage, clinical validity, or real-world
deployment claim follows from constructing this representation.

## QAOA execution boundary

`build_qubo(...)` only creates the model. QAOA is run separately through
`quantum.qaoa_solver.QAOASolver`; its depth, shot count, seed, and classical
optimizer are configurable. The simulator measures candidate bitstrings, and
the decoder and classical validator evaluate the returned candidate. A
successful QAOA run is not a proof of optimality, and the local Aer simulator
does not demonstrate quantum advantage.
