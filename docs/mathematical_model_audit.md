# Mathematical model audit

Inspected 24 October 2026: `optimization/models.py`, `constraints.py`, `objective.py`, `milp.py`, `decoder.py`; `quantum/qubo.py`, `ising.py`, `qaoa_solver.py`; independent formulation tests and the completed proof artifacts identified below. This is the implemented synthetic allocation model, not a full blood-service routing, inventory-aging, or clinical decision model. Findings are scoped to inspected code; benchmark execution and full-suite results belong in the experiment report.

## Variables, inputs, and operational feasibility

Let a supply row `a=(bank, donor_group)` have integer stock `S_a >= 0`, and demand row `b=(hospital, recipient_group)` have integer demand `D_b >= 0`. An arc `e=(a,b)` exists only when its route is available, its compatibility-table entry is true, and both row quantities are positive. The shipment decision is integer `0 <= x_e <= min(S_a,D_b)`. Omitted arcs have shipment zero.

Every positive demand has integer shortage `0 <= u_b <= D_b`; every positive supply has integer unused-stock slack `0 <= s_a <= S_a` in the QUBO. The original MILP has shipment and shortage variables, with an inventory inequality instead of explicit slack. Its constraints are:

```
sum(e leaving a) x_e <= S_a
sum(e entering b) x_e + u_b = D_b
```

The QUBO replaces the first inequality by `sum x_e + s_a = S_a`. These formulations have equivalent feasible allocations because unused stock is nonnegative and bounded by stock. Shortage is allowed: insufficient stock, incompatible groups, or blocked routes need not make the optimization problem infeasible. Setting every shipment to zero, every shortage to demand, and every slack to stock is always feasible for valid inputs. An infeasible *sample* means it violates the encoded or operational constraints; it does not mean the input requires all demand to be satisfied.

`Scenario` requires nonempty bank, hospital, and group collections; unique/valid identifiers; complete inventory/demand and compatibility mappings; and a route record for every bank/hospital pair. Unavailable connections are represented by route status rather than silently missing records. Quantities are nonnegative whole numbers. `AllocationDecision` validates integer nonnegative quantities; the independent validator also checks IDs, group eligibility, route status, accumulated supply use, and demand accounting. Duplicate shipment records accumulate rather than bypassing stock limits.

There is **no implemented route capacity, vehicle fleet, multi-stop routing, route fixed charge, perishable-age constraint, expiry or storage horizon, travel-time deadline, fairness quota, or mandatory zero-shortage constraint** in this production model. Distance is descriptive route metadata. Transport time contributes to cost, not a feasibility deadline. The separate necessity experiment's fixed-dispatch fees are explicitly a hypothetical model extension.

## Minimized operational objective

For shortage row `b`, define

```
a_b = total_unmet_weight
      + critical_unmet_weight * priority_weight_b
        if urgency_b is high or critical
```

For all other urgency categories, only `total_unmet_weight` applies. The high/critical shortage is intentionally counted in both the total and priority-weighted critical components. For arc `e` on route `r`, define

```
c_e = transportation_cost_weight * transport_cost_r
      + transportation_time_weight * travel_time_minutes_r
```

The minimized objective is `F(x,u) = sum c_e*x_e + sum a_b*u_b + C`, where `C = secondary_penalty_weight * sum(caller_secondary_amounts)`. All weights and secondary amounts must be finite and nonnegative. Costs and times are per shipped unit; this is not route activation cost or makespan. Secondary amounts are fixed constants during an optimization call, not newly modeled decision-dependent constraints. The scorer reconstructs unmet demand from feasible shipments; on a feasible QUBO assignment this equals encoded `u`.

The MILP minimizes the nonconstant vector objective and includes `C` when reporting the shared objective. LP metadata also includes this constant. A constant changes reported energy but not the optimizer's minimizers. Infeasible QUBO bitstrings can have an unpenalized linear value, but that number is not a feasible operational allocation score.

## Shortened binary encoding and ordering

