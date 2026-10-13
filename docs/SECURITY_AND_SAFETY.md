# BloodFlow-Q Security and Safety Review

**Review date:** 2026-10-06  
**Scope:** Current local prototype source, checked-in project files visible in this workspace, synthetic data, frontend/API boundary, and automated tests.

## Safety boundaries

BloodFlow-Q is an operational logistics research prototype. It does not decide whether an individual patient should receive blood, provide clinical advice, or claim clinical validity. Its allocation outputs are aggregate synthetic scenario results only. They are not orders, dispatch instructions, or recommendations for care.

## Synthetic data policy

- The four files under `data/` are marked synthetic and use fictional labels such as Bank A and Hospital 1.
- Route measures, inventory, demand, urgency categories, and weights are example values, not observations about real organizations or deliveries.
- Input scenarios supplied to the API must declare `synthetic: true`; Pydantic request models reject other values.
- Compatibility is a simplified modeling assumption. It is not a complete transfusion compatibility system and is not approved for use with people.
- Do not import operational data from a hospital, blood bank, transport provider, or patient system into this prototype.

## Patient-identifying information

No real patient-identifying information is intended or present in the supplied synthetic dataset. The current data files contain fictional organization labels and aggregate counts; they do not contain patient names, dates of birth, medical record numbers, addresses, phone numbers, or patient-level records.

This is a source and dataset review, not a guarantee about files that may be added later. Review any new data before use, and reject data that is not synthetic and aggregate.

## Security checks performed

- Searched project source and data files for likely credentials, API keys, private-key files, email addresses, and phone-number patterns. No secret value or patient-like contact value was found in the files reviewed.
- Inspected environment-variable use. `VITE_API_BASE_URL` only selects the public API base URL and is not a credential.
- Confirmed local environment files are excluded by `.gitignore` while `.env.example` remains shareable.
- Inspected API input models: extra fields are rejected; urgency and route enums are constrained; numeric fields reject negative, infinite, or NaN values where applicable; exact-search request limits are capped at 50,000 states.
- Inspected API routes for caller-controlled file paths and shell execution. No route accepts a filesystem path, and the application contains no subprocess or shell execution calls. The data loader accepts a path only as a local Python function argument and reads four fixed filenames; this is not exposed through the HTTP API.
- Restricted CORS to the two local Vite origins and disabled credential sharing because the prototype has no cookie or session authentication.
- Changed unexpected optimizer failures to log diagnostics on the backend and return a short method-specific error to the API caller, without reflecting exception text or tracebacks.
- Ran the automated integration suite, including malformed input, malformed JSON files, optimizer errors, and QAOA resource/configuration cases.

## Environment-variable policy

Only public configuration belongs in frontend `VITE_*` variables. Vite embeds those values in browser-delivered files, so they must never contain API keys, passwords, private tokens, or other secrets. `VITE_API_BASE_URL` is a public network address, not a secret.

If future integrations require credentials, store them only in server-side environment variables or a dedicated secret manager. Do not commit local `.env` files, print secret values in logs, or return them in API responses. Keep `.env.example` limited to harmless placeholders and public settings.

The optional donor and hospital coordination module uses Supabase Auth and Postgres when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are supplied. These are public browser settings, not secrets. Never put a Supabase service-role or secret key in the frontend. A new, empty Mumbai test project is configured for local and Vercel frontend builds. Three migrations are applied and 14 rollback-safe RLS/privilege assertions passed with fictional identities and contacts. The database still has no real accounts, donor profiles, requests, institutions, or inventory. Email/SMS Auth delivery is not configured. See [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) for project details and remaining setup gates.

## CORS and deployment

Development allows requests from `http://localhost:5173` and `http://127.0.0.1:5173`, with credentials disabled. Production mode now requires an explicit `BLOODFLOW_CORS_ORIGINS` allowlist of exact HTTPS frontend origins, disables FastAPI debug/docs routes, and sanitizes server-error details returned to clients. These CORS controls do not provide authentication. Before public or organizational exposure, review transport security, authentication, authorization, rate limits, request-size limits, logging, and data retention.

The optimization FastAPI API remains unauthenticated and uses only synthetic aggregate scenarios. It does not expose donor records. The optional donor/emergency workflow is separate and uses Supabase Auth plus database policies when configured. Do not connect the optimizer API to live inventory or hospital systems. Keep development services bound to localhost unless you understand the network exposure.

## Known limitations and follow-up risks

- API request bodies and collection sizes do not yet have a global size limit. A local caller can submit unusually large scenarios and consume memory or CPU; add request-size limits before any shared deployment.
- The exact solver's candidate-state request cap is fixed at 50,000 through the API, but normal API traffic still has no rate limit or authentication.
- QAOA is bounded by the solver's configured local qubit limit, but simulator runtime and memory still depend on the machine and chosen circuit settings.
- Result history is held in process memory, limited to recent operations, and disappears when the backend restarts. It is not an audit log or durable record.
- The frontend may be configured with a different public API URL at build time. Deployments must verify that it points to a trusted backend and uses HTTPS.
- The project is now connected to its private GitHub repository. The current source tree was scanned for likely credential patterns and local secret/key files before pushing. This scan is not a guarantee about credentials that may have existed in other historical copies; keep secrets out of Git and rotate any credential if one is ever exposed.
- Compatibility, urgency, and transport values are synthetic assumptions. No clinical or operational safety conclusion can be inferred from a successful software test.
- The Supabase role policies have been tested against a blank hosted test project for donor self-access, hospital request isolation, consent-gated contact visibility, and anonymous denial. Auth provider delivery, actual browser-session flows, blood-bank/collection-centre workflows, and a separate production project are not yet configured or tested. The security advisor still emits generic warnings for authenticated security-definer workflow RPCs; each function must retain its internal authorization checks and be re-reviewed after changes.
- Donor group-label filtering is exact-label matching for conservative coordination suggestions. It is not a blood-component compatibility engine, donation eligibility assessment, or transfusion safety check.

## Change record

This review did not add real patient information. The related code hardening disables credentialed CORS requests, caps API-requested exact search at the documented 50,000-state limit, and prevents unexpected internal exception strings from being returned to clients.

Deployment preparation added a production-specific exact-origin CORS policy, a no-reload API launcher, disabled production API documentation routes, and a build-time HTTPS check for the public frontend API URL. See [`DEPLOYMENT.md`](DEPLOYMENT.md). The absence of a Git directory still prevents verification of committed history.
