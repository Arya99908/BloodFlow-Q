"""Local QAOA sampler for a small binary BloodFlow-Q QUBO.

The classical optimizer evaluates statevector expectations. The final measured
candidate counts come from Qiskit Aer. The returned best sample is only the
lowest-energy bitstring observed among those finite shots, not a proof of
global optimality.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, replace
from typing import Mapping, Sequence

import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator
from scipy.optimize import minimize

from quantum.ising import IsingRepresentation, convert_qubo_to_ising
from quantum.qubo import QUBOInputError, QUBOResult


def encode_register_probabilities(value: float, bit_pairs: Sequence[tuple[int, int]]) -> dict[int, float]:
    """Interpolate encodings of adjacent integers; preserve the expected quantity.

    Integral classical quantities must map to binary registers, not fractional
    occupancy of a larger-weight bit. Fractions interpolate bit marginals only;
    the product state does not preserve correlations or guarantee feasibility.
    """
    maximum = sum(weight for _, weight in bit_pairs)
    if not math.isfinite(value) or value < -1e-7 or value > maximum + 1e-7:
        raise ValueError("classical seed quantity is outside the register bounds")
    value = min(float(maximum), max(0.0, value))
    def encode(integer: int) -> dict[int, int]:
        bits = {}
        for index, weight in sorted(bit_pairs, key=lambda pair: pair[1], reverse=True):
            bits[index] = int(integer >= weight)
            integer -= weight * bits[index]
        if integer:
            raise ValueError("register cannot represent the classical quantity")
        return bits
    low = math.floor(value)
    fraction = value - low
    lower, upper = encode(low), encode(math.ceil(value))
    return {i: (1 - fraction) * lower[i] + fraction * upper[i] for i, _ in bit_pairs}


def normalize_ising(ising: IsingRepresentation) -> tuple[IsingRepresentation, float]:
    """Positive uniform scaling preserves every energy ordering and minimizer."""
    scale = max([abs(c) for c in ising.linear_z] +
                [abs(c) for _, _, c in ising.quadratic_zz] + [1.0])
    return replace(ising, cost_hamiltonian=ising.cost_hamiltonian / scale,
                   constant_offset=ising.constant_offset / scale,
                   linear_z=tuple(c / scale for c in ising.linear_z),
                   quadratic_zz=tuple((a, b, c / scale) for a, b, c in ising.quadratic_zz)), scale


class QAOASolverError(RuntimeError):
    """Raised when the local optimizer or simulator cannot complete a run."""


class QAOAResourceLimitError(ValueError):
    """Raised when a dense local simulator is asked to exceed its qubit limit."""


@dataclass(frozen=True)
class QAOAConfig:
    """Small-run controls; no hardware or scaling claims are implied."""

    p: int = 1
    shots: int = 256
    optimizer: str = "COBYLA"
    max_iterations: int = 40
    seed: int = 7
    max_qubits: int = 16
    warm_start: bool = False
    mixer: str = "x"
    warm_start_epsilon: float = 0.25
    normalize_cost: bool = True
    restarts: int = 1

    def __post_init__(self) -> None:
        if isinstance(self.p, bool) or not isinstance(self.p, int) or self.p < 1:
            raise ValueError("p must be a positive integer")
        if isinstance(self.shots, bool) or not isinstance(self.shots, int) or self.shots < 1:
            raise ValueError("shots must be a positive integer")
        if isinstance(self.max_iterations, bool) or not isinstance(self.max_iterations, int) or self.max_iterations < 1:
            raise ValueError("max_iterations must be a positive integer")
        if isinstance(self.max_qubits, bool) or not isinstance(self.max_qubits, int) or self.max_qubits < 1:
            raise ValueError("max_qubits must be a positive integer")
        if isinstance(self.restarts, bool) or not isinstance(self.restarts, int) or not 1 <= self.restarts <= 10:
            raise ValueError("restarts must be an integer from 1 to 10")
        if not isinstance(self.normalize_cost, bool):
            raise ValueError("normalize_cost must be boolean")
        if not isinstance(self.warm_start, bool):
            raise ValueError("warm_start must be boolean")
        if self.optimizer not in {"COBYLA", "Nelder-Mead", "Powell"}:
            raise ValueError("optimizer must be one of: COBYLA, Nelder-Mead, Powell")
        if self.mixer not in {"x", "xy", "warm_start"}:
            raise ValueError("mixer must be one of: x, xy, warm_start")
        if isinstance(self.warm_start_epsilon, bool) or not isinstance(self.warm_start_epsilon, (int, float)) or not (0.0 < self.warm_start_epsilon < 0.5):
            raise ValueError("warm_start_epsilon must be a number strictly between 0 and 0.5")


@dataclass(frozen=True)
class QAOACandidate:
    bitstring: str
    energy: float
    count: int
    probability: float


@dataclass(frozen=True)
class QAOAResult:
    """Observed candidates and run metadata from one local QAOA simulation."""

    best_bitstring: str
    objective_value: float
    counts: Mapping[str, int]
    ranked_candidates: tuple[QAOACandidate, ...]
    qaoa_depth: int
    number_of_shots: int
    optimizer_information: Mapping[str, object]
    runtime_seconds: float
    variable_mapping: tuple
    cost_hamiltonian: object
    measured_mean_energy: float
    warm_start_used: bool = False
    mixer_type: str = "x"
    result_kind: str = "best measured candidate; not a global optimality certificate"


class QAOASolver:
    """Optimize a QUBO with a compact QAOA ansatz and sample it on local Aer."""

    name = "qaoa"

    def __init__(self, config: QAOAConfig | None = None) -> None:
        self.config = config or QAOAConfig()

    def _compute_warm_start_thetas(self, qubo: QUBOResult) -> np.ndarray:
        """Compatibility helper for circuit audits; solve also reports provenance."""
        return self._prepare_warm_start(qubo)[0]

    def _prepare_warm_start(self, qubo: QUBOResult) -> tuple[np.ndarray, dict[str, object]]:
        """Prepare a biased product state from an LP relaxation, then greedy fallback.

        The LP values are embedded as per-register bit marginals. This preserves
        each relaxed register's expected integer value, but the tensor-product
        state does not preserve cross-register constraints or guarantee feasible
        measurements. We deliberately never fall back to an optimal MILP seed.
        """
        started = time.perf_counter()
        scenario = qubo.scenario
        allocation_values: dict[tuple[str, str, str, str], float] = {}
        unmet_values: dict[tuple[str, str], float] = {}
        slack_values: dict[tuple[str, str], float] = {}
        source = "uniform_fallback"
        seed_objective: float | None = None
        seed_feasibility = "not_applicable"
        fallback_reason: str | None = None
        try:
            from optimization.milp import MILPSolver
            relaxation = MILPSolver().solve_relaxation(
                scenario, qubo.objective_config, qubo.secondary_penalties, include_metadata=True
            )
            seed_objective = float(relaxation["objective_value"])
            allocation_values = relaxation["allocation"]
            unmet_values = relaxation["unmet_demand"]
            slack_values = relaxation["slack"]
            source = "lp_relaxation"
            seed_feasibility = "feasible_continuous_relaxation"
        except Exception as lp_error:
            fallback_reason = f"LP relaxation unavailable: {type(lp_error).__name__}"
            try:
                from optimization.constraints import validate_allocation
                from optimization.greedy import GreedyAllocator
                greedy = GreedyAllocator().solve(
                    scenario, qubo.objective_config, qubo.secondary_penalties
                )
                report = validate_allocation(scenario, greedy.allocation, greedy.unmet_demand)
                if not report["feasible"]:
                    raise ValueError("greedy seed failed independent feasibility validation")
                allocation_values = {
                    (row.source, row.destination, row.blood_group, row.recipient_group): float(row.quantity)
                    for row in greedy.allocation
                }
                unmet_values = {key: float(value) for key, value in greedy.unmet_demand.items()}
                seed_objective = float(greedy.objective_breakdown.total_objective)
                seed_feasibility = "feasible_integer"
                source = "greedy_fallback"
                fallback_reason = f"{fallback_reason}; using validated greedy seed"
            except Exception as greedy_error:
                fallback_reason = f"{fallback_reason}; greedy fallback unavailable: {type(greedy_error).__name__}"

        if source != "uniform_fallback":
            used_stock: dict[tuple[str, str], float] = {}
            for key, quantity in allocation_values.items():
                bank_id, _, supplied_group, _ = key
                used_stock[(bank_id, supplied_group)] = used_stock.get((bank_id, supplied_group), 0.0) + quantity
            if not slack_values:
                slack_values = {
                    (bank.id, group): max(0.0, float(available) - used_stock.get((bank.id, group), 0.0))
                    for bank in scenario.blood_banks
                    for group, available in bank.inventory.items()
                    if available > 0
                }
            bit_probabilities = np.zeros(qubo.variable_count, dtype=float)
            for (kind, key), bit_pairs in qubo._integer_bit_indices.items():
                if kind == "allocation":
                    value = allocation_values.get(key, 0.0)
                elif kind == "unmet":
                    value = unmet_values.get(key, 0.0)
                else:
                    value = slack_values.get(key, 0.0)
                for bit_index, probability in encode_register_probabilities(float(value), bit_pairs).items():
                    bit_probabilities[bit_index] = probability
        else:
            bit_probabilities = np.full(qubo.variable_count, 0.5, dtype=float)

        epsilon = float(self.config.warm_start_epsilon)
        regularized = np.clip(epsilon + (1.0 - 2.0 * epsilon) * bit_probabilities, 1e-4, 1.0 - 1e-4)
        thetas = 2.0 * np.arcsin(np.sqrt(regularized))
        metadata: dict[str, object] = {
            "seed_source": source,
            "seed_objective": seed_objective,
            "seed_feasibility": seed_feasibility,
            "seed_preprocessing_seconds": time.perf_counter() - started,
        }
        if fallback_reason:
            metadata["seed_fallback_reason"] = fallback_reason
        return thetas, metadata

    def _compute_xy_pairs(self, qubo: QUBOResult) -> tuple[tuple[int, int], ...]:
        """Compute excitation-preserving exchange pairs for the XY mixer."""

        pairs: set[tuple[int, int]] = set()
        num_vars = qubo.variable_count
        if num_vars < 2:
            return ()

        # 1. Connect bits within multi-bit registers
        if hasattr(qubo, "_integer_bit_indices"):
            for (kind, key), bit_pairs in qubo._integer_bit_indices.items():
                indices = [idx for idx, _ in sorted(bit_pairs, key=lambda x: x[0])]
                for i in range(len(indices) - 1):
                    pairs.add((min(indices[i], indices[i + 1]), max(indices[i], indices[i + 1])))

        # 2. Connect coupled variables sharing equality constraints
        if hasattr(qubo, "scenario") and qubo.scenario is not None and hasattr(qubo, "_integer_bit_indices"):
            for var in qubo.scenario.allocation_variables():
                alloc_key = (var.source, var.destination, var.blood_group, var.recipient_group)
                alloc_bits = qubo._integer_bit_indices.get(("allocation", alloc_key), ())
                unmet_bits = qubo._integer_bit_indices.get(("unmet", (var.destination, var.recipient_group)), ())
                slack_bits = qubo._integer_bit_indices.get(("slack", (var.source, var.blood_group)), ())
                if alloc_bits and unmet_bits:
                    pairs.add((min(alloc_bits[0][0], unmet_bits[0][0]), max(alloc_bits[0][0], unmet_bits[0][0])))
                if alloc_bits and slack_bits:
                    pairs.add((min(alloc_bits[0][0], slack_bits[0][0]), max(alloc_bits[0][0], slack_bits[0][0])))

        # 3. Complete nearest-neighbor ring so all qubits exchange excitations
        for i in range(num_vars):
            left, right = min(i, (i + 1) % num_vars), max(i, (i + 1) % num_vars)
            if left != right:
                pairs.add((left, right))

        return tuple(sorted(pairs))

    def build_circuit(
        self,
        ising: IsingRepresentation,
        angles: np.ndarray,
        *,
        measure: bool = False,
        thetas: np.ndarray | None = None,
        xy_pairs: Sequence[tuple[int, int]] | None = None,
    ) -> QuantumCircuit:
        """Construct state preparation, alternating Ising-cost and mixer layers."""

        expected = 2 * self.config.p
        if len(angles) != expected:
            raise ValueError(f"angles must contain {expected} values for p={self.config.p}")
        circuit = QuantumCircuit(ising.num_qubits)

        # Initial state preparation: warm-start Ry bias or uniform superposition H
        if thetas is not None:
            for qubit, theta in enumerate(thetas):
                circuit.ry(float(theta), qubit)
        else:
            circuit.h(range(ising.num_qubits))

        linear = ising.linear_z
        pair_terms = ising.quadratic_zz
        mixer = self.config.mixer

        for layer in range(self.config.p):
            gamma = float(angles[layer])
            beta = float(angles[self.config.p + layer])

            # Problem Hamiltonian phase separation U_C(gamma)
            for qubit, coefficient in enumerate(linear):
                if coefficient:
                    circuit.rz(2 * gamma * coefficient, qubit)
            for left, right, coefficient in pair_terms:
                if coefficient:
                    circuit.rzz(2 * gamma * coefficient, left, right)

            # Mixer unitary U_M(beta)
            if mixer == "xy":
                for left, right in xy_pairs or ():
                    circuit.rxx(beta, left, right)
                    circuit.ryy(beta, left, right)
            elif (mixer == "warm_start" or (self.config.warm_start and mixer == "x")) and thetas is not None:
                for qubit, theta in enumerate(thetas):
                    circuit.ry(-float(theta), qubit)
                    circuit.rz(2 * beta, qubit)
                    circuit.ry(float(theta), qubit)
            else:
                circuit.rx(2 * beta, range(ising.num_qubits))

        if measure:
            circuit.measure_all()
        return circuit

    def solve(self, qubo: QUBOResult) -> QAOAResult:
        """Run a local hybrid QAOA search and return ranked measured samples."""

        if not isinstance(qubo, QUBOResult):
            raise QUBOInputError("qubo: expected a QUBOResult")
        if qubo.variable_count > self.config.max_qubits:
            raise QAOAResourceLimitError(
                f"local QAOA limited to {self.config.max_qubits} qubits by configuration; "
                f"this QUBO has {qubo.variable_count} binary variables"
            )
        started = time.perf_counter()
        original_ising = convert_qubo_to_ising(qubo)
        ising, cost_scale = normalize_ising(original_ising) if self.config.normalize_cost else (original_ising, 1.0)

        use_warm_start = self.config.warm_start or self.config.mixer == "warm_start"
        seed_metadata = {"seed_source": "uniform", "seed_objective": None,
                         "seed_feasibility": "not_applicable", "seed_preprocessing_seconds": 0.0}
        thetas = None
        if use_warm_start:
            thetas, seed_metadata = self._prepare_warm_start(qubo)
        actual_warm_start = use_warm_start and seed_metadata["seed_source"] != "uniform_fallback"
        effective_mixer = "xy" if self.config.mixer == "xy" else ("warm_start" if use_warm_start else "x")
        xy_pairs = self._compute_xy_pairs(qubo) if self.config.mixer == "xy" else None

        rng = np.random.default_rng(self.config.seed)
        initial = np.concatenate((
            rng.uniform(0.0, 2 * math.pi, self.config.p),
            rng.uniform(0.0, math.pi, self.config.p),
        ))
        preparation_seconds = time.perf_counter() - started

        def expected_energy(angles: np.ndarray) -> float:
            circuit = self.build_circuit(ising, angles, thetas=thetas, xy_pairs=xy_pairs)
            state = Statevector.from_instruction(circuit)
            return float(state.expectation_value(ising.cost_hamiltonian).real)

        try:
            runs = []
            starts = []
            for restart in range(self.config.restarts):
                if restart:
                    initial = np.concatenate((rng.uniform(0, 2 * math.pi, self.config.p),
                                              rng.uniform(0, math.pi, self.config.p)))
                starts.append(initial.copy())
                runs.append(minimize(expected_energy, initial, method=self.config.optimizer,
                                     options={"maxiter": self.config.max_iterations}))
            selected = min(range(len(runs)), key=lambda index: runs[index].fun)
            optimized = runs[selected]
            initial = starts[selected]
            measured = self.build_circuit(
                ising, optimized.x, measure=True, thetas=thetas, xy_pairs=xy_pairs
            )
            simulator = AerSimulator()
            compiled = transpile(measured, simulator, optimization_level=0)
            circuit_depth = compiled.depth()
            circuit_operations = compiled.count_ops()
            two_qubit_gates = sum(instruction.operation.num_qubits == 2 for instruction in compiled.data)
            job = simulator.run(
                compiled, shots=self.config.shots, seed_simulator=self.config.seed
            )
            counts = {str(key): int(value) for key, value in job.result().get_counts().items()}
        except Exception as error:
            raise QAOASolverError(f"local QAOA run failed: {error}") from error

        candidates = [
            QAOACandidate(
                bitstring=key,
                # Aer prints classical bit zero at the right. The QUBO vector
                # is indexed from zero, so reverse the measured key before
                # evaluating it; never reinterpret the positions implicitly.
                energy=qubo.energy(tuple(int(bit) for bit in key.replace(" ", "")[::-1])),
                count=count,
                probability=count / self.config.shots,
            )
            for key, count in counts.items()
        ]
        candidates.sort(key=lambda item: (item.energy, -item.count, item.bitstring))
        if not candidates:
            raise QAOASolverError("local simulator returned no measured candidates")
        mean_energy = sum(item.energy * item.count for item in candidates) / self.config.shots
        from optimization.decoder import evaluate_quantum_solution
        feasible_candidates = []
        feasible_shots = 0
        for candidate in candidates:
            evaluation = evaluate_quantum_solution(qubo, candidate.bitstring)
            if evaluation.feasibility:
                feasible_shots += candidate.count
                feasible_candidates.append((evaluation.total_objective, candidate.bitstring))
        best_feasible = min(feasible_candidates) if feasible_candidates else None
        measured_shots = sum(counts.values())
        return QAOAResult(
            best_bitstring=candidates[0].bitstring,
            objective_value=candidates[0].energy,
            counts=counts,
            ranked_candidates=tuple(candidates),
            qaoa_depth=self.config.p,
            number_of_shots=self.config.shots,
            optimizer_information={
                "name": self.config.optimizer,
                "success": bool(optimized.success),
                "message": str(optimized.message),
                "iterations": int(getattr(optimized, "nit", 0)),
                "function_evaluations": sum(int(getattr(run, "nfev", 0)) for run in runs),
                "parameter_count": 2 * self.config.p,
                "circuit_depth": circuit_depth,
                "two_qubit_gate_count": two_qubit_gates,
                "compiled_operation_counts": {str(name): int(count) for name, count in circuit_operations.items()},
                "warm_start_requested": use_warm_start,
                "requested_mixer": self.config.mixer,
                "effective_mixer": effective_mixer,
                **seed_metadata,
                "restarts": self.config.restarts,
                "selected_restart": selected,
                "restart_expected_energies": [float(run.fun) * cost_scale for run in runs],
                "cost_scale": cost_scale,
                "preparation_seconds": preparation_seconds,
                "warm_start_epsilon": self.config.warm_start_epsilon,
                "measured_shots": measured_shots,
                "feasible_shots": feasible_shots,
                "feasible_shot_rate": feasible_shots / measured_shots if measured_shots else 0.0,
                "best_feasible_objective": best_feasible[0] if best_feasible else None,
                "best_feasible_bitstring": best_feasible[1] if best_feasible else None,
                "final_expected_energy": float(optimized.fun) * cost_scale,
                "initial_parameters": initial.tolist(),
                "final_parameters": np.asarray(optimized.x, dtype=float).tolist(),
            },
            runtime_seconds=time.perf_counter() - started,
            variable_mapping=qubo.variable_mapping,
            cost_hamiltonian=original_ising.cost_hamiltonian,
            measured_mean_energy=mean_energy,
            warm_start_used=actual_warm_start,
            mixer_type=effective_mixer,
        )
