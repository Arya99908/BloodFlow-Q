# Donor Network and Emergency Requests

BloodFlow-Q now includes two deliberately separate coordination paths:

- A deterministic synthetic walkthrough that works without accounts and never contacts people.
- An optional private, authenticated workflow backed by Supabase Auth and Postgres. It is disabled until an operator applies and reviews the database migration and supplies public project settings.

This module is for operational coordination research. It is not a clinical system, does not decide whether anyone may donate, and does not establish transfusion compatibility. The live inventory table is component-specific and separate from the aggregate JSON used by the research optimizer.

**Database setup status (2026-10-13):** The schema is applied to a new, empty Mumbai test project and its hosted RLS checks passed using only temporary fictional records. The Vercel production frontend and local development config point to that test project. Do not enter real donor or hospital contact details there. Supabase Auth email/SMS delivery has not been configured or tested. See [Supabase setup](SUPABASE_SETUP.md) for migration history, policy checks, and remaining gates.

## What the module supports

- Donor registration, profile editing, self-reported availability, separate outreach/contact-sharing consents, consent history, in-app request responses, and appointment responses.
- Hospital emergency request submission for an administrator-verified hospital account.
- Inventory-first checking against current component-specific stock records entered by verified blood-bank staff. The system reserves available stock for an open request, records a shortfall, and can offer one in-app donor request at a time.
- Role-checked appointment, centre-attendance, testing/release status, transport-assignment, dispatch, receipt, cancellation, and completion steps.
- Private row-level database access policies. Donors can read their own profile/inbox/appointments. Hospital, blood-bank, and collection-centre users see records only through relevant verified memberships and request participation. Donor contact fields are visible to authorized staff only after a donor accepts and has separately consented to sharing.

Exact blood-group-label equality is the current conservative candidate filter. It is only an operational search suggestion; it is not a compatibility determination or an eligibility assessment. The private database workflow has no verified donor/hospital coordinate source, so it orders by same city and approximate area and does not calculate or display kilometers. The standalone matching function can filter a supplied approximate distance, but the live workflow does not invent one. The request queue is ordered by critical/urgent/routine priority and then required-by time. There is no SMS/email donor outreach, map provider, GPS, external inventory connection, clinical compatibility engine, or automatic collection-team dispatch.

## Configure the optional private workflow

You need a Supabase project that you administer. Do not enable the live form until the steps below and your access review are complete.

1. Install and authenticate the Supabase CLI using its official installation instructions.
2. From the repository root, link the checkout to the intended Supabase project:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Review the migration at `supabase/migrations/202610130001_donor_emergency_network.sql`, then apply it:

   ```bash
   supabase db push
   ```

   The repository does not contain real institution, donor, inventory, or account seed records. Applying the migration creates schema and policies only.
4. In Supabase Auth, configure only the email or SMS one-time-code provider you intend to use. Delivery through SMS/email requires provider configuration and may incur provider charges. The application itself sends no donor campaign or emergency alert outside the in-app inbox.
5. In the Supabase SQL editor, an authorized project operator must create verified organization rows and assign memberships to the correct existing `auth.users.id`. Do not make a public registration endpoint for hospital or staff roles. Apply role grants only after checking the institution out of band. Add verified blood-bank-to-hospital access rows before inventory can be considered accessible. Add component inventory only when verified by an authorized blood-bank account, with a validity time.
6. Configure these **public browser settings** in `frontend/.env.local` for local development or in the frontend deployment environment:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
   ```

   These values are visible in the browser bundle. Never put a Supabase service-role key, database password, or secret key in a `VITE_*` variable. Database security must come from RLS and narrowly granted functions, not key secrecy.
7. Build and test donor, hospital, blood-bank, collection-centre, consent-withdrawal, and unauthorized-account flows using synthetic test accounts before enabling this feature for anyone else.

For organization provisioning, the operator must first create a verified `authorized_institutions` row and then insert an `institution_memberships` row that references the user's authenticated UUID. For example, after a trusted administrator has checked the account UUID in Supabase Auth, provisioning SQL can follow this pattern in the Supabase SQL editor:

```sql
insert into public.authorized_institutions
  (id, institution_type, name, city, approximate_area, verified)
