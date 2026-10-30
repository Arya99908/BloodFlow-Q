# Juror 10 — independent final architecture ballot

**65/100, unchanged.** Verdict: advance as a synthetic research/demo engineering project; withhold production-readiness and quantum-advantage credit. Confidence high on inspected architecture and reproduced scalar-coercion defect, medium overall. Initial report remains the scope/verification record. All 15 scores remain independent:

| Category | Award / maximum |
|---|---:|
| Problem | 6/7 |
| User | 4/8 |
| Domain | 5/8 |
| UX | 4/6 |
| Architecture | 4/6 |
| Tests | 7/9 |
| Data | 5/8 |
| Classical | 8/10 |
| Quantum correctness | 8/10 |
| Quantum contribution | 3/8 |
| Experiments | 5/7 |
| Performance | 2/4 |
| Security | 2/4 |
| Adoption | 1/3 |
| Pitch | 1/2 |

## Cross-examination performed and resolutions

Read the released docket, Juror 16 initial and Juror 8 final. Reinspected current QUBO allocation, solver guard, service dispatch/error handling, schema, MILP allocation/call and result serialization. No costly/new runtime tests, external operations or application mutations.

1. **Challenge to J16 shared-results privacy framing:** The shared global list is established, but the evidence does not establish an actual private-record leak or bypass of Supabase RLS. `backend/services.py:donor_network_capabilities` explicitly separates the private donor client; `optimization_result_payload` serializes derived allocation/metrics and scenario identifiers, not every input field or donor contact. J16's statement about callers submitting private information must remain conditional: sensitive scenario IDs/facility identifiers or aggregate results could appear in publicly readable history if submitted. `synthetic: Literal[True]` (`backend/schemas.py:58`) is no provenance enforcement. **Resolution:** definite isolation/reliability defect and conditional confidentiality exposure; no observed patient/contact breach. This precision preserves my Security 2/4 without treating a synthetic demo as proven mishandling of real records.

2. **Challenge to a reassuring reading of J16's 16-qubit guard:** That guard does not protect all upstream memory. Directly verified `backend/services.py:539` builds the QUBO before line 543 calls `solve`; `quantum/qubo.py:434-443` allocates a dense square matrix and tuple copy; only then `quantum/qaoa_solver.py:363` enforces the qubit limit. `optimization/milp.py:141` also builds dense constraints, and line 169 passes no time limit. **Resolution:** J16's weakness is substantiated, while its strength applies specifically to simulator admission. No memory-exhaustion experiment was performed and no claimed measured failure rate follows. Early structural size limits and isolated deadline-bounded jobs remain architectural priorities.

3. **Accept J8's challenge to my “honest error boundary” strength:** Source confirms `quantum/ising.py:85-86` rejects zero variables, while `backend/services.py:550-554` turns that exception during solve into generic 502. J8 reports actual zero-stock/demand reproduction; I independently verified the code path, not the HTTP run. **Resolution:** retain credit for visible failure and no concealed classical substitution, explicitly withdraw any implication of universally correct error semantics. A trivial constant problem should have a deliberate labeled result or precise unsupported-case response, not an operational QAOA failure classification.

4. **Coercion severity:** My initial direct schema reproduction and J8/J9's independently attributed HTTP observations support a genuine interface defect: boolean stock becomes integer stock before domain validation. It is not evidence that ordinary well-typed scenarios produce wrong allocations, or evidence of clinical harm. **Resolution:** medium-priority research integrity/API correctness fix, higher consequence if real integrations are later enabled. The remedy is strict quantity fields plus boundary regression tests, not a rewrite of the solvers.

5. **Testing claims remain command-scoped:** My 31-test pass never established root discovery health. J8 reports 194 tests plus 21 subtests passing under `pytest tests`, while root pytest fails archived duplicate-module collection. These are compatible outcomes. I did not independently rerun J8's suite or root discovery; keep those results attributed and avoid converting archive configuration debt into a current solver-suite failure claim.

## Revision rationale and remaining uncertainty

No point change: cross-examination sharpens the scope of already-scored architecture/security concerns and corrects error-boundary wording, without establishing a new broad operational failure or overturning the tested mathematical core. The score is not calibrated to another juror's vote. The 15-category allocation remains lower-confidence outside architecture; I did not independently recompute the research artifacts or quantum advantage comparisons.

Three retained strengths: shared domain/objective/validator interfaces; injectable service and visible provenance-bearing failure paths; substantial focused mathematical/API tests and strong classical comparators. Three retained weaknesses: coercive API quantities undermine domain invariants; process-global history and incomplete compute budgets constrain deployment; service/configuration/UI maintenance surface is unnecessarily large and Python environment reproducibility remains incomplete.

Unresolved: real concurrent-load behavior, hosted authorization enforcement, complete browser request race reproduction, clean installation, and measured quantum benefit against matched classical computation. None should be reported as independently tested here.

**Tough question remains:** What measured operator benefit survives matched-budget classical comparison, and how is that result delivered through an isolated, deadline-bounded job interface rather than shared synchronous demo state?