For each integer quantity with upper bound `U`, `_binary_weights` appends `min(2^k, U - covered)` until the weights sum to `U`. Every bitstring therefore decodes inside `[0,U]`, and every integer in that interval has a representation. A zero bound uses no bits. The representation is generally nonunique: `U=2` uses weights `(1,1)`, so `01` and `10` both represent one unit; `U=5` uses `(1,2,2)`. Ground-state or allocation sampling probabilities must aggregate all encodings of the desired outcome. Uniform bitstrings do not generally induce a uniform distribution over quantities or allocations.

Registers appear in shipment-variable order, then positive-demand shortage rows, then positive-stock slack rows. Individual register bits follow increasing stored bit positions, but the last weight need not equal `2^position`. Always use `variable_mapping` and `bit_weight`; arithmetic on an assumed ordinary binary string is wrong for shortened registers.

`QUBOResult.decode` takes a sequence in mapping index order. The public decoder and Ising energy accept Qiskit measurement strings by reversing displayed characters: the rightmost character is qubit/index zero. Mapping-order strings require the explicit `string_bit_order='mapping'` option. Whitespace in count strings is removed. Decoding preserves the original sample; it does not repair, clip, or insert a classical solution into a measurement histogram.

## Penalty polynomial, sufficient bound, and Ising equivalence

The QUBO energy is

```
E(z) = F(x(z),u(z))
       + P_inventory * sum_a (sum_e x_e(z) + s_a(z) - S_a)^2
       + P_demand * sum_b (sum_e x_e(z) + u_b(z) - D_b)^2.
```

The builder calculates `B = sum_e c_e*upper_e + sum_b a_b*D_b` and rejects either penalty weight unless it is **strictly greater than B**. Because coefficients are nonnegative, `B` bounds the spread of the unpenalized objective over all encodings; `C` cancels from the spread. Any nonzero integer residual has square at least one. A violating assignment therefore costs more than any possible improvement in the unpenalized objective, while a feasible assignment exists. Thus every exact global QUBO minimizer is feasible in exact arithmetic. This is a statement about global minimizers, not a guarantee for finite-depth QAOA samples or floating-point optimization. Very conservative penalties enlarge spectral ranges and may make optimization harder.

`_add_square` retains the positive constant `P*target^2`, adds linear terms `P*(weight^2 - 2*target*weight)`, and pair terms `2*P*weight_i*weight_j`. The matrix convention is symmetric `constant_offset + z.T @ Q @ z`, so unordered pair coefficients are divided between both off-diagonal entries. Dropping the constant or counting each off-diagonal only once breaks numerical equality even if some minimizers happen to survive.

With spin `Z_i = 1 - 2*z_i`, the Ising coefficients are:

```
J_ij = Q_ij / 2                 (i < j, symmetric Q)
h_i  = -Q_ii/2 - sum(j != i) Q_ij/2
C_I  = C_Q + sum_i Q_ii/2 + sum(i < j) Q_ij/2.
```

The `SparsePauliOp` includes the identity constant; do not add `constant_offset` a second time to its expectation. Cost gates use `RZ(2*gamma*h)` and `RZZ(2*gamma*J)`, implementing the appropriate diagonal evolution up to the irrelevant identity phase. Optional normalization divides the operator by a positive scale and restores physical energy units in reported expectations; it preserves minimizers, but changes the interpretation of phase angles and historical optimizer trajectories.

## Constraint enforcement map

