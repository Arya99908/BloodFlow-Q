# Deployment preparation

**Status:** the Vite dashboard and FastAPI backend are deployed on Vercel. See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for live URLs and provider settings.

## Repository findings

The repository is a source checkout with no Git metadata in this workspace, so a Git commit history or remote could not be inspected. The visible tree has the following deployment-relevant pieces:

- **Frontend build:** React 18 and Vite. Run `npm ci` from `frontend/`, then `npm run build`. Vite writes static files to `frontend/dist/`. There is no frontend server-side rendering or API process bundled into the assets. The checked-in `frontend/package-lock.json` is the dependency lock used by `npm ci`.
- **Backend startup:** the development script runs `uvicorn backend.main:app --reload` on port 8000. The new production launcher is `scripts/start-backend-production.sh`; it does not pass `--reload`, enforces production mode and an explicit CORS allowlist, and defaults to `0.0.0.0:8000` for a container or service runtime.
- **Python dependencies:** `requirements-prod.txt` describes API/runtime packages. `requirements.txt` includes those packages plus `httpx2`, which is used by the API test client. Python requirements use version ranges, not an exact lock file; record and test resolved versions for a release.
- **Runtime files:** the backend reads the four JSON inputs in `data/` using paths relative to the source tree. The precomputed fallback endpoint reads `experiments/precomputed/hackathon_demo.json`, also by a path relative to the source tree. These files must be included in a backend image/package. Experiment reports and other files are not used by ordinary API requests.
- **Static assets:** there is no separate `frontend/public/` directory or image bundle. The favicon is embedded in `frontend/index.html`; Vite emits the JavaScript and CSS bundles into `frontend/dist/assets/`.
- **Environment variables:** `VITE_API_BASE_URL` selects the browser-visible API base URL at frontend build time. `BLOODFLOW_ENV`, `BLOODFLOW_CORS_ORIGINS`, `BLOODFLOW_API_HOST`, and `BLOODFLOW_API_PORT` configure the backend process. No API key or credential is currently required.
- **CORS:** development currently permits only the two local Vite origins. Production requires an explicit comma-separated list of exact HTTPS frontend origins, with no wildcard and no path. Browser credentials remain disabled.

The secret scan found no local `.env` file or private-key file in the visible source tree. `frontend/.env.example` contains only the local public API URL. Because this checkout has no `.git` directory, this finding does not verify repository history, branches, or a remote. The browser-prefixed `VITE_*` value is public build configuration and must never hold a secret.

## Deployed architecture

```text
Browser → Vercel static site: React + Vite (`frontend/dist`)
        → HTTPS Vercel Python function: FastAPI
             ├── synthetic JSON scenario files
             └── Greedy / Exact / QAOA simulator
```

The frontend and API are separate Vercel projects. Vercel terminates HTTPS, while the backend keeps the existing FastAPI route and service logic. The frontend's `VITE_API_BASE_URL` points to the API project; the API allowlist contains the exact frontend origin.

No database or API key is required for the current synthetic demo. Result history is in-memory and not durable across serverless instances.

## Configuration

### Backend process

Set these values in the hosting platform's server-side environment settings:

| Variable | Required | Purpose |
|---|---:|---|
| `BLOODFLOW_ENV` | Yes | Set to `production`. Production disables FastAPI debug mode and interactive API documentation routes. |
| `BLOODFLOW_CORS_ORIGINS` | Yes | Exact comma-separated HTTPS frontend origins, such as `https://dashboard.example.org`. Wildcard origins, HTTP origins, paths, queries, and fragments are rejected. |
| `BLOODFLOW_API_HOST` | No | Defaults to `0.0.0.0`, suitable for a container. Use the host required by the service platform. |
| `BLOODFLOW_API_PORT` | No | Defaults to `8000`; set the port expected by the hosting platform. |

`BLOODFLOW_API_HOST` and `BLOODFLOW_API_PORT` are also used by the development scripts. `BLOODFLOW_FRONTEND_HOST` and `BLOODFLOW_FRONTEND_PORT` only configure the local Vite development server; they are not production frontend settings.

Start the service from the project root with:

```sh
./scripts/start-backend-production.sh
```

The script requires `.venv/` with `requirements-prod.txt` installed. It starts one Uvicorn process without automatic reload. A single process is appropriate for the current prototype: result history is in process memory and resets when the process restarts. Do not add multiple workers while expecting shared result history.

Create the environment and install its runtime dependencies with:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-prod.txt
```

### Frontend build

Copy `frontend/.env.production.example` to `frontend/.env.production`, then replace the example host with the final HTTPS API base URL. The value is embedded in browser code and is public. The production Vite config fails the build if the URL is missing, not HTTPS, or contains credentials, a query, or a fragment.

```sh
cd frontend
npm ci
npm run build
```

Upload the resulting `frontend/dist/` directory to the static host. Rebuild whenever the API address changes; changing the hosting platform's runtime variables after the static assets have been built does not change the embedded API URL.

## Local production-mode checks

From the repository root, build against a reserved example HTTPS host. This checks production bundling and configuration validation; the placeholder host is not a reachable API:

```sh
cd frontend
VITE_API_BASE_URL=https://api.example.org npm run build
cd ..
```

Run the backend production configuration tests and the complete backend suite with the project environment:

```sh
.venv/bin/python -m unittest discover -s tests
```

For a local production server smoke test, export an HTTPS origin that matches the test client and provide backend dependencies:

```sh
export BLOODFLOW_ENV=production
export BLOODFLOW_CORS_ORIGINS=https://dashboard.example.org
./scripts/start-backend-production.sh
```

This launcher binds to the configured host and port. For actual browser testing, use a local TLS reverse proxy or a staging host whose frontend/API origins and certificates match; do not weaken the production HTTPS-origin rule just to bypass TLS setup.

## Security behavior

- FastAPI debug mode is explicitly false. `/docs`, `/redoc`, and `/openapi.json` are not registered in production mode.
- Production startup fails closed if the CORS origin setting is missing, wildcarded, malformed, or uses HTTP. CORS only controls which browser origins may read responses; it is not authentication.
- CORS credentials are disabled and the API allows only the request headers the current frontend needs.
- Unexpected server errors return a generic message. Production API errors with 5xx status codes return an error code without reflecting internal exception text. Server-side logs retain diagnostics where the service logs them.
- No API keys are needed by the current application. Do not put secrets in Vite variables, `.env.example`, the JSON dataset, or the browser bundle. Add future credentials only to a server-side secret manager or protected server environment.

## Scope and limitations

The API is publicly reachable for the hackathon demonstration and currently has no authentication, authorization, or rate limiting. It accepts synthetic scenario data only. Do not connect real clinical, patient, or operational data. The result history is not a shared database, and function cold starts or scaling can clear or split it. The deployment does not represent a clinical or hospital-ready service.
