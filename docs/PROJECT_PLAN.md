# BloodFlow-Q project plan

## Purpose and boundaries

BloodFlow-Q is a research/hackathon prototype for studying logistics
allocations of synthetic blood-unit inventory across synthetic blood banks and
hospitals. It is intended to explore modeling and software workflows, not to
guide care for an individual patient.

The project must use synthetic data only. It will not make patient-level
decisions, replace clinical or hospital processes, or present modeled
assumptions as clinical facts. Quantum simulation results must not be described
as quantum advantage. Results that have actually been measured must be clearly
separated from expected or planned results.

## Planned system architecture

### 1. Scenario input and data layer

The initial interface will accept JSON or CSV scenarios. A scenario is planned
to contain synthetic blood-bank locations and inventory, hospital locations
and demand, blood-group labels, urgency, transport-time/cost estimates, and
scenario metadata. Demand changes can be represented as a revised scenario or
an emergency event. Schemas will define required fields, units, allowed values,
and validation errors. Example data will be fabricated and labeled synthetic.

No database is required for the initial prototype. Inputs and reproducible
experiment settings can be kept in versioned JSON/CSV files. Any later
persistence decision should be documented before implementation.

### 2. Frontend (`frontend/`)

The React and Vite interface will let a user select or enter a synthetic
scenario, submit it, and inspect the returned allocation, unmet demand, and
high-level performance metrics. It should show scenario assumptions and
validation errors clearly. It must not frame the result as advice for treating
patients.

### 3. API and orchestration (`backend/`)

The FastAPI service will expose documented endpoints for validating a
scenario, requesting an optimization run, retrieving its results, and
submitting a synthetic emergency change. API schemas will make data fields and
units explicit. Backend orchestration will call the scenario-validation,
optimization, and quantum modules rather than implementing their mathematical
logic itself.

### 4. Scenario validation and allocation model (`optimization/`)

This package will own the core logistics problem definition. It will:

1. Validate scenario structure, quantities, units, and assumptions.
2. Apply documented compatibility rules to remove ineligible
   bank-to-hospital supply edges before decision variables are created.
3. Define decision variables for quantities routed from a bank to a hospital
   (and, if needed, a blood group or time period).
4. Define an objective that can account for unmet demand, urgency, transport
   time/cost, and other explicitly documented logistics priorities.
5. Define constraints such as inventory limits, demand bounds, and any
   additional scenario rules.
6. Provide a classical baseline and an independent validator for candidate
   allocations.

The objective weights and compatibility assumptions are research-model choices
and must be explained. The independent validator should check candidate
feasibility and recompute reported objective terms from the original scenario.

### 5. Quantum formulation and experiments (`quantum/`)

After the allocation model is defined and tested classically, this package may
encode a suitable discrete model as a QUBO, convert it to an Ising
representation, and construct a QAOA workflow using Qiskit and a supported
simulator such as Qiskit Aer where appropriate. The implementation must record
package/simulator versions, circuit and optimizer settings, shot counts, and
random seeds when available.

QAOA measurements produce candidate bitstrings, not guaranteed feasible
solutions. Decoding, repair policy if any, feasibility checking, and objective
calculation must be explicit. If the modeled problem size or encoding is too
large or unsuitable, that limitation should be reported rather than hidden.

### 6. Emergency changes (`emergency/`)

This package will describe synthetic emergency events, such as a change in a
hospital's demand. It will create or validate an updated scenario and invoke
the same allocation workflow. It will not directly trigger real-world orders,
dispatches, or patient-care actions.

### 7. Data, tests, and documentation

- `data/` will contain synthetic example scenarios and format notes.
- `tests/` will check input validation, compatibility filtering, model
  constraints, API behavior, decoding, and reproducibility as those components
  are introduced.
- `docs/` will hold architecture decisions, assumptions, experiment protocols,
  and clear explanations for contributors who are new to the technologies.

## End-to-end planned workflow