| Constraint/property | Representation | Production mixer/initial state | Penalty | Independent validation |
|---|---|---|---|---|
| Integer, nonnegative bounded register | Shortened binary weights enforce it | Preserved because all computational basis assignments decode in bounds | Not needed | Allocation quantity/type checked |
| Available route and compatible group pair | Ineligible shipment variables omitted | Cannot create an omitted variable | Not needed | Checked again on decoded shipments |
| Shared bank/group inventory | Individual bounds alone insufficient | X, matched warm product mixer, and current XY do **not** preserve it | Slack equality | Operational `sum x <= stock` checked |
| Demand accounting | Individual shortage/shipment bounds insufficient | None of these mixers guarantee it | Served + shortage equality | Explicit encoded shortage checked, including zero rows |
| Correct unused-stock slack | Bounded register only | Not guaranteed | Supply equality | Shared allocation validator has no slack argument; inspect QUBO residual/penalty |
| Complete demand satisfaction | Not required | Not guaranteed | Shortage has objective cost, not prohibited | Shortage allowed |
| Route capacity, expiry, time deadline | Not modeled | Not modeled | None | Not checked |

**Operational versus encoded feasibility matters.** `evaluate_quantum_solution` reports the shared allocation validator's feasibility, including its encoded shortage, but does not check the unused-stock slack equality. A sample can therefore have a valid operational shipment plan and `feasible=True` while retaining positive inventory-slack penalty. This is intentional in the existing consistency tests, but any report labeled “QUBO feasible” must also require zero equality residuals. Raw energy and operational objective are distinct metrics.

The production XY gates pair `RXX(beta)` and `RYY(beta)`, preserving total excitation/Hamming weight. Its graph connects neighboring register bits, selected shared-constraint bits, and a full ring. Conserving unweighted bit count does not conserve weighted quantities, both coupled row equations, or all individual register weights. Starting from `H` or a regularized product state also occupies multiple excitation sectors. It is an experimental mixer, not a proven feasible-flow mixer. Research-only feasible-Grover enumeration has a separate ideal invariant and exponential preparation limitation described in the literature review.

## LP integrality and the classical baseline

Each shipment column touches one supply row and one demand row. Negate the supply rows: shipment columns have one `-1` and one `+1`, as in a directed network incidence matrix. Shortage and slack columns are signed unit columns; adding bounds preserves integrality. With integer stocks, demands, and bounds, the resulting transportation polytope is integral (totally unimodular constraint structure). Arbitrary real linear objective coefficients do not destroy this property. Therefore an integral LP optimum exists, and a valid LP optimum is already a strong baseline for this model.

This does not mean every optimal fractional point is integral: convex combinations of tied optimal vertices can be fractional. Numerical tolerances still matter, and returned solutions should be checked. The conclusion no longer follows automatically after introducing binary dispatch charges, nonlinear objectives, additional shared capacities, or side constraints. Neither a successful warm start nor a faster simulator run establishes advantage over a well-implemented min-cost-flow/LP baseline.

## Warm preparation and optional incumbent retention

Warm preparation obtains LP values or a validated greedy fallback, encodes adjacent integer values into bit marginals, and prepares independent `RY(theta)` rotations with `theta=2*asin(sqrt(p))`. Before regularization the marginals preserve each expected register value; independence discards correlations. The production affine rule is `p=epsilon+(1-2*epsilon)*marginal` with a numerical endpoint clip, not literal endpoint clipping from Egger's paper. A feasible classical seed therefore does not imply every prepared basis state is feasible. Positive-stock slack is reconstructed if the relaxation returns an empty slack mapping.

The matched single-qubit rotated mixer preserves its local prepared state up to phase when acting alone, but the cost evolution generally changes the state before mixing. Neither this local eigenstate property nor the seed's feasibility guarantees the coupled allocation constraints. Parameter initialization (`random`, `zero_first`, supplied `2*p` angles) is separate from state initialization and must be reported separately.

For opt-in `retain_initial_state`, all-zero angles give the prepared initial state. The solver evaluates its exact statevector expected penalized energy and selects it only if better than the best finite optimized restart. Conditional on obtaining a finite candidate and returning successfully, selected expected energy is no larger than this initial reference, up to numerical error. This does not guarantee improved feasible-shot probability, optimal-allocation probability, sampled best result, or runtime. If all restarts fail/nonfinite, the current code raises; it does not silently report the seed as optimizer success. The reference evaluation and preprocessing are counted. Finite-shot final counts come from the selected circuit. Noise/shot-estimated selection would need a separate statistical argument.

