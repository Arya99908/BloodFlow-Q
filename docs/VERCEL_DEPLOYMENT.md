# Deploying BloodFlow-Q with Vercel

## Live deployment

- **Dashboard:** https://bloodflow-q.vercel.app
- **FastAPI service:** https://bloodflow-q-api.vercel.app
- **Health check:** https://bloodflow-q-api.vercel.app/health

The dashboard and API are separate Vercel projects. The frontend is a Vite static site; the backend is the existing FastAPI app running on Vercel's Python runtime. The frontend is configured at build time to call the API over HTTPS.

## Why there is no database

The current demo reads deterministic fictional scenarios from versioned JSON files. Benchmark history is held in backend process memory and is not durable or shared reliably across serverless instances. A database is unnecessary for serving the current synthetic demo. Add one only if the product needs durable/shared user results or configuration editing; those capabilities are outside the current prototype.

## Vercel projects

The deployment uses two projects in the `the-vipers` Vercel scope:

| Project | Root | Framework | Purpose |
|---|---|---|---|
| `bloodflow-q` | `frontend` | Vite | React static dashboard |
| `bloodflow-q-api` | repository root | FastAPI | API, synthetic JSON, classical solvers, and local Qiskit Aer simulator |

The repository root [main.py](../main.py) exports the existing `backend.main:app` for Vercel's FastAPI detection. It does not duplicate API logic. The backend reads `data/*.json` and `experiments/precomputed/hackathon_demo.json` using paths relative to the source tree; keep those files in the API deployment package.

Vercel's current FastAPI guidance runs the app as a Python function. The deployed function uses Python 3.12 and the runtime dependencies in `requirements-prod.txt`. The last deployment bundle was 277.12 MB before Vercel optimization; the documented Python function bundle limit is 500 MB. The Vercel Python runtime is platform-managed and subject to Vercel's runtime and function limits. This prototype's QAOA simulator is demonstrated only on compact cases; the full 222-variable scenario is rejected by its 16-qubit local-simulator limit.

References: [Vercel FastAPI deployment guide](https://vercel.com/kb/guide/ship-a-fastapi-app-on-vercel), [Python runtime](https://vercel.com/docs/functions/runtimes/python), and [function limits](https://vercel.com/docs/functions/limitations).

## Environment configuration

Set these in the Vercel project settings. Do not commit deployment tokens or copy Vercel's generated `.env.local` files into source control.

### API project: `bloodflow-q-api`

| Variable | Production value | Purpose |
|---|---|---|
| `BLOODFLOW_ENV` | `production` | Disables debug mode and interactive API documentation routes. |
| `BLOODFLOW_CORS_ORIGINS` | `https://bloodflow-q.vercel.app` | Allows the exact deployed frontend origin. Do not use `*`. |

These are non-secret settings. No API key or database credential is required. Deployment protection is disabled so judges can use the public API without signing in; therefore, do not submit private or real operational data.

### Frontend project: `bloodflow-q`

| Variable | Production value | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `https://bloodflow-q-api.vercel.app` | Public API base address embedded in the built browser files. |

`VITE_*` settings are visible to every visitor. Never place secrets in them. Redeploy the frontend after changing this value.

## Reproducing the deployment

Install and authenticate the Vercel CLI, then link the repository root to the relevant project before deploying. The project roots and framework settings listed above must already be set in Vercel. Deploy the API and frontend independently:

```sh
# From the repository root; selects the FastAPI project.
vercel deploy --prod --project bloodflow-q-api

# From the repository root; the Vercel project root is configured as frontend/.
vercel deploy --prod --project bloodflow-q
```

Set the environment variables in Vercel before production deploys. When creating the frontend project for the first time, set Root Directory to `frontend`, Framework Preset to Vite, and set `VITE_API_BASE_URL` to the API's HTTPS origin. For the API project, use the repository root and FastAPI framework preset.

Both Vercel projects are connected to `Arya99908/BloodFlow-Q` and use `main` for production deployments. New commits pushed to `main` trigger production builds for the frontend (`frontend/`) and API (repository root). The latest Git-triggered builds were verified Ready after the dependency-file parser fix described in the repository history.

## Post-deployment checks

1. Open the dashboard URL and confirm the page loads.
2. Open `/health` on the API URL and confirm it reports `synthetic_data_only: true` and `qaoa_available: true`.
3. Open the dashboard and confirm the scenario, banks, and hospitals load from the API.
4. Use **Demo Mode** with the compact `NORMAL` case and run QAOA. Confirm the response shows a measured bitstring and classical feasibility result.
5. Try the full scenario's QAOA method and confirm the resource limit is shown as an error, not a substitute result.
6. Run the emergency simulation and compare the actual before/after API response.

For frontend previews, also set `VITE_API_BASE_URL` to the API deployment being tested and add that preview's exact origin to `BLOODFLOW_CORS_ORIGINS`. The production frontend build does not silently fall back to the preview site's own URL as an API.

## Runtime limitations

- Vercel functions can start independently and scale to multiple instances. The `/results` list is in process memory and may reset or differ between instances; it is not persistent experiment storage.
- Cold starts and function duration depend on the Vercel plan and Python runtime. This has been smoke-tested with the compact demo and default demo QAOA configuration; it is not a latency guarantee.
- The API is public and has no authentication, authorization, or rate limiting. Use synthetic requests only.
- The full default scenario's QUBO has 222 binary variables, while the configured local QAOA simulator permits 16 qubits. QAOA returns a clear size error for that scenario. The compact Demo Mode scenario is the supported live QAOA path.
- A deployment succeeding does not establish quantum advantage, clinical validity, hospital readiness, or patient benefit.
- Keep the synthetic-only, non-clinical prototype disclaimer visible.
