# BloodFlow-Q final hackathon demo

This run of the demo takes about four minutes at a steady pace. It uses the bundled fictional data and the backend's fixed compact demo scenarios. QAOA is executed live on the local simulator for the compact case; the dashboard's full scenario is shown separately and is not sent through the size-limited QAOA simulator.

## Before the presentation

1. In a terminal, open the project folder and run `./dev.sh`. If it says a port is already occupied, stop the old server in its original terminal with Ctrl+C, then retry. Do not leave an older API process running beside the current frontend.
2. Wait for both the API and Vite development server to report that they are ready.
3. Open `http://127.0.0.1:5173/` in a browser.
4. Check that the Dashboard has loaded the synthetic scenario. Open **Demo mode** before presenting and confirm the three scenario cards appear. This also checks that the running backend has the current demo routes. Do not start a benchmark or QAOA run before presenting; the demo will make its own real requests.

## Four-minute click-by-click script

| Time | Exact clicks | What should appear | Presenter can say |
|---|---|---|---|
| 0:00–0:20 | Open **Dashboard**. | Inventory, demand and current status loaded from the backend. | “This prototype uses fictional logistics data. It is for allocation research, not patient-level decisions.” |
| 0:20–0:40 | Left navigation → **Blood banks**. | The backend's bank records and inventory by supported group. | “These are available units at each synthetic source.” |
| 0:40–1:00 | Left navigation → **Hospitals**. | The backend's demand, urgency category and location. | “Demand and urgency are scenario inputs. They do not describe real patients.” |
| 1:00–1:25 | Left navigation → **Dashboard** → click **RUN OPTIMIZATION**. | The dashboard starts the real Greedy baseline on the full default scenario and opens Optimization with its returned allocation and validation. | “This is the full small logistics scenario through the classical baseline.” |
| 1:25–1:40 | Left navigation → **Demo mode**. Select **NORMAL**. Select **Greedy baseline** and click **RUN DEMO**. | The API returns the compact, one-bank/one-hospital synthetic case result. The comparison table receives the Greedy row. | “For the quantum comparison, we use a deliberately compact case that fits this laptop's local simulator limit.” |
| 1:40–1:55 | Set method to **Exact small-instance solver** → click **RUN DEMO**. | Actual exact result and feasibility report; Greedy and Exact remain in the comparison table. | “Exact search gives a reference optimum on this tiny case; it is not intended to scale.” |
| 1:55–2:30 | Set method to **QAOA local simulator**. Keep the displayed default settings and click **RUN DEMO**. | Live QAOA request, QUBO variable count, depth, shots, measured bitstring, decoded allocation, classical feasibility report, and Greedy/Exact/QAOA comparison. The result is allowed to be infeasible; the page must show that status and violations. | “QUBO defines the binary optimization problem. QAOA samples candidate bitstrings, which we decode and validate classically. A measured sample is not automatically feasible or optimal.” |
| 2:30–2:45 | In the scenario cards select **EMERGENCY DEMAND SPIKE**. Leave method as QAOA. Click **RUN DEMO**. | The API runs the emergency re-optimization pipeline. Wait for it to finish; do not narrate progress as a result. | “Now the backend changes one synthetic hospital's demand and urgency, rebuilds the problem, and runs the selected method again.” |
| 2:45–3:30 | Scroll the output panel to **Before / after metrics**, **New allocation**, and **Allocation changes**. Expand **Classical validation report** if useful. | The exact event, demand/urgency change, returned allocations, before/after unmet demand, critical satisfaction, transport cost and feasibility. Values come from this API response. | “This comparison is calculated from the original and changed scenarios. The optimizer produces the new allocation; it is not scripted into the page.” |
| 3:30–4:00 | Point to the result label and configuration disclosure. | `LIVE COMPUTATION · NEW API RESPONSE`, run settings, validation, and full response disclosure. | “These are local measured simulator results under the shown settings. They do not establish quantum advantage or clinical performance.” |

## Expected API requests

The browser should make these requests as the presenter follows the steps:

- `GET /scenario` as the data pages load.
- `GET /demo-scenarios`, `GET /experiment-defaults`, and `GET /precomputed-demo` when Demo mode opens. The precomputed request only loads the saved fallback; it does not run a solver.
- `POST /optimize` with `method: "greedy"` when **RUN OPTIMIZATION** is clicked on Dashboard.
- Three `POST /demo-run` requests with `scenario_id: "normal"` and methods `greedy`, `exact`, and `qaoa` for the method comparison.
- One `POST /demo-run` with `scenario_id: "emergency_demand_spike"` and `method: "qaoa"`. The service applies the fixed event and calls emergency re-optimization, then the QAOA solver on the modified scenario.

The browser does not contain a second implementation of the optimizer. If your browser's developer tools are open, use the Network panel to verify request payloads and responses.

## If something fails

- **Data page or scenario list fails:** use its visible Retry control. If the API cannot load, stop and explain that the live demo is unavailable; do not narrate stored data as current data.
- **Greedy or Exact fails:** show the returned error. These rows are not replaced with saved measurements in Live mode.
- **QAOA fails:** keep the displayed error visible. Click **PRECOMPUTED EXPERIMENT** or, after a failed QAOA request, click **Show a PRECOMPUTED EXPERIMENT**. Choose the stored NORMAL method comparison or the emergency demand-spike QAOA record. Its banner says `PRECOMPUTED EXPERIMENT · HISTORICAL API RESPONSE`; explain its capture date and settings. It is not a live computation.
- **Precomputed endpoint fails:** the application needs the backend running to serve the checked-in artifact. Restart the backend using `./dev.sh` or `./scripts/start-backend.sh`; if the endpoint remains unavailable, skip the fallback and report the live failure.
- **QAOA returns an infeasible candidate:** keep it on screen. Expand the validation report and explain the violations. Do not delete, repair, or substitute a different candidate during the presentation.
- **A run takes longer than the allotted time:** do not claim it completed. Stop waiting and explain the actual state/error. For a reliable short run, preserve the documented small demo instance and default settings.

## Safety statement

BloodFlow-Q is a research prototype for operational optimization using synthetic data. It is not a clinical transfusion decision system. Compatibility is simplified for the prototype and is not a complete transfusion compatibility model. The demo must not be described as clinically validated, deployed in hospitals, or evidence of quantum advantage.
