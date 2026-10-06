# QAOA Beginner Guide

This guide introduces the ideas used by the small local simulator demo and by
the experimental BloodFlow-Q QAOA solver. The demo's two-vertex Max-Cut graph
is only a teaching example; it is not a blood allocation result.

## Core ideas

- **Qubit:** the basic two-state unit in a quantum circuit. Before measurement,
  its state can include amplitudes for both 0 and 1.
- **Superposition:** a state that assigns amplitudes to multiple bitstrings at
  once. The Hadamard gates at the beginning of the circuit create an equal
  superposition for the toy example.
- **Measurement:** converts the quantum state into one classical bitstring.
  Repeating a circuit for a chosen number of **shots** gives a count for each
  observed candidate. Counts are samples, not a certificate of optimality.
- **Cost Hamiltonian:** a mathematical operator whose measured energy encodes
  the problem cost. The circuit applies phases based on this operator.
- **Mixer:** a circuit operation that moves probability among bitstrings. The
  standard QAOA mixer uses rotations around the X axis.
- **Gamma (`γ`):** controls how strongly a cost layer applies its cost-dependent
  phase.
- **Beta (`β`):** controls the mixer rotation in a layer.
- **QAOA depth `p`:** the number of alternating cost and mixer layer pairs.
  Larger `p` adds parameters and circuit operations.
- **Classical optimizer:** a conventional numerical routine that tries
  different beta/gamma values to reduce estimated energy.
- **Hybrid algorithm:** QAOA combines a quantum circuit that samples candidates
  with a classical optimizer that updates circuit parameters.

## What the demo runs

`python -m quantum.qaoa_demo` runs a two-qubit Max-Cut example on a local
Qiskit Aer simulator. One graph edge connects the two vertices. A cut places
the vertices on opposite sides, so `01` and `10` cut the edge and `00` and
`11` do not. The program prints the cost operator, measured counts, and the
best candidate observed in those counts.

## How this relates to BloodFlow-Q

BloodFlow-Q's QUBO builder turns a small logistics scenario into binary
decision variables and a cost matrix. The Ising conversion expresses that
cost using Z and ZZ terms; QAOA then alternates those cost phases with a mixer.
The classical decoder maps measured bits back through the QUBO's variable
mapping, and the classical validator checks the resulting allocation. Invalid
measured candidates remain visible and are not silently repaired.

Each QAOA run is limited by local simulator resources and its configured qubit
limit. The returned candidate is the best one found among finite measured
samples. Greedy and exact classical baselines remain available for comparison.

## Scientific limits

This educational circuit does not demonstrate quantum advantage, operational
readiness, clinical validity, or real-world deployment. It uses synthetic
examples only. Any benchmark report must distinguish measured simulator
outputs from expected or illustrative values.
