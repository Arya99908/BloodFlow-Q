# BloodFlow-Q — UI/UX Design System and Navigation Guide

## Overview
This document describes the structure of each page, the shared visual conventions, and navigation boundaries.

---

## 1. Cross-Tab Content Matrix & Single Source of Truth

To prevent cognitive clutter and contradictory metrics, each major domain has a primary home:

| Route / Tab | Primary Objective | Key Content & Visualizations | What Is Strictly Excluded |
| :--- | :--- | :--- | :--- |
| **Workspace (`/dashboard`)** | Operational Status Overview | Reconciled facility inventory, demand shortfall alerts, live coordination records | In-depth QAOA equations or raw benchmark run tables |
| **Operations (`/optimization`)** | Solver Execution & Configuration | Interactive solver runner, objective weights, penalty sliders, solution validation | Detailed historical academic ablation tables |
| **Emergency (`/emergency`)** | Surge Simulation & Disruption | Corridor cutoffs, hospital demand spikes, re-optimization delta metrics | Generic donor lifecycle management |
| **Coordination (`/coordination`)**| Logistics, Donors & Transport | Verified donor contact status, blood-group inventory shelf, dispatch routes | Quantum circuit depth diagrams |
| **Research (`/reports`)** | Scientific Evidence & Benchmark Review | Executive Telemetry Dashboard, Comparative Pipeline, Full Review & 6-Question Ablation Suite | Editable operational scenario settings |
| **Solver Lab (`/results`)** | Algorithmic Anatomy & Circuits | QUBO matrix explorer, circuit gate depth, statevector energy evolution | High-level marketing summaries |

---

## 2. Design System & Interaction Hierarchy

### A. Dark theme and contrast
* **Background Surface**: Layered slate tokens (`--bg-surface: #0f172a`, `--bg-surface-elevated: #1e293b`).
* **Accent & Feedback**:
  * Primary Action: Vibrant crimson / coral (`#ef233c`) for emergency actions.
  * Quantum / Research Accent: Cyan / Sky-blue (`#38bdf8`) for quantum operations, confidence intervals, and benchmark data.
  * Success / Verification: Emerald green (`#10b981`) for deterministic exact matches and verified proofs.

### B. Reactive Interactions & Micro-Animations
* **Animated Data Counters**: Numbers format with regional delimiters and tabular numerals (`font-variant-numeric: tabular-nums`) to prevent layout jank during transitions.
* **Dock Navigation**: Floating Dock (`Dock.jsx`) features smooth magnification with dynamic tooltips and automatic label positioning with responsive positioning.
* **Progressive Disclosure**: High-level findings and charts appear first; complete methodological details and raw measurement tables remain expandable on demand.

### C. Accessibility & Ergonomics
* Interactive controls should provide appropriate `aria-label`, `role="tab"`, and `aria-selected` attributes.
* Keyboard interactions use `Enter` / `Space` / `Escape` key handling.
* Animations should respect `prefers-reduced-motion: reduce`.
