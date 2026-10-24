"""Decode measured QUBO bitstrings into readable synthetic shipments.

The decoder relies on the variable mapping attached to the QUBO builder. It
does not assume that allocation variables occupy particular bit positions.
This module only translates a candidate; it does not decide whether the
allocation is operationally feasible or suitable for clinical use.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from optimization.constraints import validate_allocation
from optimization.models import AllocationDecision
from optimization.objective import ObjectiveResult, calculate_objective
from quantum.qubo import DecodedQUBOAssignment, QUBOResult


class DecoderInputError(ValueError):
    """Raised when a measured bitstring cannot be decoded for this QUBO."""


@dataclass(frozen=True)
class SelectedBinaryVariable:
    """One selected binary variable with its builder-provided meaning."""

    index: int
    name: str
    kind: str
    bit_position: int
    bit_weight: int
    decision_meaning: str
    source_id: str | None
    hospital_id: str | None
    blood_group: str | None
    recipient_group: str | None
    quantity_contribution: int
    route: str | None
    route_travel_time_minutes: float | None
    route_transport_cost: float | None


@dataclass(frozen=True)
class HumanReadableAllocation:
    """A positive shipment with route estimates from the synthetic scenario."""

    blood_bank_id: str
    blood_bank: str
    hospital_id: str
    hospital: str
    blood_group: str
    recipient_group: str
    quantity: int
    decision: str
    route: str
    route_travel_time_minutes: float
    route_transport_cost: float
    shipment_travel_time_minutes: float
    shipment_transport_cost: float


@dataclass(frozen=True)
class QAOADecodingResult:
    """All decoded values plus selected bits and readable positive shipments."""

    bits_in_mapping_order: tuple[int, ...]
    selected_variables: tuple[SelectedBinaryVariable, ...]
    allocations: tuple[HumanReadableAllocation, ...]
    unmet_demand: dict[tuple[str, str], int]
    inventory_slack: dict[tuple[str, str], int]
    decoded_assignment: DecodedQUBOAssignment


@dataclass(frozen=True)
class QuantumSolutionEvaluation:
    """Decoded QAOA candidate and its classical validation/metrics.

    For an infeasible candidate, ``objective_breakdown`` still reports the
    unpenalized linear expression evaluated on the original encoded shipment
    and unmet-demand values. It is labeled with ``objective_basis`` and must
    not be interpreted as the score of a feasible allocation.
    """

    decoded_allocation: tuple[AllocationDecision, ...]
    unmet_demand: dict[tuple[str, str], int]
    feasibility: bool
    violations: tuple[dict[str, object], ...]
    objective_breakdown: ObjectiveResult
    total_objective: float
    critical_satisfaction: dict[str, int | float | None]
    total_unmet_demand: int
    transport_cost: float
    average_transport_time: float | None
    objective_basis: str
    decoded_candidate: QAOADecodingResult

    @property
    def allocation(self) -> tuple[AllocationDecision, ...]:
        """Alias matching the shared benchmark solver result interface."""

        return self.decoded_allocation

    @property
    def feasibility_report(self) -> dict[str, object]:
        """Expose the standard report shape expected by benchmark adapters."""

        return {
            "feasible": self.feasibility,
            "violations": list(self.violations),
        }


def _mapping_order_bits(
    qubo: QUBOResult,
    bitstring: str | Sequence[int],
    string_bit_order: str,
) -> tuple[int, ...]:
    """Normalize input to bit positions used by ``qubo.variable_mapping``."""

    count = qubo.variable_count
    if isinstance(bitstring, str):
        compact = bitstring.replace(" ", "")
        if len(compact) != count:
            raise DecoderInputError(
                f"bitstring: expected {count} bits, received {len(compact)}"
            )
        if any(char not in "01" for char in compact):
            raise DecoderInputError("bitstring: expected only '0' and '1'")
        if string_bit_order == "qiskit":
            # Qiskit count keys display the highest-index classical bit on the
            # left. QUBO mapping indices start at zero, so reverse the text.
            compact = compact[::-1]
        elif string_bit_order != "mapping":
            raise DecoderInputError("string_bit_order: expected 'qiskit' or 'mapping'")
        return tuple(int(char) for char in compact)

    if isinstance(bitstring, (bytes, bytearray)):
        raise DecoderInputError("bitstring: use a string or a sequence of binary integers")
    try:
        bits = tuple(bitstring)
    except TypeError as exc:
        raise DecoderInputError("bitstring: expected a string or sequence of bits") from exc
    if len(bits) != count:
        raise DecoderInputError(f"bitstring: expected {count} bits, received {len(bits)}")
    if any(not isinstance(bit, (int, bool)) or bit not in (0, 1) for bit in bits):
        raise DecoderInputError("bitstring: every value must be 0 or 1")
    return tuple(int(bit) for bit in bits)


def decode_qaoa_bitstring(
    qubo: QUBOResult,
    bitstring: str | Sequence[int],
    *,
    string_bit_order: str = "qiskit",
) -> QAOADecodingResult:
    """Decode one QAOA candidate using the QUBO's exact variable mapping.

    Args:
        qubo: The exact QUBO result used to create the QAOA cost operator.
        bitstring: A Qiskit count-key string or an integer sequence. String
            inputs default to Qiskit's displayed order (most-significant
            classical bit first); sequences are already in mapping index order.
        string_bit_order: Use ``"qiskit"`` for count keys or ``"mapping"`` if
            a textual bitstring has already been arranged in mapping order.

    Returns:
        The binary variables selected by the sample, decoded integer values,
        unmet demand and slack, and readable records for each positive
        shipment. Route time and cost are shown both per route unit and
        multiplied by the shipped quantity.
    """

    if not isinstance(qubo, QUBOResult):
        raise DecoderInputError("qubo: expected the QUBOResult used for this sample")
    bits = _mapping_order_bits(qubo, bitstring, string_bit_order)
    decoded = qubo.decode(bits)

    bank_names = {bank.id: bank.name for bank in qubo.scenario.blood_banks}
    hospital_names = {hospital.id: hospital.name for hospital in qubo.scenario.hospitals}
    routes = {
        (route.source, route.destination): route
        for route in qubo.scenario.routes
    }
    selected = tuple(
        SelectedBinaryVariable(
            index=item.index,
            name=item.name,
            kind=item.kind,
            bit_position=item.bit_position,
            bit_weight=item.bit_weight,
            decision_meaning=item.decision_meaning,
            source_id=item.source,
            hospital_id=item.hospital,
            blood_group=item.blood_group,
            recipient_group=item.recipient_group,
            quantity_contribution=item.bit_weight,
            route=(f"{item.source} -> {item.hospital}" if item.kind == "allocation" else None),
            route_travel_time_minutes=(
                routes[(item.source, item.hospital)].travel_time_minutes
                if item.kind == "allocation" else None
            ),
            route_transport_cost=(
                routes[(item.source, item.hospital)].transport_cost
                if item.kind == "allocation" else None
            ),
        )
        for item in qubo.variable_mapping
        if bits[item.index] == 1
    )
    allocations = tuple(
        HumanReadableAllocation(
            blood_bank_id=decision.source,
            blood_bank=bank_names[decision.source],
            hospital_id=decision.destination,
            hospital=hospital_names[decision.destination],
            blood_group=decision.blood_group,
            recipient_group=decision.recipient_group,
            quantity=decision.quantity,
            decision=f"ship {decision.quantity} unit(s)",
            route=f"{decision.source} -> {decision.destination}",
            route_travel_time_minutes=routes[(decision.source, decision.destination)].travel_time_minutes,
            route_transport_cost=routes[(decision.source, decision.destination)].transport_cost,
            shipment_travel_time_minutes=(
                decision.quantity
                * routes[(decision.source, decision.destination)].travel_time_minutes
            ),
            shipment_transport_cost=(
                decision.quantity
                * routes[(decision.source, decision.destination)].transport_cost
            ),
        )
        for decision in decoded.allocation
    )

    return QAOADecodingResult(
        bits_in_mapping_order=bits,
        selected_variables=selected,
        allocations=allocations,
        unmet_demand=dict(decoded.unmet_demand),
        inventory_slack=dict(decoded.inventory_slack),
        decoded_assignment=decoded,
    )


def _unvalidated_objective_breakdown(
    qubo: QUBOResult,
    decoded: DecodedQUBOAssignment,
) -> ObjectiveResult:
    """Score the QUBO's unpenalized linear terms without repairing the bits.

    ``calculate_objective`` intentionally rejects hard-constraint violations.
    This helper preserves the same objective expression for transparent
    reporting of an infeasible quantum sample; the separate feasibility flag
    and violations remain authoritative.
    """

    scenario = qubo.scenario
    config = qubo.objective_config
    hospitals = {hospital.id: hospital for hospital in scenario.hospitals}
    routes = {(route.source, route.destination): route for route in scenario.routes}
    critical_units = 0
    weighted_critical_units = 0.0
    total_unmet = 0
    unmet_by_row = dict(decoded.unmet_demand)
    for (hospital_id, group), amount in unmet_by_row.items():
        total_unmet += amount
        urgency = hospitals[hospital_id].urgency[group]
        if urgency.category in {"high", "critical"}:
            critical_units += amount
            weighted_critical_units += amount * urgency.priority_weight

    transport_cost = 0.0
    transport_time = 0.0
    for decision in decoded.allocation:
        route = routes[(decision.source, decision.destination)]
        transport_cost += decision.quantity * route.transport_cost
        transport_time += decision.quantity * route.travel_time_minutes
    secondary = dict(qubo.secondary_penalties)
    secondary_total = sum(secondary.values())
    critical_penalty = config.critical_unmet_weight * weighted_critical_units
    unmet_penalty = config.total_unmet_weight * total_unmet
    cost_penalty = config.transportation_cost_weight * transport_cost
    time_penalty = config.transportation_time_weight * transport_time
    secondary_cost = config.secondary_penalty_weight * secondary_total
    total = critical_penalty + unmet_penalty + cost_penalty + time_penalty + secondary_cost
    return ObjectiveResult(
        critical_unmet_units=critical_units,
        priority_weighted_critical_unmet=weighted_critical_units,
        total_unmet_units=total_unmet,
        unmet_by_hospital_and_group=unmet_by_row,
        transportation_cost=transport_cost,
        transportation_time=transport_time,
        secondary_penalties=secondary,
        secondary_penalty_total=secondary_total,
        critical_unmet_penalty=critical_penalty,
        total_unmet_penalty=unmet_penalty,
        transportation_cost_penalty=cost_penalty,
        transportation_time_penalty=time_penalty,
        secondary_penalty_cost=secondary_cost,
        total_objective=total,
    )


def evaluate_quantum_solution(
    qubo: QUBOResult,
    bitstring: str | Sequence[int],
    *,
    string_bit_order: str = "qiskit",
) -> QuantumSolutionEvaluation:
    """Decode, validate, and score one unmodified QAOA candidate.

    The candidate flows through the mapping-driven decoder, the shared
    classical feasibility validator, then the classical objective calculator
    when feasible. Infeasible samples are never repaired. Their original
    decoded values remain visible and receive an explicitly labeled raw
    objective-expression breakdown.
    """

    decoded_candidate = decode_qaoa_bitstring(
        qubo, bitstring, string_bit_order=string_bit_order
    )
    allocation = decoded_candidate.decoded_assignment.allocation
    unmet = decoded_candidate.unmet_demand
    report = validate_allocation(qubo.scenario, allocation, unmet)
    feasible = bool(report["feasible"])
    if feasible:
        breakdown = calculate_objective(
            qubo.scenario,
            allocation,
            qubo.objective_config,
            secondary_penalties=qubo.secondary_penalties,
        )
        objective_basis = "classical objective calculator on feasible allocation"
    else:
        breakdown = _unvalidated_objective_breakdown(
            qubo, decoded_candidate.decoded_assignment
        )
        objective_basis = (
            "unpenalized objective expression on original infeasible QUBO bits; "
            "not a feasible allocation score"
        )

    hospitals = {hospital.id: hospital for hospital in qubo.scenario.hospitals}
    served: dict[tuple[str, str], int] = {}
    for decision in allocation:
        key = (decision.destination, decision.recipient_group)
        served[key] = served.get(key, 0) + decision.quantity
    critical_demand_units = 0
    critical_satisfied_units = 0
    for hospital in qubo.scenario.hospitals:
        for group, demand in hospital.demand.items():
            if hospital.urgency[group].category in {"high", "critical"}:
                critical_demand_units += demand
                # Clamp to requested units for this descriptive satisfaction
                # metric. The validator still reports any over-allocation.
                critical_satisfied_units += min(demand, served.get((hospital.id, group), 0))
    critical_rate = (
        critical_satisfied_units / critical_demand_units
        if critical_demand_units
        else None
    )
    total_shipped = sum(decision.quantity for decision in allocation)
    average_time = breakdown.transportation_time / total_shipped if total_shipped else None
    return QuantumSolutionEvaluation(
        decoded_allocation=allocation,
        unmet_demand=unmet,
        feasibility=feasible,
        violations=tuple(report["violations"]),
        objective_breakdown=breakdown,
        total_objective=breakdown.total_objective,
        critical_satisfaction={
            "satisfied_units": critical_satisfied_units,
            "total_units": critical_demand_units,
            "rate": critical_rate,
        },
        total_unmet_demand=sum(unmet.values()),
        transport_cost=breakdown.transportation_cost,
        average_transport_time=average_time,
        objective_basis=objective_basis,
        decoded_candidate=decoded_candidate,
    )