```text
Synthetic scenario input (JSON/CSV)
  -> schema and assumption validation
  -> compatibility filtering
  -> allocation decision variables
  -> objective and constraints
  -> classical baseline
  -> QUBO formulation
  -> Ising representation
  -> QAOA circuit and simulator sampling
  -> measured candidate bitstrings
  -> decoding
  -> independent classical feasibility/objective validation
  -> reproducible benchmarking
  -> FastAPI results and React/Vite dashboard
```

An emergency demand change will produce a new synthetic scenario and re-enter
the workflow at validation. The classical baseline and validator are essential
reference points; a quantum-produced candidate is not accepted merely because
it was sampled.

## Development milestones and completion gates

1. **Scaffold and scope (current).** Create the requested folders, README, and
   this plan. Gate: the structure exists, documentation states limitations,
   and no optimization behavior has been added.
2. **Scenario schema and synthetic examples.** Define JSON/CSV formats, units,
   and fabricated scenarios. Gate: examples validate against documented
   schemas and contain no real operational or patient data.
3. **Validation and compatibility.** Implement input checks and a documented
   compatibility filter. Gate: invalid scenarios are rejected and eligibility
   outcomes are explainable.
4. **Mathematical model and classical baseline.** Specify variables, objective
   terms, and constraints; implement a classical solver. Gate: independent
   checks confirm inventory and demand rules on small examples.
5. **QUBO and Ising encoding.** Derive and document the binary encoding and
   penalty terms. Gate: encoded energies agree with the intended objective and
   constraints on exhaustively checkable small cases.
6. **QAOA simulator experiment.** Add circuits and reproducible simulator
   configuration. Gate: sampled results can be decoded, and simulator settings
   are recorded. This gate does not imply quantum advantage.
7. **Decoding and independent validation.** Validate every reported candidate
   against the original scenario. Gate: infeasible candidates are identified
   and reported transparently.
8. **Benchmarking.** Compare methods on fixed synthetic scenarios and record
   runtime, feasibility, objective values, and experiment settings. Gate:
   measured data is labeled as measured, expectations as expected, and no
   unsupported advantage claim is made.
9. **API and dashboard.** Add documented FastAPI endpoints and connect the
   React/Vite interface. Gate: the user can submit a synthetic case and inspect
   its validated result and assumptions.
10. **Emergency scenario demonstration and release notes.** Add synthetic
    demand-change examples and contributor/run instructions. Gate: updated
    scenarios re-run validation, results remain clearly non-clinical, and
    limitations are visible.

## Repository layout

```text
BloodFlow-Q/
├── frontend/       # React + Vite interface
├── backend/        # FastAPI endpoints and workflow orchestration
├── optimization/   # Scenario checks, model, baseline, and validation
├── quantum/        # QUBO, Ising, QAOA, simulator, and candidate decoding
├── emergency/      # Synthetic emergency-change scenarios
├── data/           # Synthetic JSON/CSV inputs and documentation
├── tests/          # Automated checks added with each implementation stage
├── docs/           # Plans, assumptions, architecture, and experiment notes
├── README.md       # Project overview and contributor entry point
└── .gitignore      # Excludes local/generated files from version control
```

## Initial `.gitignore` policy

Ignore Python virtual environments, Python bytecode and test caches, frontend
dependencies and build output, local environment/secret files, editor/OS
metadata, and generated experiment outputs. Keep source code, documentation,
synthetic input fixtures, and explicitly selected reproducibility artifacts
under version control. Never commit credentials or real clinical data.

## Items to decide during implementation

- Exact scenario schema, quantity units, time horizon, and transport estimate
  conventions.
- The compatibility assumptions and their documented scope for this
  non-clinical prototype.
- How to express integral quantities and unmet demand in the classical and
  binary models.
- Which classical solver and Qiskit simulator workflow best fit the model and
  installed, supported package versions at implementation time.
- Benchmark metrics, scenario sizes, and reproducibility requirements.
- How API runs and errors will be represented without adding unnecessary
  persistence infrastructure.
