# Algorithm comparison

Status: completed simulator research, 2026-10-23. Literature identifiers refer to the verified [literature matrix](literature/literature_matrix.json).

## Mathematical task and invariants

The production objective is a weighted sum of unmet demand and allocation-dependent costs. Shipment quantities are nonnegative integers on permitted routes and compatible blood types. Supply and served-demand bounds couple multiple shipment variables. Unmet demand is demand minus served units for feasible allocations. The current single-period structure is a capacitated transportation/flow problem with linear costs; the integral LP solutions observed here are consistent with that structure. This argument does not extend automatically to fixed-charge, nonlinear, or arbitrary additional constraints.

The original QUBO represents shipments, unmet demand, and inventory slack with bounded binary registers. Squared equality penalties enforce balance. Some bounded encodings have multiple bit strings for the same quantity: allocation degeneracy and bit-string degeneracy are distinct. Exact-optimum probabilities in this study sum all feasible optimal strings, rather than checking one preferred string.

The reduced encoding represents only shipments with unique ordinary binary registers. It computes unmet demand deterministically and adds squared hinge penalties for exceeding inventory, demand, or a register's allowed maximum. Invalid bit patterns are penalized, never repaired into valid outputs. A conservative penalty larger than the objective of the zero-shipment feasible solution excludes infeasible global minimizers for the tested nonnegative objective. Exhaustive checks independently compare feasible allocations and objective values with the original model and MILP. This is an equivalent feasible allocation problem, but its phase function is generally higher order, not a smaller quadratic QUBO.

| Method | Encoding and preserved constraints in ideal circuits | Costs and decision |
|---|---|---|
| Standard production QAOA | Original registers; omitted routes/compatibility enforced by variable selection; coupled balances penalized | Retain as historical control. X mixer permits infeasible states. |
| Warm-start QAOA | Same encoding; LP/greedy-guided product state and warm mixer; balances penalized | Strong sample probability here, but LP already supplies a global optimum. Include its classical cost. Egger et al. |
| XY / warm + XY | Original registers; XY preserves total excitation count, not weighted quantities or each bank/hospital balance | Not a valid full-feasibility mixer. Warm product state spans weight sectors. No default promotion justified. Hadfield/Fuchs clarify invariant-subspace requirements. |
| QUBO CVaR | Same state space and circuit; lower-tail energy objective with alpha 0.2 | Training objective changes, allocation objective does not. Exact fractional boundary mass is our convention. No convincing improvement in the planned contrast. Barkoutsos et al. |
| Reduced-register phase + X | Shipment bits only; eliminated variables are identities; remaining inequalities penalized | Fewer qubits and better sampling observed. Dense diagonal table grows exponentially; scalar reduction is not proof of cheap coherent implementation. |
| Reduced CVaR | Same reduced circuit, lower-tail training | Useful experimental control; saturation when optimal mass reaches alpha can leave worse full-distribution quality. Also tested with 256 sampled training shots/evaluation. |
| Feasible Grover mixer | Uniform superposition over all feasible reduced strings; rank-one reflection stays in their span | All modeled constraints preserved ideally. Explicitly enumerated preparation costs exponential work and already exposes the answer. Gate/readout errors break invariance. Bärtschi and Eidenbenz. |
| Parameter transfer | Reduced circuit, schedule trained on three separate historical cases | No held-out optimizer calls, but training and preprocessing must be charged/amortized. Tested against random schedules. Zhou/Galda et al. |
| Threshold amplitude amplification | Marks feasible strings beating a greedy objective; starts uniform over all reduced strings | Nonvariational alternative. Unmarked measured states may be infeasible. Fixed 1/2/3 iterations, no optimum-derived threshold or iteration selection; overshoot observed. Not a full adaptive Grover-search implementation. Gilliam; Dürr/Høyer. |
| Classical exact/MILP/LP, greedy, local search | Original allocation model, independent validator | LP and MILP attain the exact optimum on all eight held-out cases. Exhaustive table lookup is also an essential comparator whenever a quantum prototype constructs such a table. |

For the feasible mixer, let |F> be the normalized sum over feasible strings. The implemented unitary is I+(exp(-i beta)-1)|F><F|. Acting on a vector supported in F cannot create support outside F; a diagonal cost unitary also preserves support. The complete feasible subspace is checked exhaustively on small instances. Qiskit state preparation implements this reflection with inverse preparation, a zero-state phase, and preparation. It is not an efficient state-preparation construction for arbitrary allocation instances.

## Alternatives investigated but not claimed implemented

One-hot/domain-wall encodings change locality and illegal-state structure, but can increase qubits; valid individual quantities still do not enforce joint bank/hospital bounds. A flow mixer must specify legal residual-path/cycle transitions, boundary handling, reversibility, and connectivity, not just swap bits. Such a construction is a worthwhile next mathematical prototype.

Multi-angle, ADAPT, recursive QAOA, interpolation and transfer have primary-source support, but none removes the cost of obtaining an already-optimal LP seed here. Multi-angle/ADAPT increase optimizer or gradient overhead; recursive contraction may destroy the transportation structure. Ascending CVaR could address tail saturation, but requires a separately frozen schedule and finite-shot study. No claim is made that these were experimentally rejected.

Annealing requires a supported backend, coefficient precision analysis, embedding resources, and fair end-to-end timing; no annealer was available. Hybrid large-neighborhood search could use quantum residual subproblems, but the classical counterpart must receive the same decomposition and incumbent. Direct minimum-cost flow is a particularly strong classical direction for the present formulation. Extensions that make the problem harder must represent actual application needs, not be invented to favor quantum methods.

## Resource interpretation

Reported synthesis uses rz/sx/x/cx, all-to-all connectivity, and representative nonzero angles. It is not routed hardware execution. Reduced circuits above eight qubits are explicitly marked uncompiled; statevector studies stop above twelve reduced qubits. Dense oracle tables and generic state preparation may dominate gate count even when the logical register shrinks. Resource and timing fields distinguish table preparation, optimization, validation, sampling, representative synthesis, and transfer training. All results are local classical simulations.
