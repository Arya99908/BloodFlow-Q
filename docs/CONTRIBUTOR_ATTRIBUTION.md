# BloodFlow-Q: Contributor Attribution & Engineering Provenance

**Date:** 2026-10-30  
**Integration Reference:** `integration/bloodflow-unified-2026`

BloodFlow-Q is the product of collaborative engineering across three core contributors. In adherence to strict scientific and engineering integrity standards, this document explicitly records the provenance of all major subsystems.

---

## 1. Contributor: Rahul Arya AV (`Arya` / `Arya99908`)
* **Core Inventions & Codebases:**
  - **Foundational Architecture:** Created the primary domain architecture (`optimization/models.py`), typed Pydantic API schemas (`backend/schemas.py`), and the decoupled feasibility validator (`optimization/constraints.py`).
  - **Algebraic QUBO Formulation:** Formulated the quadratic binary penalty mapping and exact Ising transformation (`quantum/qubo.py`, `quantum/ising.py`).
  - **Network Graph Visualization:** Authored the interactive SVG-based Network Explorer (`frontend/src/pages/Network.jsx`, `frontend/src/utils/networkGraph.js`), implementing responsive pan/zoom, bounding box auto-centering, and dynamic shipment route overlays.
  - **Research & Unimodularity Proofs:** Conducted the literature review (`research/quantum_experiments/LITERATURE_REVIEW.md`) and authored the mathematical proof of total unimodularity in bipartite transportation matrices (`NECESSITY_EVIDENCE.md`).
  - **Comparative Evidence Interface:** Created `ComparativeEvidenceExplorer.jsx` and the automated evidence compilation toolchain (`experiments/build_comparative_evidence.py`).

---

## 2. Contributor: Shreesha KS (`Beezsy-del` / `Beezly`)
* **Core Inventions & Codebases:**
  - **Continuous LP Relaxation:** Implemented `solve_relaxation` in `optimization/milp.py` using SciPy HiGHS, providing the foundational fractional baseline for warm-start initialization.
  - **Warm-Start Register Interpolation:** Solved the binary register fractional mapping defect by authoring `encode_register_probabilities` in `quantum/qaoa_solver.py`, ensuring integer quantities yield exact binary states and fractional values interpolate smoothly.
  - **Hamiltonian Normalization:** Implemented `normalize_ising` to scale Pauli operators uniformly, stabilizing classical optimization trajectories on steep penalty surfaces.
  - **Multi-Restart Optimizer Loop:** Architected the multi-restart parameter search ($1 \le r \le 10$) that evaluates variational basins without consulting exact ground-state answers.
  - **XY-Mixer Gates:** Implemented constrained XY-mixer ansatz circuits preserving initial particle/excitation numbers.
  - **Benchmarking & Verified Audits:** Conducted the verified 36-run warm-start study (`audit/WARM_QAOA_AUDIT.md`, `audit/warm_qaoa_verified_results.json`).

---

## 3. Contributor: Syed Afnan (`syedafnan7-lab`)
* **Core Inventions & Codebases:**
  - **Flagship Policy Demonstration:** Designed and implemented `backend/flagship.py` and `frontend/src/components/FlagshipDemo.jsx`, demonstrating why weighted costs withhold blood from critical hospitals and how lexicographic triage restores patient priority.
  - **Backend Compute Isolation:** Created `backend/jobs.py`, implementing process sandboxing via `multiprocessing.Process`, `BoundedSemaphore(2)`, and 60-second execution deadlines to prevent simulator thread lockups.
  - **Donor Privacy Security:** Authored `supabase/migrations/202610250001_donor_contact_lifecycle.sql`, tightening row-level security so that donor contact information is accessible only during active 24-hour emergency windows with verified consent.
  - **Animated UI Refresh:** Restored and polished the modern component suite (`Dock.jsx`, `SquishSwitch.jsx`, `Stepper.jsx`, `ClickSpark.jsx`, `AlertCenter.jsx`, `Chatbot.jsx`) and semantic dark theme tokens.

---

## 4. Machine Collaborators & Bots
* **OpenAI Codex:** Assisted in rapid test suite scaffolding and early UI component drafts.
* **Vercel Bot:** Automated analytics and speed insight package injections.
