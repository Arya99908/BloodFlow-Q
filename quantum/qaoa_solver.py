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
    result_kind: str = "best measured candidate; not a global optimality certificate"


class QAOASolver:
    """Optimize a QUBO with a compact QAOA ansatz and sample it on local Aer."""

    name = "qaoa"

    def __init__(self, config: QAOAConfig | None = None) -> None:
        self.config = config or QAOAConfig()

    def build_circuit(
        self, ising: IsingRepresentation, angles: np.ndarray, *, measure: bool = False
    ) -> QuantumCircuit:
        """Construct H-start, alternating Ising-cost and X-mixer layers."""

        expected = 2 * self.config.p
        if len(angles) != expected:
            raise ValueError(f"angles must contain {expected} values for p={self.config.p}")
        circuit = QuantumCircuit(ising.num_qubits)
        circuit.h(range(ising.num_qubits))
        linear = ising.linear_z
        pair_terms = ising.quadratic_zz
        for layer in range(self.config.p):
            gamma = float(angles[layer])
            beta = float(angles[self.config.p + layer])
            for qubit, coefficient in enumerate(linear):
                if coefficient:
                    circuit.rz(2 * gamma * coefficient, qubit)
            for left, right, coefficient in pair_terms:
                if coefficient:
                    circuit.rzz(2 * gamma * coefficient, left, right)
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
        rng = np.random.default_rng(self.config.seed)
        initial = np.concatenate((
            rng.uniform(0.0, 2 * math.pi, self.config.p),
            rng.uniform(0.0, math.pi, self.config.p),
        ))
        started = time.perf_counter()

        def expected_energy(angles: np.ndarray) -> float:
            circuit = self.build_circuit(ising, angles)
            probabilities = Statevector.from_instruction(circuit).probabilities()
            energy = 0.0
            for state_index, probability in enumerate(probabilities):
                if probability:
                    bits = tuple((state_index >> bit) & 1 for bit in range(qubo.variable_count))
                    energy += float(probability) * qubo.energy(bits)
            return energy

        try:
            optimized = minimize(
                expected_energy,
                initial,
                method=self.config.optimizer,
                options={"maxiter": self.config.max_iterations},
            )
            measured = self.build_circuit(ising, optimized.x, measure=True)
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
        )
