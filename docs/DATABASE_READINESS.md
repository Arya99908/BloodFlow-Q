# BloodFlow-Q database and synthetic-demo readiness

**Checked:** 13 October 2026
**Supabase project:** `bloodflow-q-donor-test` (Mumbai region)
**Data policy:** synthetic fixtures only; no personal donor or patient records were entered.

## What is ready

- The frontend is connected to the Supabase project with its public project URL and publishable key. The publishable key is browser-visible by design; it is not a service-role key.
- Supabase migrations `202610130001`, `202610130002`, and `202610130003` are present both locally and remotely.
- The donor/emergency access-policy SQL check completed successfully. Its fictional fixture rows are rolled back by the test itself.
- A direct anonymous request to read donor profiles returned HTTP 401 (`42501` permission denied).
- The donor-profile, emergency-request, and donor-notification tables each contained zero rows at verification time.
- No donor sign-up, request, or contact information was submitted as part of this check.
- A production QAOA smoke request on the normal synthetic scenario completed with depth `p=1`, 32 configured and observed shots, 10 QUBO variables, a 10-bit measured candidate, zero validation violations, and no classical repair. This confirms execution only; it is not an optimization-quality or speed claim.

## GitHub connection versus donor sign-in

The Supabase project is linked to the GitHub repository for project/migration integration. That does not automatically turn on GitHub OAuth for BloodFlow-Q users. The Supabase Auth settings currently report GitHub as disabled. The app's private donor sign-in uses email or SMS one-time codes instead. Code delivery depends on the Supabase project's email/SMS provider settings; this check did not send a code to anyone.

## Synthetic features that can be exercised now

Use the app's clearly marked synthetic experiences to test these workflows without a live account or external delivery:

1. **Donor Network → Synthetic donor profile sandbox**
   - Register and edit a sample profile.
   - Change blood group, contact preference, availability, and the two separate consent flags.
   - Withdraw both consents and confirm the profile switches to Do Not Contact.
   - View simulated registration and last-updated timestamps.
   - The sandbox is in-page state only. It is never saved to Supabase and sends no messages. Use fictional values only.
2. **Donor Network → Interactive donor inbox demo**
   - Load the fixed deterministic synthetic request.
   - Accept or decline the contacted sample donor. Declining advances to a new candidate; the same candidate is not contacted twice.
3. **Emergency Blood Request → deterministic demo request**
   - Follow the synthetic 4-unit request, one accessible synthetic unit, and three-unit shortfall through donor response, appointment, collection, testing, release, transport, hospital receipt, and completion.
   - Cancel the synthetic request at any active stage. Cancellation is terminal in the demo.
   - Every simulated action is marked as simulated; it does not change Supabase inventory, contact donors, or assert that real transport happened.
4. **Optimization, QAOA, results, and emergency re-optimization**
   - Continue using the existing deterministic synthetic scenarios and actual backend optimization pipeline. QAOA is a local-simulator computation when it completes; the UI reports its actual status and errors.

## Live database paths

The authenticated donor and authorized-hospital pages use the Supabase frontend client and database policies. The FastAPI coordination endpoints do not read or write private Supabase rows. Live dashboard counts therefore remain unavailable until an authorized platform administrator signs in and the counts query is permitted. Empty/unavailable live counts are not replaced by made-up values.

The dashboard now distinguishes four cases instead of showing the same generic “Unavailable” label for each card:

- **Sign in**: no Supabase session is active in this browser.
- **Admin only**: the signed-in account is not a verified platform administrator.
- **Query error**: the database query failed for another reason.
- **A number, including 0**: the authorized metrics function returned that actual count.

The public dashboard must not query donor tables directly or relax database permissions to make the cards visible. Use **Sign in to view counts** to open the private account page. The database must also contain a verified `platform_admin` membership for that signed-in user; signing in alone does not grant that role. This avoids exposing donor-network aggregates or contact records to public visitors.

To test live account access later, first configure and verify the intended Supabase email or SMS delivery provider. Use a test identity that you control and only after reviewing the current RLS policies. This readiness check deliberately did not transmit a phone number, email address, OTP, or other personal data.

## Repeat the safe checks

From the repository root:

```sh
supabase migration list --linked
supabase db query --linked --file supabase/tests/donor_emergency_rls.test.sql
.venv/bin/python -m pytest -q
```

The SQL policy check uses fictional reserved-domain accounts and a rollback block. Do not remove the rollback block or substitute real identities.

For a local frontend production build, supply the public API URL:

```sh
cd frontend
VITE_API_BASE_URL=https://bloodflow-q-api.vercel.app npm run build
```

## Explicit external-service boundary

The prototype provides a complete **synthetic coordination walkthrough**, not live donor outreach or blood logistics. It has no connected SMS/email sender, live location/GPS, real collection-team dispatch, blood-centre inventory feed, or confirmed transport tracking. Those are external operational integrations that cannot truthfully be simulated as real. Their synthetic counterparts are labeled in the UI, and the live coordination API reports that it does not access private Supabase records.

The prototype is for operational research with synthetic data. It is not a clinical transfusion decision system; blood-group labels do not establish eligibility or compatibility, and licensed facilities and authorized professionals must perform collection, screening, testing, compatibility verification, storage, and release.
