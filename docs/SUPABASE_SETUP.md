> Private pilot gate: apply and role-test `202610250001_donor_contact_lifecycle.sql` before setting `VITE_ENABLE_PRIVATE_PILOT=true`. URL/key configuration alone intentionally leaves the pilot disabled. See [competition deployment boundaries](COMPETITION_DEMO.md#operational-boundaries). The migration has not been applied to a hosted database by the implementation task.

# Supabase setup record

This guide records the disposable Supabase project used to verify BloodFlow-Q's donor/emergency database setup. It contains schema only; it has no real donor, hospital, patient, or contact records.

## Test project

- Project name: `bloodflow-q-donor-test`
- Region: Mumbai (`ap-south-1`)
- Project reference: `cqwezdqjcpvpojzpasgm`
- Public project URL: `https://cqwezdqjcpvpojzpasgm.supabase.co`
- Database version checked: PostgreSQL 17.11
- Status at setup: active and healthy

This is a test project, not a production data environment. The public URL and publishable key are configured for the frontend, but the project contains no personal records. Never add real contact details to this test project.

## Migration history

The schema was applied using the repository's Supabase CLI migrations:

1. `202610130001_donor_emergency_network.sql` — tables, functions, grants, and row-level security policies.
2. `202610130002_revoke_anon_collection_release.sql` — closes an anonymous execution grant found by the Supabase security advisor.
3. `202610130003_revoke_direct_trigger_rpc.sql` — prevents authenticated browser clients from directly calling internal trigger handlers.

All three versions are present in the linked project's migration history. To inspect before applying to another project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list --linked
supabase db push --linked --dry-run
supabase db push --linked
```

Review each SQL migration before pushing it to any project containing data. `db push` is a schema change; it is not a data-import step.

## Access-policy verification

The live project was checked with `supabase/tests/donor_emergency_rls.test.sql`. The test creates fictional identities and rows within a PostgreSQL subtransaction and deliberately rolls that subtransaction back. It checks 14 conditions, including:

- RLS is enabled on all 14 coordination tables.
- Anonymous access to private tables and selected coordination functions is denied.
- Internal audit/withdrawal trigger functions are not directly executable by authenticated clients.
- Donors see only their own profile and inbox.
- Hospital staff see requests belonging to their verified institution.
- Donor contact is hidden before acceptance and separate contact-sharing consent, visible to the associated hospital after both conditions, and hidden from another hospital.
- Synthetic fixture records are absent after the test.

The 14 checks completed successfully on the linked project, and the database was confirmed to contain zero fixture donors, institutions, requests, or notifications afterward. The Supabase security advisor no longer reported anonymous access to a security-definer function. It continues to flag authenticated security-definer RPCs generically; those are intentionally callable workflow functions with checks inside them, and they still require periodic review as the schema changes.

To run the checks against the linked hosted project:

```bash
supabase db query --linked --file supabase/tests/donor_emergency_rls.test.sql
```

The CLI needs an authenticated Supabase account and a linked project. A local `supabase test db` run uses Docker; Docker was unavailable on the setup machine, so the same rollback-safe assertions were executed against the dedicated blank test project instead.

## Frontend configuration

The following public settings are installed:

- `frontend/.env.local` for local Vite development. It is ignored by Git and has owner-only file permissions.
- Vercel `Production` environment for the `bloodflow-q` project.

The configured values are `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. A publishable key is designed to be visible in a browser bundle. Database protection comes from authentication, grants, and RLS. A Supabase secret/service-role key and the database password were not placed in frontend configuration, source control, or this document.

To verify only the variable names and deployment target without printing their values:

```bash
vercel env ls --project bloodflow-q
```

Never use `vercel env pull` in a way that prints the resulting file contents into a shared log. Do not commit `frontend/.env.local`.

## Remaining setup before real people or institutions

- Supabase Auth email/SMS delivery is not configured or tested; no email or SMS was sent during this setup.
- No test donor, hospital, staff, or blood-bank accounts were created. The RLS checks used temporary fictional rows only.
- No verified institutions, staff memberships, blood-bank access, or inventory were provisioned.
- The deployed frontend is pointed at this empty test project. Keep it a demo/test environment. Do not enter personal donor contact information or real hospital representative information here.
- Before a separate production project is considered, configure and test its Auth delivery, create synthetic role-specific test accounts, exercise the policies through the actual browser client, review all workflow RPC authorizations, and repeat the access tests there.

BloodFlow-Q remains an operational research prototype. Blood group labels, donor responses, and inventory values do not establish clinical compatibility, donation eligibility, or safe transfusion. Authorized professionals and licensed facilities must handle all clinical screening, testing, compatibility decisions, collection, storage, and release.
