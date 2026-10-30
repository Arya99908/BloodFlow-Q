# Competition demonstration

Open **Demo Mode** from Home. This live synthetic fixture has two blood banks,
two competing hospitals, O-group stock and four routes. It is deliberately small
enough for exhaustive verification and quantum controls. Historical experiments
remain under a separate expandable section; they are not newly executed results.

## Three-minute presentation

1. Keep the defaults and choose **Service-first**. Run the disruption story.
   Before disruption, both critical units are served and one community unit is
   unmet. Blocking Bank B → Critical leaves one critical unit unmet and serves
   the community unit. Explain the constrained route and remaining shortage.
2. Change to **Weighted tradeoff**, rerun, and explain why expensive critical
   shipments can lose to shortage penalties. This is a policy choice, not a
   solver malfunction. Restore service-first for the remaining presentation.
3. Run the matched method comparison. Inspect feasibility before objective gap.
   Compare warm QAOA against **Warm seed only**, not just standard QAOA: this
   control isolates the value of variational processing after LP preparation.
4. Export the JSON review plan: inputs, policy, limitations, allocations,
   shortages, configurations, failures and provenance travel with the result.

The strongest defensible story is an inspectable allocation-policy experiment
with classical certification and quantum controls. No quantum advantage, clinical
validation, lives saved or real deployment is claimed.

## Policy and scientific limits

For service-first, B bounds all possible transport burden on this fixture. The
total shortage weight is B+1; the critical shortage weight is
(total demand+1)(B+1). Integer quantities and unit urgency multipliers make a
one-unit critical improvement dominate every possible total-shortage and
transport change; a one-unit total-shortage improvement dominates transport.
MILP and exhaustive search certify optima. Heuristics and QAOA can miss them.
Weights change with inputs/routes: objective totals across scenarios are not
comparable. Compare physical unit counts instead.

This is aggregate ABO-only simulation. There is no Rh, component compatibility,
expiry, arrival deadline or vehicle routing. Time is a per-unit cost. Feasibility
means modeled constraints hold, not clinical suitability or fulfilled demand.
XY preserves its implemented exchange subspaces, not every blood-flow constraint.

Quantum runs use p=1, 128 shots, 15 optimizer iterations and a seeded local ideal
statevector/Aer simulation. Seed-only uses zero angles without a variational
optimizer. It still pays LP preparation and simulation costs. Zero-variable
instances return their exact constant value with no quantum execution.

## Reproduce and inspect

Use the repository startup instructions and installed requirements. Start the
API with `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001`.
In frontend, use `VITE_API_BASE_URL=http://127.0.0.1:8001 npm run dev -- --host 127.0.0.1 --port 5181`.
Set `BLOODFLOW_CORS_ORIGINS=http://127.0.0.1:5181` on the API when needed.
Production frontend builds require an HTTPS API URL.

`POST /demo/flagship` accepts the editable inputs and method. Run the repeated
suite with `python -m experiments.run_flagship_evaluation --output NEW_FILE.json`.
It refuses an existing output path and retains failures. The suite has eight
fixed templates, three seeds and eight methods (192 calls). It records package
versions, source hashes, seeds, policies and service wall time. This is a small
descriptive controlled experiment, not a generalization or significance claim.

Run `python -m pytest -q` and `cd frontend && npm test`. The pytest configuration
excludes archived duplicate suites while including active quantum research tests.

## Operational boundaries

Requests are limited to 1 MiB, bounded scenario collections, and two concurrent
compute jobs **per worker**. Production jobs use disposable processes with a
60-second parent deadline. Local runs use cooperative solver budgets; they do
not have the same process deadline. The client times out after 70 seconds.
Cancel display request prevents stale publication; it does not promise immediate
server cancellation. These are not fleet-wide quotas or authentication.
Serverless process support and hosted runtime limits require deployment testing.

The private pilot is disabled unless `VITE_ENABLE_PRIVATE_PILOT=true` along with
Supabase credentials. Before opting in, apply and verify
`202610250001_donor_contact_lifecycle.sql`. It restricts full profile reads and
provides a narrow consented-contact RPC. It has not been applied to a hosted DB
by this implementation. Test active acceptance, withdrawn consent, expired
acceptance, completed/cancelled requests, unaffiliated staff, anonymous access,
and donor self-access with actual database roles before enabling the pilot.

Real user feedback remains outstanding: follow [the evaluation protocol](USER_EVALUATION.md).
