"""Test suite for the classical MILP solver baseline (scipy.optimize.milp / HiGHS)."""

import pytest

from backend.data_loader import load_data
from backend.scenario_factory import scenario_from_loaded_data
from optimization.exact import ExactSolver, ExactSolverConfig
from optimization.greedy import GreedyAllocator
from optimization.milp import MILPSolver
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig


def _build_test_scenario() -> Scenario:
    banks = (
        BloodBank("B1", "Bank 1", "L1", {"O_POS": 2, "A_POS": 1}),
        BloodBank("B2", "Bank 2", "L2", {"O_POS": 1, "A_POS": 2}),
    )
    hospitals = (
        Hospital(
            "H1", "Hospital 1", "L3",
            demand={"O_POS": 2, "A_POS": 1},
            urgency={
                "O_POS": Urgency("critical", 3.0),
                "A_POS": Urgency("medium", 1.0),
            },
        ),
        Hospital(
            "H2", "Hospital 2", "L4",
            demand={"O_POS": 1, "A_POS": 2},
            urgency={
                "O_POS": Urgency("high", 2.0),
                "A_POS": Urgency("critical", 3.0),
            },
        ),
    )
    routes = (
        Route("B1", "H1", travel_time_minutes=10.0, distance_km=5.0, transport_cost=2.0, status="available"),
        Route("B1", "H2", travel_time_minutes=25.0, distance_km=15.0, transport_cost=6.0, status="available"),
        Route("B2", "H1", travel_time_minutes=30.0, distance_km=18.0, transport_cost=7.0, status="available"),
        Route("B2", "H2", travel_time_minutes=12.0, distance_km=6.0, transport_cost=2.5, status="available"),
    )
    compatibility = {
        ("O_POS", "O_POS"): True,
        ("O_POS", "A_POS"): True,
        ("A_POS", "O_POS"): False,
        ("A_POS", "A_POS"): True,
    }
    return Scenario(
        id="milp_test",
        blood_groups=("O_POS", "A_POS"),
        blood_banks=banks,
        hospitals=hospitals,
        routes=routes,
        compatibility=compatibility,
        synthetic=True,
    )


class TestMILPSolver:
    """Validate the exact MILP optimization baseline."""

    def test_milp_matches_exact_solver_on_small_instance(self):
        scenario = _build_test_scenario()
        obj_cfg = ObjectiveConfig(10.0, 5.0, 1.0, 0.1, 0.0)

        milp_solver = MILPSolver()
        milp_res = milp_solver.solve(scenario, obj_cfg)

        exact_solver = ExactSolver(ExactSolverConfig(max_candidate_states=200000))
        exact_res = exact_solver.solve(scenario, obj_cfg)

        assert milp_res.feasibility_report["feasible"] is True
        assert exact_res.feasibility_report["feasible"] is True
        assert abs(milp_res.objective_breakdown.total_objective - exact_res.objective_breakdown.total_objective) < 1e-4

    def test_milp_beats_or_equals_greedy_on_bundled_dataset(self):
        data = load_data("data")
        scenario = scenario_from_loaded_data(data)
        obj_cfg = ObjectiveConfig(10.0, 5.0, 1.0, 0.1, 0.0)

        milp_solver = MILPSolver()
        milp_res = milp_solver.solve(scenario, obj_cfg)

        greedy_solver = GreedyAllocator()
        greedy_res = greedy_solver.solve(scenario, obj_cfg)

        assert milp_res.feasibility_report["feasible"] is True
        assert greedy_res.feasibility_report["feasible"] is True

        # MILP is globally optimal; its total objective must be <= greedy
        assert milp_res.objective_breakdown.total_objective <= greedy_res.objective_breakdown.total_objective + 1e-5

    def test_milp_respects_compatibility_and_disruptions(self):
        scenario = _build_test_scenario()
        # Disrupt B1 -> H1 route
        disrupted_routes = tuple(
            Route(r.source, r.destination, r.travel_time_minutes, r.distance_km, r.transport_cost,
                  status="blocked" if r.source == "B1" and r.destination == "H1" else "available")
            for r in scenario.routes
        )
        disrupted_scenario = Scenario(
            id=scenario.id,
            blood_groups=scenario.blood_groups,
            blood_banks=scenario.blood_banks,
            hospitals=scenario.hospitals,
            routes=disrupted_routes,
            compatibility=scenario.compatibility,
            synthetic=True,
        )

        solver = MILPSolver()
        res = solver.solve(disrupted_scenario, ObjectiveConfig(10.0, 5.0, 1.0, 0.1, 0.0))

        assert res.feasibility_report["feasible"] is True
        # Verify no flow along B1 -> H1
        for alloc in res.allocation:
            assert not (alloc.source == "B1" and alloc.destination == "H1")
            # Verify compatibility
            assert scenario.compatibility.get((alloc.blood_group, alloc.recipient_group), False) is True
