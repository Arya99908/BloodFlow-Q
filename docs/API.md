# Local BloodFlow-Q API

The FastAPI layer delegates to `backend/services.py`. Route functions do not
contain allocation algorithms: they validate requests, call the service, and
return typed responses. The service invokes the existing Greedy/Exact solver,
benchmark runner, emergency pipeline, and local QAOA simulator.

## Start locally

From the project root, create the local Python environment and install the API
dependencies:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/uvicorn backend.main:app --reload
```

In development, the interactive request page is available at
`http://127.0.0.1:8000/docs`. The local React/Vite origins
`http://localhost:5173` and `http://127.0.0.1:5173` are allowed by CORS.
Production mode disables the interactive documentation routes and requires an
exact HTTPS frontend origin in `BLOODFLOW_CORS_ORIGINS`; see
[`DEPLOYMENT.md`](DEPLOYMENT.md).

## Endpoints

- `GET /health` — service status, synthetic-data flag, and whether a QAOA
  adapter was configured.
- `GET /scenario` — the validated bundled synthetic scenario.
- `POST /optimize` — Greedy by default; supports Exact for tiny scenarios and
  QAOA when explicit QUBO penalty weights are supplied.
  QAOA responses include the variable count, depth, shots, and measured best
  bitstring when those values were returned by the solver; classical responses
  leave those QAOA-only fields empty.
- `POST /simulate-emergency` — apply one typed event and report optimizer
  output before and after. QAOA runs include separate measured sample summaries
  for the before and after scenarios; classical runs return null summaries.
- `POST /benchmark` — compare Greedy and Exact. Set `include_qaoa` to true and
  provide QUBO penalty weights to run a measured local QAOA sample. Without
  that request, QAOA metrics remain null and marked `not_requested`.
- `GET /demo-scenarios` — return the fixed deterministic demo scenario IDs.
- `GET /experiment-defaults` — return backend-reported default QAOA and
  objective settings.
- `POST /demo-run` — execute one selected fixed demo scenario and method
  through the same service and optimization engine as the other endpoints.
- `GET /precomputed-demo` — read the repository's fixed historical experiment
  artifact. This does not execute an optimizer; the payload is labeled
  `PRECOMPUTED EXPERIMENT` and includes run settings and provenance.
- `GET /results` — recent request results held in process memory. Restarting
  the server clears this list.

Requests use Pydantic models. Unknown fields and malformed or inconsistent
scenarios return a readable `422` response. QAOA requires explicit penalty
weights and respects its local qubit limit; oversized requests return `422`.
Simulator failures return `502`; unexpected internal failures return a
sanitized `500` response without a traceback.

All example data is synthetic. The API is an operational/logistics research
prototype, not a clinical decision system.
