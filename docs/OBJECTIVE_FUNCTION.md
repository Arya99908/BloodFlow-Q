# Classical allocation objective

`optimization/objective.py` scores an allocation that is already supplied. It
does not search for a better allocation. Its arithmetic is classical Python;
there is no QUBO or QAOA implementation here.

## Terms in plain English

1. **Critical unmet demand:** count demand left unmet for hospital rows whose
   synthetic urgency category is `high` or `critical`. Each such unit is multiplied by that
   row's synthetic `priority_weight`, then by `critical_unmet_weight`.
2. **Total unmet demand:** count every unfilled unit across all demand rows,
   then multiply by `total_unmet_weight`. High-urgency shortage is included
   here too, so critical shortage receives both the critical premium and the
   general shortage cost.
3. **Transportation cost:** for each shipment, multiply its quantity by the
   route's synthetic per-unit cost, sum those amounts, then multiply by
   `transportation_cost_weight`.
4. **Transportation time:** for each shipment, multiply its quantity by the
   route's synthetic per-unit travel-time estimate, sum those amounts, then
   multiply by `transportation_time_weight`. This is a unit-time burden, not a
   promise of actual delivery time for every unit.
5. **Optional secondary penalties:** the caller may provide named,
   non-negative penalty amounts, such as a future documented operational
   preference. Their sum is multiplied by `secondary_penalty_weight`. No
   secondary penalty is invented or enabled inside the objective module.

All weights are mandatory configuration values; the code has no unexplained
default trade-offs. Use zero for a component weight when the component should
be reported but not affect the total. Weights convert different input units
into one score, so their values and interpretation must be recorded with an
experiment. Scenario urgency weights, times, costs, and secondary amounts are
synthetic assumptions, not clinical measures.

## Mathematical form

Let `u[h,r]` be unmet demand for hospital `h` and recipient group `r`,
`x[b,h,g,r]` the units sent on an eligible bank/hospital/supplied-group/
recipient-group tuple, and `p[h,r]` the scenario's urgency priority weight.
For this prototype, categories `high` and `critical` define critical rows. Let `c[b,h]`
and `t[b,h]` be route cost and route time per shipped unit. Let `s[k]` be
optional named secondary penalty amounts.

```text
Critical shortage measure = sum((h,r) where urgency[h,r] == high) p[h,r] * u[h,r]
General shortage measure  = sum(h,r) u[h,r]
Transport cost measure    = sum(b,h,g,r) c[b,h] * x[b,h,g,r]
Transport time measure    = sum(b,h,g,r) t[b,h] * x[b,h,g,r]
Secondary measure         = sum(k) s[k]

Total objective = w_critical * Critical shortage measure
                + w_unmet * General shortage measure
                + w_cost * Transport cost measure
                + w_time * Transport time measure
                + w_secondary * Secondary measure
```

This is a minimization score: lower is preferred under the chosen scenario
and weights. Hard rules still apply: shipments cannot exceed inventory or
demand, and only available routes and explicitly allowed compatibility pairs
may be used. `calculate_objective` rejects an allocation that violates those
rules instead of assigning it a misleading finite score.

## Result structure

The returned `ObjectiveResult` reports raw values and weighted penalties
separately: high-urgency unmet units, priority-weighted high-urgency shortage,
total unmet units, unmet units by hospital/group, transport cost and time,
named secondary amounts, every weighted term, and the final total. Keeping raw
measures visible makes it possible to understand why the score has its value.

## Worked example

Suppose one high-urgency unit is unmet and has priority weight `3`; total unmet
demand is `1`; shipments have total cost `4` and total unit-time `20`; and a
caller supplies a secondary penalty amount of `2`. With explicitly configured
weights `10`, `2`, `0.5`, `0.1`, and `3`, respectively:

```text
critical penalty = 10 * (1 * 3) = 30
general penalty  =  2 * 1       =  2
cost penalty     =  0.5 * 4     =  2
time penalty     =  0.1 * 20    =  2
secondary        =  3 * 2       =  6
total objective                  = 42
```

The numbers are only a hand-checkable arithmetic example, not a recommended
choice of weights or an experimental result.
