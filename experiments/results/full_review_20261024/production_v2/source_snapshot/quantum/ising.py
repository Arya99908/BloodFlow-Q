"""Convert a BloodFlow-Q binary QUBO into a Qiskit Ising cost Hamiltonian."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from qiskit.quantum_info import SparsePauliOp

from quantum.qubo import QUBOInputError, QUBOResult


@dataclass(frozen=True)
class IsingRepresentation:
    """Ising operator, scalar offset, and the original QUBO mapping.

    The Pauli convention is ``z[i] = +1`` for QUBO bit ``x[i] = 0`` and
    ``z[i] = -1`` for ``x[i] = 1``. Qiskit Pauli strings display qubit zero at
    the right-most character, but ``variable_mapping`` remains indexed from
    zero exactly as it was in the QUBO.
    """

    cost_hamiltonian: SparsePauliOp
    constant_offset: float
    linear_z: tuple[float, ...]
    quadratic_zz: tuple[tuple[int, int, float], ...]
    variable_mapping: tuple
    qubo: QUBOResult

    @property
    def num_qubits(self) -> int:
        return self.qubo.variable_count

    def energy(self, bits: str | Sequence[int], *, string_bit_order: str = "qiskit") -> float:
        """Evaluate the Ising polynomial for one mapping or Qiskit bitstring."""

        binary = _normalize_bits(bits, self.num_qubits, string_bit_order)
        spins = tuple(1 - 2 * bit for bit in binary)
        value = self.constant_offset
        value += sum(coefficient * spins[index]
                     for index, coefficient in enumerate(self.linear_z))
        value += sum(coefficient * spins[left] * spins[right]
                     for left, right, coefficient in self.quadratic_zz)
        return float(value)


def _normalize_bits(
    bits: str | Sequence[int], num_qubits: int, string_bit_order: str
) -> tuple[int, ...]:
    if isinstance(bits, str):
        compact = bits.replace(" ", "")
        if len(compact) != num_qubits:
            raise QUBOInputError(f"bits: expected {num_qubits} values, received {len(compact)}")
        if any(char not in "01" for char in compact):
            raise QUBOInputError("bits: expected only '0' and '1'")
        if string_bit_order == "qiskit":
            compact = compact[::-1]
        elif string_bit_order != "mapping":
            raise QUBOInputError("string_bit_order: expected 'qiskit' or 'mapping'")
        return tuple(int(char) for char in compact)
    if isinstance(bits, (bytes, bytearray)):
        raise QUBOInputError("bits: use a string or a sequence of binary integers")
    try:
        vector = tuple(bits)
    except TypeError as error:
        raise QUBOInputError("bits: expected a string or sequence") from error
    if len(vector) != num_qubits:
        raise QUBOInputError(f"bits: expected {num_qubits} values, received {len(vector)}")
    if any(not isinstance(bit, (int, bool)) or bit not in (0, 1) for bit in vector):
        raise QUBOInputError("bits: every value must be 0 or 1")
    return tuple(int(bit) for bit in vector)


def convert_qubo_to_ising(qubo: QUBOResult) -> IsingRepresentation:
    """Return an equivalent Z/ZZ Hamiltonian, preserving all QUBO bit indices.

    Uses ``x_i = (1 - z_i) / 2`` with spin values ``z_i in {-1,+1}``. Since
    ``Q`` is symmetric, ``x.T Q x`` has diagonal terms once and off-diagonal
    terms twice; both are accounted for in the coefficient expansion.
    """

    if not isinstance(qubo, QUBOResult):
        raise QUBOInputError("qubo: expected a QUBOResult")
    size = qubo.variable_count
    if size == 0:
        raise QUBOInputError("qubo: at least one binary variable is needed for an Ising operator")

    constant = qubo.constant_offset
    linear = [0.0] * size
    quadratic: list[tuple[int, int, float]] = []
    for index in range(size):
        diagonal = qubo.matrix[index][index]
        constant += diagonal / 2
        linear[index] -= diagonal / 2
    for left in range(size):
        for right in range(left + 1, size):
            # The symmetric matrix contributes 2*Qij*x_i*x_j.
            coefficient = qubo.matrix[left][right]
            if coefficient == 0:
                continue
            ising_coefficient = coefficient / 2
            constant += ising_coefficient
            linear[left] -= ising_coefficient
            linear[right] -= ising_coefficient
            quadratic.append((left, right, ising_coefficient))

    pauli_terms: list[tuple[str, float]] = []
    identity = "I" * size
    if constant != 0:
        pauli_terms.append((identity, float(constant)))
    for index, coefficient in enumerate(linear):
        if coefficient != 0:
            label = ["I"] * size
            label[size - index - 1] = "Z"
            pauli_terms.append(("".join(label), float(coefficient)))
    for left, right, coefficient in quadratic:
        label = ["I"] * size
        label[size - left - 1] = "Z"
        label[size - right - 1] = "Z"
        pauli_terms.append(("".join(label), float(coefficient)))
    if not pauli_terms:
        pauli_terms = [(identity, 0.0)]

    return IsingRepresentation(
        cost_hamiltonian=SparsePauliOp.from_list(pauli_terms, num_qubits=size),
        constant_offset=float(constant),
        linear_z=tuple(linear),
        quadratic_zz=tuple(quadratic),
        variable_mapping=qubo.variable_mapping,
        qubo=qubo,
    )

