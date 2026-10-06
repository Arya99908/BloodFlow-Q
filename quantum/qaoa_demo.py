"""Run a tiny, educational QAOA example for a one-edge Max-Cut problem.

This demo is intentionally separate from BloodFlow-Q's allocation QUBO. It
uses two qubits and one graph edge so the circuit and measured candidates are
small enough to inspect. Its output is a local simulator observation, not
evidence of a quantum speedup.
"""

from __future__ import annotations

import argparse
import math

import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import SparsePauliOp, Statevector
from qiskit_aer import AerSimulator
from scipy.optimize import minimize


def _circuit(angles: np.ndarray, depth: int, *, measure: bool = False) -> QuantumCircuit:
    """Build alternating cost and X-mixer layers for the two-qubit graph."""

    circuit = QuantumCircuit(2)
    circuit.h([0, 1])
    for layer in range(depth):
        gamma = float(angles[layer])
        beta = float(angles[depth + layer])
        # For one edge, minimizing -cut is equivalent, up to a constant, to
        # minimizing +0.5 * Z0*Z1. RZZ(gamma) applies that cost phase.
        circuit.rzz(gamma, 0, 1)
        circuit.rx(2 * beta, 0)
        circuit.rx(2 * beta, 1)
    if measure:
        circuit.measure_all()
    return circuit


def run_demo(*, depth: int = 1, shots: int = 256, seed: int = 7) -> dict[str, object]:
    """Optimize parameters, sample candidates, and return observed results."""

    if depth < 1 or shots < 1:
        raise ValueError("depth and shots must be positive integers")
    cost_operator = SparsePauliOp.from_list([("II", -0.5), ("ZZ", 0.5)])
    rng = np.random.default_rng(seed)
    initial = np.concatenate((
        rng.uniform(0, 2 * math.pi, depth),
        rng.uniform(0, math.pi, depth),
    ))

    def expectation(angles: np.ndarray) -> float:
        state = Statevector.from_instruction(_circuit(angles, depth))
        return float(np.real(state.expectation_value(cost_operator)))

    optimizer_result = minimize(
        expectation, initial, method="COBYLA", options={"maxiter": 40}
    )
    simulator = AerSimulator()
    measured = transpile(_circuit(optimizer_result.x, depth, measure=True), simulator)
    counts = {
        str(bits): int(number)
        for bits, number in simulator.run(
            measured, shots=shots, seed_simulator=seed
        ).result().get_counts().items()
    }
    # This graph has a single edge: a measured bitstring cuts it exactly when
    # its two bits differ. Qiskit prints qubit zero on the right-hand side.
    ranked = sorted(
        ({"bitstring": bits, "count": count,
          "cut_value": int(bits.replace(" ", "")[0] != bits.replace(" ", "")[-1])}
         for bits, count in counts.items()),
        key=lambda row: (-int(row["cut_value"]), -int(row["count"]), str(row["bitstring"])),
    )
    return {
        "problem": "Max-Cut on two vertices joined by one edge",
        "cost_operator": str(cost_operator),
        "best_measured_candidate": ranked[0],
        "ranked_candidates": ranked,
        "counts": counts,
        "qaoa_depth": depth,
        "shots": shots,
        "optimizer": {"name": "COBYLA", "success": bool(optimizer_result.success),
                      "message": str(optimizer_result.message),
                      "iterations": int(getattr(optimizer_result, "nit", 0))},
        "warning": "A finite-shot local simulator demo does not establish quantum advantage.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--depth", type=int, default=1)
    parser.add_argument("--shots", type=int, default=256)
    parser.add_argument("--seed", type=int, default=7)
    arguments = parser.parse_args()
    result = run_demo(depth=arguments.depth, shots=arguments.shots, seed=arguments.seed)
    print("Educational QAOA simulator run")
    print(f"Problem: {result['problem']}")
    print(f"Cost operator: {result['cost_operator']}")
    print(f"Depth p: {result['qaoa_depth']}; shots: {result['shots']}")
    print(f"Measured counts: {result['counts']}")
    print(f"Best measured candidate: {result['best_measured_candidate']}")
    print(str(result["warning"]))


if __name__ == "__main__":
    main()
