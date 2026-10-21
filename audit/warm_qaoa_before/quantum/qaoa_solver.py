"""Local QAOA sampler for a small binary BloodFlow-Q QUBO.

The classical optimizer evaluates statevector expectations. The final measured
candidate counts come from Qiskit Aer. The returned best sample is only the
lowest-energy bitstring observed among those finite shots, not a proof of
global optimality.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import Mapping

import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator
from scipy.optimize import minimize

from quantum.ising import IsingRepresentation, convert_qubo_to_ising
from quantum.qubo import QUBOInputError, QUBOResult


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

    def __post_init__(self) -> None:
        if isinstance(self.p, bool) or not isinstance(self.p, int) or self.p < 1:
            raise ValueError("p must be a positive integer")
        if isinstance(self.shots, bool) or not isinstance(self.shots, int) or self.shots < 1:
            raise ValueError("shots must be a positive integer")
        if isinstance(self.max_iterations, bool) or not isinstance(self.max_iterations, int) or self.max_iterations < 1:
            raise ValueError("max_iterations must be a positive integer")
        if isinstance(self.max_qubits, bool) or not isinstance(self.max_qubits, int) or self.max_qubits < 1:
            raise ValueError("max_qubits must be a positive integer")
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
        """Derive warm-start rotation angles from classical MILP or Greedy solutions."""

        eps = float(self.config.warm_start_epsilon)
        num_vars = qubo.variable_count
        classical_bits = np.full(num_vars, 0.5, dtype=float)

        scenario = getattr(qubo, "scenario", None)
        if scenario is not None:
            alloc_map: dict[tuple[str, str, str, str], int] = {}
            unmet_map: dict[tuple[str, str], int] = {}
            slack_map: dict[tuple[str, str], float] = {}
            solved = False

            try:
                from optimization.milp import MILPSolver
                milp_solver = MILPSolver()
                if hasattr(milp_solver, "solve_relaxation"):
                    lp_res = milp_solver.solve_relaxation(
                        scenario,
                        qubo.objective_config,
                        getattr(qubo, "secondary_penalties", None),
                    )
                    alloc_map = lp_res["allocation"]
                    unmet_map = lp_res["unmet_demand"]
                    slack_map = lp_res["slack"]
                    solved = True
                else:
                    milp_res = milp_solver.solve(
                        scenario,
                        qubo.objective_config,
                        getattr(qubo, "secondary_penalties", None),
                    )
                    for dec in milp_res.allocation:
                        alloc_map[(dec.source, dec.destination, dec.blood_group, dec.recipient_group)] = dec.quantity
                    unmet_map = dict(milp_res.unmet_demand)
                    solved = True
            except Exception:
                pass

            if not solved:
                try:
                    from optimization.greedy import GreedyAllocator
                    greedy_res = GreedyAllocator().solve(
                        scenario,
                        qubo.objective_config,
                        getattr(qubo, "secondary_penalties", None),
                    )
                    for dec in greedy_res.allocation:
                        alloc_map[(dec.source, dec.destination, dec.blood_group, dec.recipient_group)] = dec.quantity
                    unmet_map = dict(greedy_res.unmet_demand)
                    solved = True
                except Exception:
                    pass

            if solved and hasattr(qubo, "_integer_bit_indices"):
                if not slack_map:
                    used_stock: dict[tuple[str, str], float] = {}
                    for dec_key, qty in alloc_map.items():
                        src, _, b_grp, _ = dec_key
                        used_stock[(src, b_grp)] = used_stock.get((src, b_grp), 0.0) + float(qty)

                    slack_map = {}
                    for bank in scenario.blood_banks:
                        for grp, avail in bank.inventory.items():
                            if avail > 0:
                                used = used_stock.get((bank.id, grp), 0.0)
                                slack_map[(bank.id, grp)] = max(0.0, float(avail) - used)

                for (kind, key), bit_pairs in qubo._integer_bit_indices.items():
                    if kind == "allocation":
                        val = alloc_map.get(key, 0.0)
                    elif kind == "unmet":
                        val = unmet_map.get(key, 0.0)
                    elif kind == "slack":
                        val = slack_map.get(key, 0.0)
                    else:
                        val = 0.0

                    rem = float(val)
                    for bit_idx, bit_weight in sorted(bit_pairs, key=lambda item: item[1], reverse=True):
                        w = float(bit_weight)
                        if rem >= w:
                            classical_bits[bit_idx] = 1.0
                            rem -= w
                        elif rem > 0.0:
                            classical_bits[bit_idx] = min(1.0, max(0.0, rem / w))
                            rem = 0.0
                        else:
                            classical_bits[bit_idx] = 0.0

        c_reg = eps + (1.0 - 2.0 * eps) * classical_bits
        c_reg = np.clip(c_reg, 1e-4, 1.0 - 1e-4)
        return 2.0 * np.arcsin(np.sqrt(c_reg))

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
            if mixer == "xy" and xy_pairs:
                for left, right in xy_pairs:
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
        ising = convert_qubo_to_ising(qubo)

        use_warm_start = self.config.warm_start or self.config.mixer == "warm_start"
        thetas = self._compute_warm_start_thetas(qubo) if use_warm_start else None
        xy_pairs = self._compute_xy_pairs(qubo) if self.config.mixer == "xy" else None

        rng = np.random.default_rng(self.config.seed)
        initial = np.concatenate((
            rng.uniform(0.0, 2 * math.pi, self.config.p),
            rng.uniform(0.0, math.pi, self.config.p),
        ))
        started = time.perf_counter()

        def expected_energy(angles: np.ndarray) -> float:
            circuit = self.build_circuit(ising, angles, thetas=thetas, xy_pairs=xy_pairs)
            state = Statevector.from_instruction(circuit)
            return float(state.expectation_value(ising.cost_hamiltonian).real)

        try:
            optimized = minimize(
                expected_energy,
                initial,
                method=self.config.optimizer,
                options={"maxiter": self.config.max_iterations},
            )
            measured = self.build_circuit(
                ising, optimized.x, measure=True, thetas=thetas, xy_pairs=xy_pairs
            )
            simulator = AerSimulator()
            compiled = transpile(measured, simulator, optimization_level=0)
            job = simulator.run(
                compiled, shots=self.config.shots, seed_simulator=self.config.seed
            )
            counts = {str(key): int(value) for key, value in job.result().get_counts().items()}
        except Exception as error:
            raise QAOASolverError(f"local QAOA run failed: {error}") from error

        runtime = time.perf_counter() - started
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
                "function_evaluations": int(getattr(optimized, "nfev", 0)),
                "final_expected_energy": float(optimized.fun),
                "initial_parameters": initial.tolist(),
                "final_parameters": np.asarray(optimized.x, dtype=float).tolist(),
            },
            runtime_seconds=runtime,
            variable_mapping=qubo.variable_mapping,
            cost_hamiltonian=ising.cost_hamiltonian,
            measured_mean_energy=mean_energy,
            warm_start_used=use_warm_start,
            mixer_type=self.config.mixer,
        )
