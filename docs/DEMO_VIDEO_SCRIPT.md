# BloodFlow-Q hackathon demo video script

**Target runtime: 2 minutes 55 seconds.** The timings include navigation and short live-computation waits. Speak at a natural, clear pace; use the displayed API values, never pre-written numerical results.

## Before recording

1. Start the app with `./dev.sh` and open `http://127.0.0.1:5173` in a clean browser session.
2. Confirm the Dashboard loads. In **Demo mode**, verify that the three fixed scenarios load and that a live **NORMAL → QAOA** run succeeds. Do not record a result from a previous session as a live run.
3. Confirm the emergency form is set to a valid synthetic demand-spike event and that it completes. Make sure the Results page can run its benchmark.
4. Open a code editor at `quantum/ising.py` and `quantum/qaoa_solver.py` for the brief circuit-code insert. The website reports QAOA settings and measurements; it does not draw a circuit diagram.
5. Record the screen and team voices together. No result value is scripted below because live values depend on the measured run.

## Timed script

| Time | Presenter and screen action | Spoken script |
|---|---|---|
| **0:00–0:12** | **Member 1 on camera**, then cut to Dashboard cards and network overview. | “We’re the BloodFlow-Q team. We built a research prototype that studies how fictional blood-bank inventory could be allocated across fictional hospital demand. This is logistics research, not a clinical decision system.” |
| **0:12–0:31** | Screen capture: open **Blood banks**, then **Hospitals**, then **Network**. Select one route to reveal its details. | “The bank and hospital pages show the scenario’s actual synthetic inventory, demand, urgency, and locations. The network page connects those locations and lets us inspect route time, distance, cost, and availability.” |
| **0:31–0:48** | **Member 2 speaks on camera** for the first sentence, then cut to the architecture diagram and **Optimization**. Show the scenario summary and method selector; run **Greedy** with **RUN OPTIMIZATION**, then show its allocation and feasibility. | “The React site calls FastAPI; FastAPI passes requests to one shared Python optimization layer. Here the deterministic greedy baseline returns shipments, which are checked against inventory, demand, compatibility, and route rules.” |
| **0:48–1:08** | Open **Demo mode**. Point out **LIVE COMPUTATION** and the NORMAL, EMERGENCY DEMAND SPIKE, and TRANSPORT DISRUPTION choices. Run NORMAL with Greedy, then Exact. | “Demo mode uses fixed, reproducible, compact scenarios. Here we compare a fast heuristic with exact search on a tiny instance. Exact is useful as a reference, but its search is deliberately limited to small cases.” |
| **1:08–1:43** | Keep NORMAL selected, choose **QAOA local simulator**, show the displayed depth, shots, seed, optimizer, and penalty settings; click **RUN DEMO**. While it runs, briefly show the QUBO-to-Ising code and the circuit construction and `AerSimulator.run` call in `quantum/qaoa_solver.py`. Return to the response: show measured bitstring/counts, decoded allocation, and validation. | **Member 2:** “QUBO encodes the allocation objective and constraint penalties as a binary cost. We convert that cost to an Ising Hamiltonian. The QAOA circuit alternates cost and mixer layers; a classical optimizer tunes its parameters, and Qiskit Aer samples the circuit for the configured shots. The decoder follows the QUBO variable map, then the classical validator checks the candidate. A measured bitstring is not automatically feasible or optimal.” |
| **1:43–2:08** | Open **Emergency simulation**. Show the normal-to-event workflow, set a synthetic demand spike and critical urgency, select Greedy, click **SIMULATE EMERGENCY**. Show changed demand and the returned before/after metrics and allocation changes. | “The emergency simulator copies the original scenario, applies the event, and asks the optimizer to solve the modified case. This before-and-after allocation comes from the API response; it is not hard-coded. The same page supports inventory changes, route disruption, and priority changes.” |
| **2:08–2:25** | Open **Results**. Run the displayed benchmark; show its returned table and charts. Cut briefly to Demo mode’s **PRECOMPUTED EXPERIMENT** toggle and historical label. | **Member 3:** “These metrics are from this benchmark response. Methods skipped at the full-scenario limit stay marked unavailable; compact-case QAOA is compared in Demo mode. Precomputed results are timestamped history, never live.” |
| **2:25–2:39** | Open **About / Methodology** and trace the visual workflow from allocation through QUBO, Ising, QAOA, measurement, decoder, and validation. | “QUBO is the optimization formulation; QAOA is the algorithm. The full workflow is hybrid: classical code prepares and checks the problem, while the circuit samples candidates.” |
| **2:39–2:55** | **Members 1, 2, and 3 on camera**; final frame shows the project name and GitHub repository. | “Our scenarios are synthetic, and compatibility assumptions are simplified. These experiments do not show quantum advantage, clinical validity, hospital deployment, or patient outcomes. BloodFlow-Q is an operational research prototype. Thank you.” |

## Live-run and fallback rules

- Speak the depth, shot count, bitstring, objective, and feasibility exactly as the live response displays them. Do not promise a particular allocation or score.
- If QAOA fails, leave the real error visible. If time permits, switch to **PRECOMPUTED EXPERIMENT** and say that it is a previously measured, timestamped result with saved configuration. Never present it as a live run.
- If a candidate is infeasible, show its validation report and violations. Do not repair, hide, or replace it.
- If the run takes longer than the time slot, keep the status visible and explain that the computation has not completed. Do not use a fake progress animation or claim a result.
- If an entire section must be cut for time, retain the scientific-limit statement at the end and keep the recorded video under three minutes.