## Boundary findings and corrections

Zero-stock rows have no shipment/slack registers; zero-demand rows have no shipment/shortage registers. `qubo.decode` explicitly returns zero shortage for zero-demand rows. Positive inventory with zero demand still produces slack bits. If **both all inventory and all demand are zero**, the QUBO has no variables: its constant energy is defined, but `convert_qubo_to_ising` explicitly rejects zero qubits. This is an unsupported quantum-execution boundary, not mathematical infeasibility.

A genuine all-zero-demand bug was reproduced during this audit without running an expensive optimizer: `MILPSolver.solve` takes its `num_vars==0` branch and supplies `unmet_demand={}` to a validator requiring every demand row. For a bank with stock 3 and a hospital requesting zero, the returned status is `completed` but feasibility is false with “explicit unmet demand is missing this hospital/group row.” The normal nonempty path correctly fills zero rows. The empty LP path similarly returns `slack={}` despite positive stock; warm preparation compensates, but the relaxation mapping is incomplete. These findings were sent to the lead agent immediately and subsequently corrected: the empty MILP branch now supplies explicit zero demand rows; the empty LP branch returns all positive unused stock, while preserving its sparse zero-value convention and opt-in metadata. Four regression cases cover zero and positive stock, feasibility/status agreement, unchanged quantity-map keys, and nonzero secondary objective constants. Before the fix, three cases failed and one passed; afterward all four passed. The complete focused MILP module also passed (seven cases). The lead agent is responsible for separately rerunning affected benchmark boundary cases; earlier benchmark processes imported the pre-fix module and must not be relabeled as corrected-source runs.

## Verification evidence and scope

Existing test modules inspected include `test_independent_qubo_proof.py` (independent reconstructed polynomial and statevector checks), `test_qubo_consistency.py` (matrix/decoded objective and penalty comparisons), `test_qaoa_solver.py` (bit-order/Ising), `test_decoder.py`, and the warm-QAOA tests. Their presence is not a claim that the full suite ran in this documentation workstream.

The following fresh proof files were already present and read while the lead agent continued serial benchmarks. These are saved exhaustive formulation checks, not complete runtime comparisons. Values below are generated directly from those files; no pending scenario is treated as passed.

| Scenario | Enumerated states | Max Ising error | Reference optimum | Ground states feasible | Evidence |
|---|---:|---:|---:|---|---|
| critical_shortage | 512 | 1.81899e-12 | 145.4 | True | [raw proof](../experiments/results/full_review_20261024/production_v2/critical_shortage_proof.json) |
| demand_below_inventory | 256 | 4.54747e-13 | 15 | True | [raw proof](../experiments/results/full_review_20261024/production_v2/demand_below_inventory_proof.json) |
| emergency_16 | 8192 | 5.82077e-11 | 215.6 | True | [raw proof](../experiments/results/full_review_20261024/production_v2/emergency_16_proof.json) |
| inventory_shortage | 128 | 9.09495e-13 | 152.6 | True | [raw proof](../experiments/results/full_review_20261024/production_v2/inventory_shortage_proof.json) |
| multi_facility | 8192 | 0 | 16 | True | [raw proof](../experiments/results/full_review_20261024/production_v2/multi_facility_proof.json) |
| normal_reference | 1024 | 5.45697e-12 | 25.2 | True | [raw proof](../experiments/results/full_review_20261024/production_v2/normal_reference_proof.json) |
| transport_disruption | 64 | 0 | 140 | True | [raw proof](../experiments/results/full_review_20261024/production_v2/transport_disruption_proof.json) |

The reference values use their scenario-specific objective configuration; they are not comparable across scenarios as a single performance ranking. Floating-point residuals near machine precision are not literal symbolic equality. The final experiment report must separately report algorithm samples, operational versus encoded feasibility, statistical variability, budgets, and timings.
