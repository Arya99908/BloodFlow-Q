"""Binary QUBO representation of the small classical allocation model.

This module only builds and evaluates a QUBO. It does not run QAOA or any
other quantum algorithm. Every assignment is a bit string; groups of bits
encode bounded integer shipment, unmet-demand, and inventory-slack values.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Mapping, Sequence

from optimization.models import AllocationDecision, Scenario
from optimization.objective import ObjectiveConfig, _validate_secondary_penalties


class QUBOInputError(ValueError):
    """Raised when a scenario or QUBO configuration cannot be encoded."""


@dataclass(frozen=True)
class QUBOPenaltyConfig:
    """Explicit weights for the two hard equalities in the QUBO.

    Inventory use is represented by an equality with non-negative slack, and
    served plus unmet demand is represented by an equality. Penalties must be
    larger than the objective's conservative maximum range; the builder checks
    that condition so one unit of constraint violation cannot be worthwhile.
    """

    inventory_penalty_weight: float
    demand_penalty_weight: float

    def __post_init__(self) -> None:
        for name in ("inventory_penalty_weight", "demand_penalty_weight"):
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
                raise QUBOInputError(f"{name}: expected a finite number greater than zero")


@dataclass(frozen=True)
class QUBOVariable:
    """Human-readable meaning of one binary bit in the QUBO vector."""

    index: int
    name: str
    kind: str
    bit_position: int
    bit_weight: int
    upper_bound: int
    source: str | None = None
    hospital: str | None = None
    blood_group: str | None = None
    recipient_group: str | None = None
    decision_meaning: str = ""


@dataclass(frozen=True)
class DecodedQUBOAssignment:
    """Integer quantities decoded from one binary assignment."""

    allocation: tuple[AllocationDecision, ...]
    unmet_demand: Mapping[tuple[str, str], int]
    inventory_slack: Mapping[tuple[str, str], int]


@dataclass(frozen=True)
class QUBOAssignmentEvaluation:
    """Separate classical objective, constraint penalties, and QUBO energy."""

    decoded: DecodedQUBOAssignment
    classical_objective: float
    inventory_penalty: float
    demand_penalty: float
    total_penalty: float
    energy: float


@dataclass(frozen=True)
class QUBOResult:
    """A symmetric matrix Q and the constant needed for exact energy equality.

    The returned energy convention is ``constant_offset + z.T @ Q @ z``.
    ``Q`` is symmetric, so an unordered quadratic coefficient is split in
    half across its two matching off-diagonal cells. ``constant_offset`` is
    kept outside the matrix because a constant cannot be represented by
    ``z.T @ Q @ z`` when all bits are zero. Dropping it preserves minimizers,
    but callers comparing objective values must include it.
    """

    matrix: tuple[tuple[float, ...], ...]
    constant_offset: float
    variable_mapping: tuple[QUBOVariable, ...]
    metadata: Mapping[str, object]
    objective_config: ObjectiveConfig
    penalty_config: QUBOPenaltyConfig
    scenario: Scenario
    secondary_penalties: Mapping[str, float]
    _integer_bit_indices: Mapping[tuple[str, object], tuple[tuple[int, int], ...]]

    @property
    def variable_count(self) -> int:
        return len(self.variable_mapping)

    def energy(self, bits: Sequence[int]) -> float:
        """Return the full QUBO value, including the documented constant."""

        vector = _validate_bits(bits, self.variable_count)
        quadratic = sum(
            vector[row] * self.matrix[row][column] * vector[column]
            for row in range(self.variable_count)
            for column in range(self.variable_count)
        )
        return self.constant_offset + quadratic

    def decode(self, bits: Sequence[int]) -> DecodedQUBOAssignment:
        """Translate bits into shipment quantities, unmet demand, and slack."""

        vector = _validate_bits(bits, self.variable_count)

        def value(kind: str, key: object) -> int:
            return sum(vector[index] * weight for index, weight in self._integer_bit_indices.get((kind, key), ()))

        allocation = []
        for variable in self.scenario.allocation_variables():
            key = (variable.source, variable.destination, variable.blood_group, variable.recipient_group)
            quantity = value("allocation", key)
            if quantity:
                allocation.append(AllocationDecision(*key, quantity))

        unmet = {
            (hospital.id, group): value("unmet", (hospital.id, group))
            for hospital in self.scenario.hospitals
            for group in hospital.demand
        }
        slack = {
            (bank.id, group): value("slack", (bank.id, group))
            for bank in self.scenario.blood_banks
            for group, quantity in bank.inventory.items()
            if quantity > 0
        }
        return DecodedQUBOAssignment(tuple(allocation), unmet, slack)

    def evaluate_assignment(self, bits: Sequence[int]) -> QUBOAssignmentEvaluation:
        """Evaluate the classical linear cost and squared constraint penalties.

        This intentionally accepts infeasible bit strings. The classical cost
        uses the same unit costs and shortage coefficients as the shared
        objective, while the two penalty fields report equality violations.
        """

        decoded = self.decode(bits)
        banks = {bank.id: bank for bank in self.scenario.blood_banks}
        routes = {(route.source, route.destination): route for route in self.scenario.routes}
        hospitals = {hospital.id: hospital for hospital in self.scenario.hospitals}
        cost = self.objective_config.secondary_penalty_weight * sum(self.secondary_penalties.values())
        for decision in decoded.allocation:
            route = routes[(decision.source, decision.destination)]
            unit_cost = (
                self.objective_config.transportation_cost_weight * route.transport_cost
                + self.objective_config.transportation_time_weight * route.travel_time_minutes
            )
            cost += decision.quantity * unit_cost
        for (hospital_id, group), quantity in decoded.unmet_demand.items():
            urgency = hospitals[hospital_id].urgency[group]
            coefficient = self.objective_config.total_unmet_weight
            if urgency.category in {"high", "critical"}:
                coefficient += self.objective_config.critical_unmet_weight * urgency.priority_weight
            cost += quantity * coefficient

        used: dict[tuple[str, str], int] = {}
        served: dict[tuple[str, str], int] = {}
        for decision in decoded.allocation:
            source_key = (decision.source, decision.blood_group)
            demand_key = (decision.destination, decision.recipient_group)
            used[source_key] = used.get(source_key, 0) + decision.quantity
            served[demand_key] = served.get(demand_key, 0) + decision.quantity

        inventory_penalty = 0.0
        for bank in self.scenario.blood_banks:
            for group, available in bank.inventory.items():
                slack = decoded.inventory_slack.get((bank.id, group), 0)
                residual = used.get((bank.id, group), 0) + slack - available
                inventory_penalty += self.penalty_config.inventory_penalty_weight * residual**2
        demand_penalty = 0.0
        for hospital in self.scenario.hospitals:
            for group, requested in hospital.demand.items():
                residual = served.get((hospital.id, group), 0) + decoded.unmet_demand[(hospital.id, group)] - requested
                demand_penalty += self.penalty_config.demand_penalty_weight * residual**2

        total_penalty = inventory_penalty + demand_penalty
        return QUBOAssignmentEvaluation(
            decoded=decoded,
            classical_objective=cost,
            inventory_penalty=inventory_penalty,
            demand_penalty=demand_penalty,
            total_penalty=total_penalty,
            energy=self.energy(bits),
        )


def _validate_bits(bits: Sequence[int], expected_count: int) -> tuple[int, ...]:
    if isinstance(bits, (str, bytes)) or len(bits) != expected_count:
        raise QUBOInputError(f"bits: expected exactly {expected_count} binary values")
    vector = tuple(bits)
    if any(
        not isinstance(bit, (int, bool)) or bit not in (0, 1)
        for bit in vector
    ):
        raise QUBOInputError("bits: every value must be 0 or 1")
    return tuple(int(bit) for bit in vector)


def _binary_weights(upper_bound: int) -> tuple[int, ...]:
    """Return bit weights that represent every integer from zero to the bound.

    The final weight is shortened as needed. This avoids encoding values above
    a variable's valid range while retaining every integer value in range.
    Some quantities may have more than one bit representation; each still
    decodes to the same valid integer.
    """

    if upper_bound <= 0:
        return ()
    weights: list[int] = []
    covered_maximum = 0
    while covered_maximum < upper_bound:
        weight = min(1 << len(weights), upper_bound - covered_maximum)
        weights.append(weight)
        covered_maximum += weight
    return tuple(weights)


def _add_square(
    linear: list[float],
    quadratic: dict[tuple[int, int], float],
    constant: list[float],
    terms: Sequence[tuple[int, float]],
    offset: float,
    penalty: float,
) -> None:
    """Expand penalty * (offset + sum(coefficient * bit))**2."""

    constant[0] += penalty * offset**2
    for index, coefficient in terms:
        linear[index] += penalty * (coefficient**2 + 2 * offset * coefficient)
    for left in range(len(terms)):
        index_a, coefficient_a = terms[left]
        for index_b, coefficient_b in terms[left + 1 :]:
            pair = tuple(sorted((index_a, index_b)))
            quadratic[pair] = quadratic.get(pair, 0.0) + 2 * penalty * coefficient_a * coefficient_b


def build_qubo(
    scenario: Scenario,
    objective_config: ObjectiveConfig,
    penalty_config: QUBOPenaltyConfig,
    secondary_penalties: Mapping[str, float] | None = None,
) -> QUBOResult:
    """Encode BloodFlow-Q's objective and hard equalities as a QUBO.

    Allocation variables exist only for compatible group pairs on available
    routes, so those two hard rules need no penalty. Demand equations are
    ``shipments + unmet = requested``. Inventory equations are
    ``shipments + slack = available``. Both are squared and multiplied by
    explicit configurable penalties.
    """

    if not isinstance(scenario, Scenario):
        raise QUBOInputError("scenario: expected a validated Scenario")
    if not isinstance(objective_config, ObjectiveConfig):
        raise QUBOInputError("objective_config: expected an ObjectiveConfig")
    if not isinstance(penalty_config, QUBOPenaltyConfig):
        raise QUBOInputError("penalty_config: expected a QUBOPenaltyConfig")
    named_secondary = _validate_secondary_penalties(secondary_penalties)

    # All objective coefficients are non-negative, so this is a safe upper
    # bound on the spread between the cheapest and most expensive bit string.
    objective_upper_bound = 0.0
    integer_specs: list[tuple[str, object, int, str, dict[str, object]]] = []
    routes = {(route.source, route.destination): route for route in scenario.routes}
    for variable in scenario.allocation_variables():
        route = routes[(variable.source, variable.destination)]
        coefficient = (
            objective_config.transportation_cost_weight * route.transport_cost
            + objective_config.transportation_time_weight * route.travel_time_minutes
        )
        key = (variable.source, variable.destination, variable.blood_group, variable.recipient_group)
        objective_upper_bound += coefficient * variable.upper_bound
        integer_specs.append(("allocation", key, variable.upper_bound, "allocation shipment quantity", {
            "source": variable.source, "hospital": variable.destination,
            "blood_group": variable.blood_group, "recipient_group": variable.recipient_group,
        }))
    for hospital in scenario.hospitals:
        for group, demand in hospital.demand.items():
            urgency = hospital.urgency[group]
            coefficient = objective_config.total_unmet_weight
            if urgency.category in {"high", "critical"}:
                coefficient += objective_config.critical_unmet_weight * urgency.priority_weight
            objective_upper_bound += coefficient * demand
            if demand > 0:
                key = (hospital.id, group)
                integer_specs.append(("unmet", key, demand, "unmet demand for hospital/group", {
                    "hospital": hospital.id, "recipient_group": group,
                }))
    required_penalty = objective_upper_bound
    if penalty_config.inventory_penalty_weight <= required_penalty:
        raise QUBOInputError(
            "inventory_penalty_weight must be greater than the conservative "
            f"objective upper bound ({required_penalty:g})"
        )
    if penalty_config.demand_penalty_weight <= required_penalty:
        raise QUBOInputError(
            "demand_penalty_weight must be greater than the conservative "
            f"objective upper bound ({required_penalty:g})"
        )

    # Inventory slack turns each <= inventory limit into an equality. A
    # zero-inventory row has no possible shipment variable and needs no slack.
    for bank in scenario.blood_banks:
        for group, available in bank.inventory.items():
            if available > 0:
                key = (bank.id, group)
                integer_specs.append(("slack", key, available, "unused inventory needed to satisfy equality", {
                    "source": bank.id, "blood_group": group,
                }))

    mapping: list[QUBOVariable] = []
    bit_indices: dict[tuple[str, object], tuple[tuple[int, int], ...]] = {}
    for kind, key, upper_bound, meaning, entities in integer_specs:
        indices: list[tuple[int, int]] = []
        for position, weight in enumerate(_binary_weights(upper_bound)):
            index = len(mapping)
            indices.append((index, weight))
            mapping.append(QUBOVariable(
                index=index,
                name=f"{kind}[{key!r}].bit[{position}]",
                kind=kind,
                bit_position=position,
                bit_weight=weight,
                upper_bound=upper_bound,
                source=entities.get("source"),
                hospital=entities.get("hospital"),
                blood_group=entities.get("blood_group"),
                recipient_group=entities.get("recipient_group"),
                decision_meaning=f"{meaning}; this bit contributes {weight} unit(s)",
            ))
        bit_indices[(kind, key)] = tuple(indices)

    size = len(mapping)
    linear = [0.0] * size
    quadratic: dict[tuple[int, int], float] = {}
    constant = [0.0]
    # Linear objective terms. The optional secondary amount is a constant,
    # since no secondary decision model exists yet.
    constant[0] += objective_config.secondary_penalty_weight * sum(named_secondary.values())
    for variable in scenario.allocation_variables():
        key = (variable.source, variable.destination, variable.blood_group, variable.recipient_group)
        route = routes[(variable.source, variable.destination)]
        unit_cost = (
            objective_config.transportation_cost_weight * route.transport_cost
            + objective_config.transportation_time_weight * route.travel_time_minutes
        )
        for index, weight in bit_indices.get(("allocation", key), ()):
            linear[index] += unit_cost * weight
    for hospital in scenario.hospitals:
        for group in hospital.demand:
            key = (hospital.id, group)
            urgency = hospital.urgency[group]
            unit_cost = objective_config.total_unmet_weight
            if urgency.category in {"high", "critical"}:
                unit_cost += objective_config.critical_unmet_weight * urgency.priority_weight
            for index, weight in bit_indices.get(("unmet", key), ()):
                linear[index] += unit_cost * weight

    # Demand accounting equality: sum of shipments into row + unmet - demand = 0.
    allocation_variables = scenario.allocation_variables()
    for hospital in scenario.hospitals:
        for group, demand in hospital.demand.items():
            terms: list[tuple[int, float]] = []
            for variable in allocation_variables:
                if variable.destination == hospital.id and variable.recipient_group == group:
                    key = (variable.source, variable.destination, variable.blood_group, variable.recipient_group)
                    terms.extend((index, float(weight)) for index, weight in bit_indices[("allocation", key)])
            terms.extend((index, float(weight)) for index, weight in bit_indices.get(("unmet", (hospital.id, group)), ()))
            _add_square(linear, quadratic, constant, terms, -float(demand), penalty_config.demand_penalty_weight)

    # Inventory use inequality becomes an equality by adding bounded slack.
    for bank in scenario.blood_banks:
        for group, available in bank.inventory.items():
            terms = []
            for variable in allocation_variables:
                if variable.source == bank.id and variable.blood_group == group:
                    key = (variable.source, variable.destination, variable.blood_group, variable.recipient_group)
                    terms.extend((index, float(weight)) for index, weight in bit_indices[("allocation", key)])
            terms.extend((index, float(weight)) for index, weight in bit_indices.get(("slack", (bank.id, group)), ()))
            if available > 0 or terms:
                _add_square(linear, quadratic, constant, terms, -float(available), penalty_config.inventory_penalty_weight)

    matrix = [[0.0 for _ in range(size)] for _ in range(size)]
    for index, coefficient in enumerate(linear):
        matrix[index][index] += coefficient
    for (left, right), coefficient in quadratic.items():
        # z.T Q z counts a symmetric off-diagonal pair twice.
        matrix[left][right] += coefficient / 2
        matrix[right][left] += coefficient / 2

    return QUBOResult(
        matrix=tuple(tuple(row) for row in matrix),
        constant_offset=constant[0],
        variable_mapping=tuple(mapping),
        metadata={
            "variable_order": "variable_mapping index order",
            "binary_variable_count": size,
            "energy_convention": "constant_offset + z.T @ matrix @ z",
            "constant_offset": constant[0],
            "objective_upper_bound": objective_upper_bound,
            "penalty_safety_rule": "each equality penalty is strictly greater than objective_upper_bound",
            "penalty_weights": {
                "inventory": penalty_config.inventory_penalty_weight,
                "demand": penalty_config.demand_penalty_weight,
            },
            "constraints": {
                "demand": "sum shipments to (hospital, recipient group) + unmet = demand",
                "inventory": "sum shipments from (bank, supplied group) + slack = inventory",
                "compatibility": "incompatible shipment variables are omitted",
                "route_availability": "blocked or missing route shipment variables are omitted",
            },
            "synthetic_data_only": True,
            # Building a QUBO does not run a solver. Record the separate
            # execution path accurately so API and experiment tooling can
            # distinguish a built model from a measured QAOA result.
            "qaoa_status": "implemented_separately",
            "qaoa_solver_module": "quantum.qaoa_solver",
        },
        objective_config=objective_config,
        penalty_config=penalty_config,
        scenario=scenario,
        secondary_penalties=named_secondary,
        _integer_bit_indices=bit_indices,
    )
