# Warm-start QAOA change audit

Scope: BloodFlow-Q-main 3, normal compact synthetic demo, 10 qubits. This is a code-and-test audit performed during implementation, not an independent external audit. No hardware or quantum advantage claim.

## Changes

- Fixed bounded-register warm-start encoding. Previously an integer quantity smaller than a large bit weight became a fractional occupancy of that bit (for example quantity 1 in weights 1,2,4 could become probability 0.25 on weight 4). Integer quantities now produce binary registers. Fractional quantities interpolate adjacent integer encodings; expected quantities are preserved before regularization. Product states do not preserve inter-bit correlations or guarantee feasibility.
- Retained the documented affine epsilon regularization; exposed epsilon through API and demo controls. This is not a claim to implement a particular paper's clipping prescription.
- Added positive uniform Hamiltonian normalization, enabled by default. Original QUBO energies, returned Hamiltonian, objective values and expectation metadata remain in original units. `normalize_cost=false` reproduces the old angle scale. Scaling changes optimizer trajectories; it does not guarantee an improvement for every instance.
- Added deterministic optional restarts (1–10). Choose the circuit with lowest optimized expectation before sampling, without consulting the exact answer. Metadata reports total function evaluations, selected restart, each restart's expectation, and the scale.
- Runtime now includes classical preparation, circuit optimization, measurement and candidate evaluation. Preparation time is separately visible.
- Added feasible-shot rate and best feasible measured objective/bitstring. Infeasible samples remain in counts; no repairs, classical candidate injection, or resampling until success.
- Added demo controls and an explicit comparison preset: p=2, 512 shots, 80 optimizer iterations per restart, 3 restarts, epsilon=0.1 for warm-start, normalized cost. Penalties use ceil(1.5 × conservative objective bound), at least 1. The preset does not run automatically. Standard and warm-start use the same compute controls.
- Retained the prior fallback fix and its regression test. Both classical seed solvers failing still falls back to uniform initialization; existing warm-start metadata does not identify that fallback. This is a remaining observability limitation.

## Validation

`audit/warm_qaoa_final_tests.log`: 157 tests passed. Includes exhaustive register tests for bounds 1–64 and quarter-unit fractions, normalization energy equivalence and equivalent circuits under angle rescaling, warm mixer state invariance, restart selection, measured-energy preservation, LP failure recovery, and API control propagation.

The historical integration fixture asserts a specific unnormalized measured bitstring. Its config and API request now explicitly set `normalize_cost=false`; its bitstring, infeasibility, energy and no-repair assertions were preserved. The initial failure is retained in `warm_qaoa_tests.log`.

The experiment enumerated all 1,024 assignments separately for penalties 10,000 and 248. Every minimum-energy assignment was feasible and matched the independent exact allocation solver's objective of 25.2. The bound was 165.2; 248 is strictly above it. No penalty safety checks were weakened.

The JSX parser accepted the modified demo page. Full frontend build and interactive browser verification remain unverified: the available shared dependency environment lacks @vercel/speed-insights; this checkout has no installed node_modules. Earlier build attempts also required a production API URL. No fake production URL or shared node_modules symlink was retained in the project.

## Measurements

Final evidence: `warm_qaoa_verified_results.json`. Seeds 7,11,19, 512 shots per run. Thirty-six runs: six variants × two penalties × three seeds. Every raw count, configuration, optimizer result, elapsed time, package version and relevant solver source hash is recorded. `warm_qaoa_results.json` is an earlier exploratory 24-run capture, not the final evidence.

At penalty 248, averages across three seeds:

| Variant | Depth / restarts / iterations per restart | Feasible shots | Optimal shots | Mean wall seconds |
| --- | --- | --- | --- | --- |
| Original warm-start snapshot | 1 / 1 / 80 | 4.75% | 1.04% | 0.162 |
| Corrected encoding, unnormalized warm-start | 1 / 1 / 80 | 8.92% | 8.85% | 0.163 |
| Normalized standard | 1 / 1 / 80 | 2.67% | 0.26% | 0.245 |
| Normalized warm-start, epsilon 0.25 | 1 / 1 / 80 | 9.51% | 9.05% | 0.304 |
| Standard comparison preset | 2 / 3 / 80 | 3.91% | 0.78% | 1.209 |
| Warm-start comparison preset, epsilon 0.1 | 2 / 3 / 80 | 54.43% | 54.43% | 1.474 |

Both preset variants found the exact optimum in all three runs; original warm-start also found it in all three runs. The improvement is sampling reliability, not an improvement in best objective for those runs. Warm-start preset optimal-shot rates ranged from 50.78% to 58.79%. At penalty 10,000 its average was 55.08%; reducing the penalty did not improve that preset here. The smaller penalty is justified by the conservative bound, not a claim that it always improves optimization.

The LP seed is allocation=4, unmet=0, slack=8. It is already an optimal classical solution (objective 25.2). These measurements show how faithfully the circuit samples that good solution, not evidence that QAOA beats the classical solver. The higher-budget preset changes depth, restarts and epsilon together; their individual effects are not isolated. Three seeds on one synthetic scenario are a smoke benchmark, not statistical evidence of general performance. Emergency scenarios and larger cases were not performance-benchmarked.

## Reproduction and audit trail

From project root, with Qiskit, Aer, SciPy and backend dependencies installed:

```
python -m unittest discover -s tests
python -m experiments.audit_warm_qaoa --output audit/new_capture.json
```

The experiment refuses to overwrite an existing result file. This session used the pre-existing Python environment at ../BloodFlow-Q1/.venv/bin/python. No dependencies were installed.

`warm_qaoa_before/` holds pre-change snapshots (the previously completed demo selector and fallback fix were already present). `warm_qaoa_changes.patch` records edits; `warm_qaoa_manifest.json` records SHA-256 hashes of changed sources and final evidence. Existing historical precomputed demo results were not regenerated or relabeled as new runs.
