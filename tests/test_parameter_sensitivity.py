"""Test suite demonstrating parameter sensitivity of the optimization model.

Verifies that varying urgency weights, route costs, and unmet demand penalties
logically changes solver allocations, proving the mathematical formulation
is directly linked to operational decisions.
"""

import pytest

from optimization.milp import MILPSolver
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig


def _build_tradeoff_scenario() -> Scenario:
    """Scenario with a tradeoff between transport cost and meeting high urgency demand.

    Bank B1 has 2 units of O_POS.
    Hospital H1 has medium urgency demand for 2 units, nearby (cost = 1.0).
    Hospital H2 has critical urgency demand for 2 units, far away (cost = 20.0).
    """
    banks = (
        BloodBank("B1", "Bank 1", "L1", {"O_POS": 2}),
    )
    hospitals = (
        Hospital(
            "H1", "Hospital Near (Medium)", "L2",
            demand={"O_POS": 2},
            urgency={"O_POS": Urgency("medium", 1.0)},
        ),
        Hospital(
            "H2", "Hospital Far (Critical)", "L3",
            demand={"O_POS": 2},
            urgency={"O_POS": Urgency("critical", 10.0)},
        ),
    )
    routes = (
        Route("B1", "H1", travel_time_minutes=5.0, distance_km=2.0, transport_cost=1.0, status="available"),
        Route("B1", "H2", travel_time_minutes=45.0, distance_km=30.0, transport_cost=20.0, status="available"),
    )
    compatibility = {("O_POS", "O_POS"): True}
    return Scenario(
        id="sensitivity_tradeoff",
        blood_groups=("O_POS",),
        blood_banks=banks,
        hospitals=hospitals,
        routes=routes,
        compatibility=compatibility,
        synthetic=True,
    )


class TestParameterSensitivity:
    """Validate mathematical objective responsiveness to weighting configurations."""

    def test_urgency_priority_overcomes_distance_when_urgency_weight_high(self):
        scenario = _build_tradeoff_scenario()
        solver = MILPSolver()

        # High critical urgency weight: should favor sending units to H2 despite high transport cost
        high_urgency_cfg = ObjectiveConfig(
            critical_unmet_weight=50.0,
            total_unmet_weight=1.0,
            transportation_cost_weight=0.1,
            transportation_time_weight=0.01,
            secondary_penalty_weight=0.0,
        )
        res_urgency = solver.solve(scenario, high_urgency_cfg)
        assert res_urgency.feasibility_report["feasible"] is True

        h2_alloc = sum(a.quantity for a in res_urgency.allocation if a.destination == "H2")
        assert h2_alloc == 2, "High urgency weight must prioritize Critical hospital H2"

    def test_transport_weight_minimizes_distance_when_urgency_weight_low(self):
        scenario = _build_tradeoff_scenario()
        solver = MILPSolver()

        # Distance-sensitive weights: positive unmet penalty so units are shipped, but zero urgency weight so low-cost route to H1 is preferred
        cost_dominant_cfg = ObjectiveConfig(
            critical_unmet_weight=0.0,
            total_unmet_weight=50.0,
            transportation_cost_weight=1.0,
            transportation_time_weight=0.1,
            secondary_penalty_weight=0.0,
        )
        res_cost = solver.solve(scenario, cost_dominant_cfg)
        assert res_cost.feasibility_report["feasible"] is True

        h1_alloc = sum(a.quantity for a in res_cost.allocation if a.destination == "H1")
        assert h1_alloc == 2, "Dominant transport weight must prioritize low-cost route to H1"

    def test_unmet_demand_penalty_forces_full_available_supply_usage(self):
        scenario = _build_tradeoff_scenario()
        solver = MILPSolver()

        # Normal weights: unmet demand penalty > transport cost -> both available units are shipped
        normal_cfg = ObjectiveConfig(
            critical_unmet_weight=10.0,
            total_unmet_weight=20.0,
            transportation_cost_weight=1.0,
            transportation_time_weight=0.1,
            secondary_penalty_weight=0.0,
        )
        res = solver.solve(scenario, normal_cfg)
        total_shipped = sum(a.quantity for a in res.allocation)
        assert total_shipped == 2, "Units should not sit idle when demand exists"
