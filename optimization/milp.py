"""Exact Mixed-Integer Linear Programming (MILP) solver for BloodFlow-Q.

This module provides a rigorous, scalable classical mathematical programming
baseline using SciPy's HiGHS-based branch-and-cut MILP solver (scipy.optimize.milp).
It solves the true integer linear allocation problem without requiring
exponential state enumeration or size caps, providing a fair and powerful
classical benchmark against QAOA and Greedy.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Mapping, Sequence

import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp

from optimization.constraints import validate_allocation
from optimization.models import AllocationDecision, Scenario
from optimization.objective import (
    ObjectiveConfig,
    ObjectiveResult,
    calculate_objective,
    _validate_secondary_penalties,
)


class MILPSolverError(RuntimeError):
    """Raised when the MILP solver encounters an infeasibility or solver failure."""


@dataclass(frozen=True)
class MILPResult:
    """Optimal integer solution and evaluation metrics from the MILP solver."""

    allocation: tuple[AllocationDecision, ...]
    unmet_demand: Mapping[tuple[str, str], int]
    objective_breakdown: ObjectiveResult
    objective_value: float
    feasibility_report: Mapping[str, object]
    status: str
    runtime_seconds: float


class MILPSolver:
    """Exact MILP solver implementing the BenchmarkableSolver protocol."""

    name = "milp"

    def solve(
        self,
        scenario: Scenario,
        objective_config: ObjectiveConfig,
        secondary_penalties: Mapping[str, float] | None = None,
    ) -> MILPResult:
        """Solve the blood allocation problem to global optimality via MILP."""

        start_time = time.perf_counter()
        named_secondary = _validate_secondary_penalties(secondary_penalties)
        secondary_cost = objective_config.secondary_penalty_weight * sum(named_secondary.values())

        allocation_vars = scenario.allocation_variables()
        routes = {(r.source, r.destination): r for r in scenario.routes}

        # Build variable index lists
        # Decision variables: [x_0, ..., x_{K-1}, u_0, ..., u_{M-1}]
        num_x = len(allocation_vars)
        
        # Build unmet demand variable index mapping
        demand_rows: list[tuple[str, str, int]] = []
        for hospital in scenario.hospitals:
            for group, req in hospital.demand.items():
                if req > 0:
                    demand_rows.append((hospital.id, group, req))
        num_u = len(demand_rows)
        num_vars = num_x + num_u

        if num_vars == 0:
            # Degenerate empty scenario
            empty_allocation: tuple[AllocationDecision, ...] = ()
            empty_unmet: dict[tuple[str, str], int] = {}
            report = validate_allocation(scenario, empty_allocation, empty_unmet)
            obj = calculate_objective(scenario, empty_allocation, objective_config, secondary_penalties=named_secondary)
            return MILPResult(
                allocation=empty_allocation,
                unmet_demand=empty_unmet,
                objective_breakdown=obj,
                objective_value=obj.total_objective,
                feasibility_report=report,
                status="completed",
                runtime_seconds=time.perf_counter() - start_time,
            )

        c = np.zeros(num_vars, dtype=float)
        lb = np.zeros(num_vars, dtype=float)
        ub = np.zeros(num_vars, dtype=float)

        # Objective coefficients and bounds for x (shipments)
        for i, var in enumerate(allocation_vars):
            route = routes[(var.source, var.destination)]
            unit_cost = (
                objective_config.transportation_cost_weight * route.transport_cost
                + objective_config.transportation_time_weight * route.travel_time_minutes
            )
            c[i] = unit_cost
            lb[i] = 0.0
            ub[i] = float(var.upper_bound)

        # Objective coefficients and bounds for u (unmet demand)
        hospitals = {h.id: h for h in scenario.hospitals}
        for j, (h_id, group, req) in enumerate(demand_rows):
            var_idx = num_x + j
            urgency = hospitals[h_id].urgency[group]
            unit_penalty = objective_config.total_unmet_weight
            if urgency.category in {"high", "critical"}:
                unit_penalty += objective_config.critical_unmet_weight * urgency.priority_weight
            c[var_idx] = unit_penalty
            lb[var_idx] = 0.0
            ub[var_idx] = float(req)

        # All variables are integer
        integrality = np.ones(num_vars, dtype=int)

        # Constraints:
        # 1. Demand equalities: for each (hospital, recipient_group): sum(x) + u == demand
        # 2. Inventory inequalities: for each (bank, supplied_group): sum(x) <= inventory
        num_demand_constraints = len(demand_rows)
        # Unique bank inventory rows:
        bank_inv_rows: list[tuple[str, str, int]] = []
        for bank in scenario.blood_banks:
            for group, avail in bank.inventory.items():
                bank_inv_rows.append((bank.id, group, avail))
        num_inv_constraints = len(bank_inv_rows)

        total_constraints = num_demand_constraints + num_inv_constraints
        A = np.zeros((total_constraints, num_vars), dtype=float)
        lhs = np.zeros(total_constraints, dtype=float)
        rhs = np.zeros(total_constraints, dtype=float)

        # 1. Fill Demand constraints (equalities)
        for row_idx, (h_id, group, req) in enumerate(demand_rows):
            # sum of shipments to (h_id, group)
            for x_idx, var in enumerate(allocation_vars):
                if var.destination == h_id and var.recipient_group == group:
                    A[row_idx, x_idx] = 1.0
            # + u_{h_id, group}
            u_idx = num_x + row_idx
            A[row_idx, u_idx] = 1.0
            lhs[row_idx] = float(req)
            rhs[row_idx] = float(req)

        # 2. Fill Inventory constraints (inequalities: sum(x) <= available)
        for inv_idx, (b_id, group, avail) in enumerate(bank_inv_rows):
            row_idx = num_demand_constraints + inv_idx
            for x_idx, var in enumerate(allocation_vars):
                if var.source == b_id and var.blood_group == group:
                    A[row_idx, x_idx] = 1.0
            lhs[row_idx] = 0.0
            rhs[row_idx] = float(avail)

        constraints = LinearConstraint(A, lhs, rhs)
        bounds = Bounds(lb, ub)

        res = milp(c=c, integrality=integrality, bounds=bounds, constraints=constraints)

        if not res.success:
            raise MILPSolverError(f"MILP solver failed: {res.status} ({res.message})")

        sol = np.round(res.x).astype(int)

        # Decode solution
        allocation_list: list[AllocationDecision] = []
        for i, var in enumerate(allocation_vars):
            qty = int(sol[i])
            if qty > 0:
                allocation_list.append(
                    AllocationDecision(
                        source=var.source,
                        destination=var.destination,
                        blood_group=var.blood_group,
                        recipient_group=var.recipient_group,
                        quantity=qty,
                    )
                )

        unmet_dict: dict[tuple[str, str], int] = {}
        for j, (h_id, group, _) in enumerate(demand_rows):
            u_qty = int(sol[num_x + j])
            unmet_dict[(h_id, group)] = u_qty

        # Also account for any 0-demand rows
        for hospital in scenario.hospitals:
            for group, req in hospital.demand.items():
                if (hospital.id, group) not in unmet_dict:
                    unmet_dict[(hospital.id, group)] = 0

        allocation_tuple = tuple(allocation_list)
        report = validate_allocation(scenario, allocation_tuple, unmet_dict)
        obj_breakdown = calculate_objective(
            scenario,
            allocation_tuple,
            objective_config,
            secondary_penalties=named_secondary,
        )

        return MILPResult(
            allocation=allocation_tuple,
            unmet_demand=unmet_dict,
            objective_breakdown=obj_breakdown,
            objective_value=obj_breakdown.total_objective,
            feasibility_report=report,
            status="completed" if report["feasible"] else "infeasible",
            runtime_seconds=time.perf_counter() - start_time,
        )
