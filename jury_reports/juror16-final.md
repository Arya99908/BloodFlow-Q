# Juror 16 — final independent ballot

**69/100, unchanged.** Verdict: advance as a synthetic research demonstration; withhold production-readiness, clinical-impact and quantum-advantage credit. Confidence high on local resource/security findings, medium overall, low on hosted enforcement and deployment capacity. Source `46693f6`.

| Category | Award / maximum |
|---|---:|
| Problem | 5.5/7 |
| User | 6/8 |
| Domain | 6/8 |
| UX | 4/6 |
| Architecture | 4.5/6 |
| Tests | 7/9 |
| Data | 5.5/8 |
| Classical | 8/10 |
| Quantum correctness | 7/10 |
| Quantum contribution | 4/8 |
| Experiments | 4.5/7 |
| Performance | 2/4 |
| Security | 2/4 |
| Adoption | 1.5/3 |
| Pitch | 1.5/2 |

## Cross-examination

Read the released docket and J10/J04 initial reports only. Rechecked relevant source; no consensus target was used.

**Challenge to J04's security credit:** substantive consent checks alone do not establish privacy readiness. J04 carefully distinguished source from hosted verification; I agree with that evidentiary boundary but retain 2/4 rather than J04's 3/4 security award. Independently verified SQL `may_view_donor_contact` at migration `202610130001_donor_emergency_network.sql:274-291`: accepted relationship plus current contact-sharing consent and institutional role can authorize access without any closure or expiry condition. The donor-profile SELECT policy at lines 862-865 delegates whole-row visibility to this function. To test whether closure elsewhere invalidates that relationship, I inspected `advance_emergency_request` lines 585-628: completion releases resources but does not revoke accepted notifications; cancellation withdraws only contacted notifications. **Resolution:** the persistence concern survives this source check. It is conditional on continued consent and role membership, not anonymous or universal exposure. **Unresolved:** intended retention policy, deployed migration state and actual PostgreSQL behavior were not exercised. This is source-supported risk, not a demonstrated hosted privacy breach.

**Challenge to a restrictive reading of J10's “shared synthetic result history”:** this correctly avoids claiming actual patient-record leakage, but synthetic status is not enforced provenance. `backend/services.py:528-529` returns all retained responses, while schema's synthetic label is default/caller supplied. A successful local demo does not validate contents supplied by every future caller. **Resolution:** agree with J10's no-proven-patient-leak qualification; describe the issue as potential cross-caller exposure of submitted content, and shared/ephemeral state, not an established clinical breach. No private data was submitted or inspected.

**Independent verification of J10's boundary bug:** repeated the minimal `BloodBankInput(..., inventory={'O': True})` construction in existing environment with bytecode disabled; output was `{'O': 1}`. `optimization/models.py:31-34` explicitly rejects bool units, but coercion occurs earlier. This confirms a real API/domain mismatch. It reinforces my existing Data/Security reservations rather than adding a second deduction for the same input-trust weakness.

**Solver-cap challenge and resolution:** a 16-qubit cap is useful but does not cap all work needed to reject a request. Rechecked `backend/services.py:539-545`: `build_qubo` precedes `solve`; `quantum/qubo.py:434-443` allocates dense square storage before the solver checks size. Thus pre-allocation caps and total job budgets remain necessary. No large or adversarial input was executed; O(q²) QUBO and O(2^q) statevector growth are theoretical complexity statements, not measured exhaustion. The benchmark path may have additional count checks; the confirmed finding specifically applies to the direct optimize path.

## Final evidence and rationale

My own initial bounded measurements remain: existing-environment fresh-process app/TestClient import 0.786 s; default greedy 0.0298 s, MILP 0.0113 s, default benchmark 0.0036 s, all HTTP 200. These are single in-memory samples, not deployment cold starts or throughput. My focused run passed 16 tests plus 13 subtests; no hosted RLS certification follows. Docket test/benchmark results from others are not represented as my executions.

Three retained strengths: real local solver/result guards; production-origin and error-disclosure controls; substantive optional consent/RLS architecture. Three retained weaknesses: missing pre-allocation and total compute admission budgets; global ephemeral results and caller-labelled provenance; broad Python dependency resolution and unmeasured deployment/runtime completion behavior. Cross-examination sharpened the contact-retention and bool-coercion findings but did not remove these strengths or alter the already-discounted maturity assessment. Therefore every category and the total remain unchanged.

Decisive question remains: demonstrate enforced pre-allocation request limits, a total compute deadline and concurrent-job budget for the public optimizer, without relying on CORS or process termination by the host.