values
  ('BFQ-PLATFORM', 'platform', 'BloodFlow-Q Platform Admin', 'N/A', 'N/A', true)
on conflict (id) do nothing;

insert into public.institution_memberships (user_id, institution_id, role, verified)
values ('AUTH_USER_UUID_FROM_SUPABASE', 'BFQ-PLATFORM', 'platform_admin', true)
on conflict (user_id, institution_id) do update set role = excluded.role, verified = true;
```

For a hospital/bank/centre, use the matching `institution_type` and its verified details, then assign only its approved staff roles. Never expose the service-role key to run provisioning from a browser. The migration intentionally gives browser users no permission to create institutions, grant roles, or write consent history directly. Keep operator SQL and credentials outside Git.

## Request flow and safety gates

1. A verified hospital staff account submits a component, group label, unit count, urgency, required-by time, approximate location, and representative contact. The form explicitly prohibits patient-identifying information.
2. The database checks only inventory rows that are current, component-specific, recorded by verified blood-bank staff, and reachable through a verified hospital-to-bank access record. It reserves units for this request so concurrent requests do not double-count them.
3. If enough verified stock with the same configured group label and requested component is recorded, the request enters `Stock Available`. This label match does not certify transfusion compatibility. Otherwise the request records the shortfall and permits a consented candidate search. Donors are never counted as blood units.
4. The hospital may offer one in-app request at a time to an available donor with a matching group label and nearby approximate area. A donor may accept or decline. Duplicate notices are prevented; withdrawn consent withdraws pending notices.
5. After acceptance, hospital staff may propose a visit at a verified licensed collection centre. Donor confirmation is separate. If an authorized team is registered for that confirmed centre, its staff may record the team assignment. Authorized centre staff record attendance, then record the quantity (including zero) that the centre confirms for release after its own collection, screening, testing, and review. Donor acceptance never counts as stock. The database will not allow dispatch readiness until verified inventory plus centre-confirmed quantities cover the requested amount. The prototype records the staff attestation; it does not validate medical testing or decide eligibility.
6. A verified coordinator and participating bank account must record the transport assignment before dispatch. There is no live GPS. An authorized hospital user records receipt. Verified reserved stock is decremented only when a stock request is completed after receipt; cancelled requests release their reservation.

This workflow is not a substitute for emergency services or an institution's existing blood-bank procedures. For a critical situation, use those established procedures immediately. Group labels alone never establish compatibility; licensed professionals must handle donor assessment, collection, screening, testing, compatibility review, storage, and release under applicable requirements.

## Synthetic demo

The **Emergency Blood Request** and **Donor Network** pages include a deterministic synthetic scenario: four requested units, one synthetic accessible unit, a shortfall of three, several fictional candidates, and one simulated acceptance. The final simulated centre-release step explicitly records three synthetic units and reduces the demo shortfall to zero only after its simulated collection and testing steps. This does not turn donor acceptance into inventory or assert a real test result. Each subsequent appointment, collection, testing, release, transport, dispatch, receipt, and completion action is returned by the backend and explicitly marked simulated. It does not use the database or contact anyone. It is suitable for a walkthrough, not evidence of service performance.

## What is not connected

- The blank Supabase test project is configured for the frontend, but it has no real accounts, institutions, donor profiles, requests, or inventory. Auth email/SMS delivery is not configured.
- No SMS/email emergency notifications, external blood-bank inventory, clinical compatibility engine, live map/GPS, or real collection-team dispatch integration exists.
- Dashboard coordination counts remain unavailable to ordinary users. The database aggregate is restricted to an authorized platform administrator.
- RLS behavior has been exercised against the blank test project with rollback-safe fictional rows. The checks are not a security certification, and real use would require provider setup, browser-client role testing, institutional verification, and a separate production project.

## Local commands

```bash
./setup.sh
./dev.sh
```

Set the two public Supabase values only if you have completed the database/auth setup above. With the values blank, private profile/request flows remain disabled and the synthetic workflow remains available. See [startup guide](STARTUP.md) for first-time setup and [security and safety](SECURITY_AND_SAFETY.md) for the project-wide limits.
