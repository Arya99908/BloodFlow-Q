# Precomputed demonstration results

## Why this mode exists

The live QAOA demo depends on the local Qiskit/Aer simulator. If that computation fails during a presentation, the interface can show an earlier, genuine experiment response while the API remains reachable. The UI labels it **PRECOMPUTED EXPERIMENT** and reports its capture timestamp, recorded settings, environment and source hashes. It must never be presented as a new or live calculation.

If the backend itself is offline, the frontend cannot request either live or stored data. Start the backend first; the stored JSON is served by the fixed `GET /precomputed-demo` endpoint.

## Repository artifact

`experiments/precomputed/hackathon_demo.json` contains four raw responses captured from the same FastAPI `/demo-run` route used by Live mode:

- the NORMAL compact scenario with Greedy;
- the same NORMAL case with Exact;
- the same NORMAL case with QAOA;
- the EMERGENCY DEMAND SPIKE case with QAOA and the emergency re-optimization pipeline.

Every row records its scenario ID, method, UTC timestamp, experiment configuration, unmodified API response and a reproducibility object. The artifact also records the Python and platform versions, package versions, seeded QAOA settings, objective weights, QUBO penalty weights, and SHA-256 hashes of the relevant source and synthetic input files. The raw file should be retained with the project and replaced only by a newly captured artifact with an auditable timestamp and matching reproduction metadata.

## How it was generated

From the project root, with the project virtual environment and dependencies installed, run:

```sh
.venv/bin/python -m experiments.create_precomputed_demo
```

The checked-in artifact already exists, so the script will refuse to overwrite it. To create a fresh capture, first preserve the current file under a dated name (for example, `mv experiments/precomputed/hackathon_demo.json experiments/precomputed/hackathon_demo-previous.json`), then run the command. Review the new response and provenance before making it the demonstration fallback. Do not discard or silently replace a failed or infeasible solver result.

The capture script sends actual in-process HTTP requests through FastAPI's test client to `POST /demo-run`; it does not call a separate display-only calculation. The two QAOA entries call the configured QAOA solver and local simulator. If any request fails, capture stops and does not write a partial artifact. The script refuses to overwrite the existing artifact.

The recorded QAOA setup is depth `p=1`, 256 shots, COBYLA, 10 optimizer iterations and random seed 7. It records the objective and penalty weights in the JSON alongside each result. Changing code, data or settings requires a new experiment artifact; do not edit a measured response to make it look better.

## Selecting the fallback in the UI

1. Open **Demo mode** while the backend is running.
2. If Live QAOA reports an error, leave that error visible and click **Show a PRECOMPUTED EXPERIMENT**, or select **PRECOMPUTED EXPERIMENT** at the top.
3. Use **Stored scenario and method** to select a captured row.
4. Point out the historical-result banner, timestamp and configuration/source-hash disclosure before discussing the values.

The precomputed comparison consists of stored Greedy, Exact and QAOA responses for one matching compact scenario. It is a record from the capture environment, not a current benchmark. The emergency row is an independent recorded emergency run.

## Limits

The fallback demonstrates that a prior experiment was recorded with reproducibility metadata. It cannot establish that the current machine can run QAOA, cannot update to current inventory or demand, and does not provide evidence of quantum advantage. All data are synthetic; results are not medical advice or clinical validation.
