"""Application service layer: API requests call the existing optimization engine here."""

from __future__ import annotations

import logging
import json
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from backend.data_loader import load_data
from backend.scenario_factory import scenario_from_loaded_data
from backend.schemas import (
    BenchmarkRequest,
    DemoRunRequest,
    DemandSpikeInput,
    EmergencyRequest,
    HospitalPriorityChangeInput,
    InventoryReductionInput,
    ObjectiveWeightsInput,
    OptimizeRequest,
    QAOAConfigInput,
    QUBOPenaltiesInput,
    RouteDisruptionInput,
    ScenarioInput,
)
from emergency.reoptimization import (
    QAOAUnavailableError,
    ReoptimizationError,
    run_emergency_reoptimization,
)
from emergency.simulator import (
    DemandSpike,
    EmergencyEventError,
    HospitalPriorityChange,
    InventoryReduction,
    RouteDisruption,
)
from optimization.benchmark import BenchmarkRecord, run_benchmark_suite
from optimization.decoder import evaluate_quantum_solution
from optimization.exact import ExactSolver, ExactSolverConfig, ExactSolverLimitError
from optimization.greedy import GreedyAllocator
from optimization.models import (
    AllocationDecision,
    BloodBank,
    Hospital,
    Route,
    Scenario,
    Urgency,
)
from optimization.objective import ObjectiveConfig, ObjectiveResult
from quantum.qubo import QUBOInputError, QUBOPenaltyConfig, build_qubo
try:
    from quantum.qaoa_solver import QAOAConfig, QAOAResourceLimitError, QAOASolver, QAOASolverError
    _QAOA_IMPORT_ERROR: Exception | None = None
except Exception as import_error:  # Keep classical API endpoints available without Qiskit/Aer.
    QAOAConfig = None  # type: ignore[assignment,misc]
    QAOASolver = None  # type: ignore[assignment,misc]

    class QAOAResourceLimitError(ValueError):
        """Fallback exception type used when QAOA dependencies cannot import."""

    class QAOASolverError(RuntimeError):
        """Fallback exception type used when QAOA dependencies cannot import."""

    _QAOA_IMPORT_ERROR = import_error
from backend.demo_scenarios import build_demo_case, demo_catalog_payload

logger = logging.getLogger(__name__)


def _qaoa_unavailable_detail() -> str:
    if _QAOA_IMPORT_ERROR is not None:
        return f"QAOA dependencies could not be imported ({type(_QAOA_IMPORT_ERROR).__name__}: {_QAOA_IMPORT_ERROR})"
    return "QAOA is not configured"


class APIServiceError(Exception):
    """Expected error with an HTTP status and safe, readable detail."""

    def __init__(self, status_code: int, detail: str, code: str = "request_error") -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.code = code


class QAOASolverAdapter:
    """Small adapter that lets the shared benchmark call a QUBO-based QAOA solver."""

    name = "qaoa"

    def __init__(self, solver, penalties: QUBOPenaltyConfig) -> None:
        self.solver = solver
        self.penalties = penalties

    def solve(self, scenario, objective_config, secondary_penalties=None):
        qubo = build_qubo(scenario, objective_config, self.penalties, secondary_penalties)
        run = self.solver.solve(qubo)
        bitstring = _extract_best_bitstring(run)
        return evaluate_quantum_solution(qubo, bitstring)


def _extract_best_bitstring(result):
    if isinstance(result, str):
        return result
    if isinstance(result, Mapping):
        value = result.get("best_bitstring")
    else:
        value = getattr(result, "best_bitstring", None)
    if isinstance(value, (str, tuple, list)):
        return value
    raise ValueError("QAOA solver returned no best_bitstring")


def scenario_input_to_domain(value: ScenarioInput) -> Scenario:
    """Translate validated API fields to the shared domain model."""

    compatibility: dict[tuple[str, str], bool] = {}
    for row in value.compatibility:
        pair = (row.donor_group, row.recipient_group)
        if pair in compatibility:
            raise APIServiceError(422, f"duplicate compatibility rule for {pair!r}", "invalid_scenario")
        compatibility[pair] = row.allowed
    try:
        return Scenario(
            id=value.id,
            blood_groups=tuple(value.blood_groups),
            blood_banks=tuple(BloodBank(
                row.id, row.name, row.location_id, dict(row.inventory)
            ) for row in value.blood_banks),
            hospitals=tuple(Hospital(
                row.id, row.name, row.location_id, dict(row.demand),
                {group: Urgency(item.category, item.priority_weight)
                 for group, item in row.urgency.items()},
            ) for row in value.hospitals),
            routes=tuple(Route(
                row.source, row.destination, row.travel_time_minutes,
                row.distance_km, row.transport_cost, row.status,
            ) for row in value.routes),
            compatibility=compatibility,
            synthetic=value.synthetic,
        )
    except (TypeError, ValueError, KeyError) as error:
        raise APIServiceError(422, f"scenario is invalid: {error}", "invalid_scenario") from error


def scenario_to_payload(scenario: Scenario) -> dict[str, Any]:
    """Create a JSON-safe, synthetic-only scenario response."""

    return {
        "id": scenario.id,
        "synthetic": True,
        "blood_groups": list(scenario.blood_groups),
        "blood_banks": [
            {"id": bank.id, "name": bank.name, "location_id": bank.location_id,
             "inventory": dict(bank.inventory)}
            for bank in scenario.blood_banks
        ],
        "hospitals": [
            {"id": hospital.id, "name": hospital.name,
             "location_id": hospital.location_id,
             "demand": dict(hospital.demand),
             "urgency": {group: {"category": item.category,
                                   "priority_weight": item.priority_weight}
                         for group, item in hospital.urgency.items()}}
            for hospital in scenario.hospitals
        ],
        "routes": [asdict(route) for route in scenario.routes],
        "compatibility": [
            {"donor_group": donor, "recipient_group": recipient, "allowed": allowed}
            for (donor, recipient), allowed in scenario.compatibility.items()
        ],
    }


def _objective_weights(value: ObjectiveWeightsInput) -> ObjectiveConfig:
    return ObjectiveConfig(
        critical_unmet_weight=value.critical_unmet_weight,
        total_unmet_weight=value.total_unmet_weight,
        transportation_cost_weight=value.transportation_cost_weight,
        transportation_time_weight=value.transportation_time_weight,
        secondary_penalty_weight=value.secondary_penalty_weight,
    )


def _qubo_penalties(value: QUBOPenaltiesInput | None) -> QUBOPenaltyConfig | None:
    if value is None:
        return None
    return QUBOPenaltyConfig(value.inventory_penalty_weight, value.demand_penalty_weight)


def _qaoa_config(value: QAOAConfigInput | None) -> QAOAConfig | None:
    if value is None:
        return None
    if QAOAConfig is None:
        return None
    return QAOAConfig(p=value.p, shots=value.shots, optimizer=value.optimizer,
                      max_iterations=value.max_iterations, seed=value.seed)


def _allocation_rows(allocation) -> list[dict[str, object]]:
    return [asdict(item) for item in allocation]


def _unmet_rows(unmet: Mapping[tuple[str, str], int]) -> list[dict[str, object]]:
    return [
        {"hospital_id": hospital, "blood_group": group, "units": quantity}
        for (hospital, group), quantity in sorted(unmet.items())
    ]


def _objective_payload(result: ObjectiveResult) -> dict[str, object]:
    return {
        "critical_unmet_units": result.critical_unmet_units,
        "priority_weighted_critical_unmet": result.priority_weighted_critical_unmet,
        "total_unmet_units": result.total_unmet_units,
        "unmet_by_hospital_and_group": _unmet_rows(result.unmet_by_hospital_and_group),
        "transportation_cost": result.transportation_cost,
        "transportation_time": result.transportation_time,
        "secondary_penalties": dict(result.secondary_penalties),
        "secondary_penalty_total": result.secondary_penalty_total,
        "critical_unmet_penalty": result.critical_unmet_penalty,
        "total_unmet_penalty": result.total_unmet_penalty,
        "transportation_cost_penalty": result.transportation_cost_penalty,
        "transportation_time_penalty": result.transportation_time_penalty,
        "secondary_penalty_cost": result.secondary_penalty_cost,
        "total_objective": result.total_objective,
    }


def _critical_satisfaction(scenario: Scenario, allocation) -> dict[str, int | float | None]:
    critical_total = sum(
        hospital.demand[group]
        for hospital in scenario.hospitals
        for group in hospital.demand
        if hospital.urgency[group].category in {"high", "critical"}
    )
    served: dict[tuple[str, str], int] = {}
    for row in allocation:
        key = (row.destination, row.recipient_group)
        served[key] = served.get(key, 0) + row.quantity
    met = sum(
        min(hospital.demand[group], served.get((hospital.id, group), 0))
        for hospital in scenario.hospitals
        for group in hospital.demand
        if hospital.urgency[group].category in {"high", "critical"}
    )
    return {"satisfied_units": met, "total_units": critical_total,
            "rate": met / critical_total if critical_total else None}


def optimization_result_payload(scenario: Scenario, method: str, result) -> dict[str, Any]:
    report = result.feasibility_report
    objective = result.objective_breakdown
    allocation = tuple(result.allocation)
    unmet = dict(result.unmet_demand)
    shipped = sum(row.quantity for row in allocation)
    return {
        "scenario_id": scenario.id,
        "method": method,
        "status": "completed" if report.get("feasible", False) else "infeasible",
        "feasibility": bool(report.get("feasible", False)),
        "violations": list(report.get("violations", [])),
        "allocation": _allocation_rows(allocation),
        "unmet_demand": _unmet_rows(unmet),
        "objective_breakdown": _objective_payload(objective),
        "total_objective": objective.total_objective,
        "critical_satisfaction": _critical_satisfaction(scenario, allocation),
        "total_unmet_demand": sum(unmet.values()),
        "transport_cost": objective.transportation_cost,
        "average_transport_time": objective.transportation_time / shipped if shipped else None,
        "objective_basis": getattr(result, "objective_basis", None),
    }


def _event_to_domain(value):
    if isinstance(value, DemandSpikeInput):
        urgency = Urgency(value.urgency.category, value.urgency.priority_weight) if value.urgency else None
        return DemandSpike(value.hospital_id, value.blood_group, value.new_demand, urgency)
    if isinstance(value, InventoryReductionInput):
        return InventoryReduction(value.bank_id, value.blood_group, value.units_to_remove)
    if isinstance(value, RouteDisruptionInput):
        return RouteDisruption(value.source, value.destination)
    if isinstance(value, HospitalPriorityChangeInput):
        return HospitalPriorityChange(
            value.hospital_id, value.blood_group,
            Urgency(value.urgency.category, value.urgency.priority_weight),
        )
    raise APIServiceError(422, "unsupported emergency event", "invalid_event")


def _emergency_report_payload(report) -> dict[str, Any]:
    def qaoa_summary(sample, qubo):
        """Keep the actual before/after sample details visible in API results."""
        if sample is None or qubo is None:
            return None
        return {
            "qubo_variable_count": qubo.variable_count,
            "best_measured_bitstring": sample.best_bitstring,
            "qubo_energy": sample.objective_value,
            "qaoa_depth": sample.qaoa_depth,
            "shots": sample.number_of_shots,
            "counts": dict(sample.counts),
            "optimizer_information": dict(sample.optimizer_information),
            "runtime_seconds": sample.runtime_seconds,
            "measured_mean_energy": sample.measured_mean_energy,
        }

    def metrics(value):
        return {
            "feasibility": value.feasibility,
            "violations": list(value.violations),
            "objective_breakdown": _objective_payload(value.objective_breakdown),
            "total_objective": value.total_objective,
            "critical_satisfaction": dict(value.critical_satisfaction),
            "total_unmet_demand": value.total_unmet_demand,
            "transport_cost": value.transport_cost,
            "average_transport_time": value.average_transport_time,
        }
    event = report.emergency_event
    if is_dataclass(event):
        event_data = asdict(event)
    else:
        event_data = {"kind": type(event).__name__}
    changes = [
        {"source": key[0], "destination": key[1], "blood_group": key[2],
         "recipient_group": key[3], "quantity_change": value}
        for key, value in report.allocation_changes.items()
    ]
    return {
        "original_scenario": scenario_to_payload(report.original_scenario),
        "emergency_event": event_data,
        "modified_scenario": scenario_to_payload(report.modified_scenario),
        "before_allocation": _allocation_rows(report.before_allocation),
        "after_allocation": _allocation_rows(report.after_allocation),
        "before_metrics": metrics(report.before_metrics),
        "after_metrics": metrics(report.after_metrics),
        "allocation_changes": changes,
        "feasibility_status": dict(report.feasibility_status),
        "method": report.method,
        "before_qaoa": qaoa_summary(report.before_qaoa_result, report.before_qubo),
        "after_qaoa": qaoa_summary(report.after_qaoa_result, report.after_qubo),
    }


_DEFAULT_QAOA = object()


class BackendService:
    """Orchestrates requests while delegating all allocation math to domain solvers."""

    def __init__(self, *, qaoa_solver=_DEFAULT_QAOA, greedy_solver=None, exact_solver_factory=None,
                 data_loader=load_data) -> None:
        # Production app uses the real local Qiskit simulator. Tests and callers
        # may pass None to explicitly disable QAOA, or inject a test adapter.
        self.qaoa_solver = (QAOASolver() if QAOASolver is not None else None) if qaoa_solver is _DEFAULT_QAOA else qaoa_solver
        self.greedy_solver = greedy_solver or GreedyAllocator()
        self.exact_solver_factory = exact_solver_factory or ExactSolver
        self.data_loader = data_loader
        self._results: list[dict[str, Any]] = []

    def _scenario(self, request_scenario: ScenarioInput | None) -> Scenario:
        if request_scenario is not None:
            return scenario_input_to_domain(request_scenario)
        return scenario_from_loaded_data(self.data_loader())

    def _save(self, endpoint: str, result: dict[str, Any]) -> None:
        self._results.append({
            "endpoint": endpoint,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "result": result,
        })
        del self._results[:-100]

    def health(self) -> dict[str, object]:
        return {"status": "ok", "synthetic_data_only": True,
                "qaoa_available": self.qaoa_solver is not None}

    def experiment_defaults(self) -> dict[str, object]:
        """Expose the real solver defaults so experiment controls are inspectable."""
        config = getattr(self.qaoa_solver, "config", None)
        return {
            "objective_weights": {
                "critical_unmet_weight": 10.0, "total_unmet_weight": 5.0,
                "transportation_cost_weight": 1.0,
                "transportation_time_weight": 0.1, "secondary_penalty_weight": 0.0,
            },
            "qaoa_available": self.qaoa_solver is not None,
            "qaoa_unavailable_reason": (str(_QAOA_IMPORT_ERROR)
                                         if self.qaoa_solver is None and _QAOA_IMPORT_ERROR else None),
            "qaoa_config": {"p": getattr(config, "p", 1), "shots": getattr(config, "shots", 256),
                             "optimizer": getattr(config, "optimizer", "COBYLA"),
                             "max_iterations": getattr(config, "max_iterations", 40),
                             "seed": getattr(config, "seed", 7)},
            "qaoa_penalties": None,
            "note": "QUBO penalty weights must be supplied explicitly for each QAOA run.",
        }

    def demo_scenarios(self) -> dict[str, object]:
        return demo_catalog_payload()

    def precomputed_demo(self) -> dict[str, Any]:
        """Load the checked-in, provenance-bearing demonstration measurements.

        The path is fixed by the application; callers cannot request arbitrary
        files. This is a historical experiment artifact, never a live result.
        """
        artifact = Path(__file__).resolve().parents[1] / "experiments" / "precomputed" / "hackathon_demo.json"
        try:
            with artifact.open(encoding="utf-8") as stream:
                payload = json.load(stream)
        except FileNotFoundError as error:
            raise APIServiceError(404, "No precomputed demo experiment is installed.",
                                  "precomputed_demo_unavailable") from error
        except (OSError, json.JSONDecodeError) as error:
            logger.exception("Could not read the precomputed demonstration artifact")
            raise APIServiceError(500, "The precomputed demo artifact could not be read.",
                                  "precomputed_demo_invalid") from error
        required = {"record_type", "created_at_utc", "runs", "reproducibility"}
        if not isinstance(payload, dict) or not required.issubset(payload) \
                or payload.get("record_type") != "bloodflow_precomputed_demo" \
                or not isinstance(payload.get("runs"), list):
            raise APIServiceError(500, "The precomputed demo artifact has an invalid structure.",
                                  "precomputed_demo_invalid")
        return payload

    def _solver_for(self, config: QAOAConfigInput | None):
        if self.qaoa_solver is None:
            return None
        if config is None:
            return self.qaoa_solver
        if QAOASolver is None or not isinstance(self.qaoa_solver, QAOASolver):
            raise APIServiceError(422, "Per-run QAOA settings require the configured Qiskit QAOA solver",
                                  "qaoa_configuration_unsupported")
        return QAOASolver(_qaoa_config(config))

    def get_scenario(self) -> dict[str, Any]:
        return scenario_to_payload(self._scenario(None))

    def results(self) -> dict[str, object]:
        return {"results": list(self._results)}

    def _quantum_result(self, scenario, weights, penalties, secondary_penalties=None, solver=None):
        solver = self.qaoa_solver if solver is None else solver
        if solver is None:
            raise APIServiceError(501, f"{_qaoa_unavailable_detail()}; no quantum result was generated",
                                  "qaoa_not_implemented")
        if penalties is None:
            raise APIServiceError(422, "qaoa_penalties are required for QAOA", "missing_qaoa_penalties")
        try:
            qubo = build_qubo(scenario, weights, penalties, secondary_penalties)
        except QUBOInputError as error:
            raise APIServiceError(422, str(error), "invalid_qubo_configuration") from error
        try:
            sample = solver.solve(qubo)
            evaluation = evaluate_quantum_solution(qubo, _extract_best_bitstring(sample))
        except QAOAResourceLimitError as error:
            raise APIServiceError(422, str(error), "qaoa_instance_too_large") from error
        except QAOASolverError as error:
            logger.warning("QAOA simulator failed: %s", error)
            raise APIServiceError(502, str(error), "qaoa_failure") from error
        except Exception as error:
            logger.exception("QAOA solver failed")
            raise APIServiceError(
                502, "QAOA solver failed. Check the backend logs for diagnostic details.",
                "qaoa_failure",
            ) from error
        if isinstance(sample, Mapping):
            sample_value = sample.get
        else:
            sample_value = lambda name, default=None: getattr(sample, name, default)
        metadata = {
            "qubo_variable_count": qubo.variable_count,
            "qaoa_depth": sample_value("qaoa_depth"),
            "shots": sample_value("number_of_shots", sample_value("shots")),
            "best_measured_bitstring": sample_value("best_bitstring"),
            "counts": dict(sample_value("counts", {})),
            "measured_mean_energy": sample_value("measured_mean_energy"),
            "qaoa_runtime_seconds": sample_value("runtime_seconds"),
            "optimizer_information": sample_value("optimizer_information"),
            "experiment_configuration": {
                "qaoa": {"p": solver.config.p, "shots": solver.config.shots,
                         "optimizer": solver.config.optimizer,
                         "max_iterations": solver.config.max_iterations,
                         "seed": solver.config.seed},
                "objective_weights": asdict(weights),
                "penalty_weights": asdict(penalties),
            },
        }
        return evaluation, metadata

    def optimize(self, request: OptimizeRequest) -> dict[str, Any]:
        scenario = self._scenario(request.scenario)
        weights = _objective_weights(request.objective_weights)
        qaoa_metadata = None
        solver = self._solver_for(request.qaoa_config) if request.method == "qaoa" else self.qaoa_solver
        try:
            if request.method == "greedy":
                result = self.greedy_solver.solve(scenario, weights)
            elif request.method == "exact":
                result = self.exact_solver_factory(
                    ExactSolverConfig(request.exact_max_candidate_states)
                ).solve(scenario, weights)
            else:
                result, qaoa_metadata = self._quantum_result(
                    scenario, weights, _qubo_penalties(request.qaoa_penalties)
                    , solver=solver
                )
        except APIServiceError:
            raise
        except ExactSolverLimitError as error:
            raise APIServiceError(422, str(error), "exact_instance_too_large") from error
        except Exception as error:
            logger.exception("%s optimizer failed", request.method)
            raise APIServiceError(
                500, f"The {request.method} optimizer failed. Check the backend logs for diagnostic details.",
                "optimizer_failure",
            ) from error
        payload = optimization_result_payload(scenario, request.method, result)
        if qaoa_metadata is not None:
            # These fields describe the executed sample; they do not alter the
            # solver or recompute its objective.
            payload.update(qaoa_metadata)
        self._save("/optimize", payload)
        return payload

    def simulate_emergency(self, request: EmergencyRequest) -> dict[str, Any]:
        scenario = self._scenario(request.scenario)
        event = _event_to_domain(request.event)
        weights = _objective_weights(request.objective_weights)
        penalties = _qubo_penalties(request.qaoa_penalties)
        try:
            report = run_emergency_reoptimization(
                scenario, event, weights, method=request.method,
                exact_config=ExactSolverConfig(request.exact_max_candidate_states),
                qaoa_solver=(self._solver_for(request.qaoa_config)
                             if request.method == "qaoa" else self.qaoa_solver),
                penalty_config=penalties,
            )
        except QAOAUnavailableError as error:
            detail = _qaoa_unavailable_detail() if self.qaoa_solver is None else str(error)
            raise APIServiceError(501, detail, "qaoa_not_implemented") from error
        except ExactSolverLimitError as error:
            raise APIServiceError(422, str(error), "exact_instance_too_large") from error
        except EmergencyEventError as error:
            raise APIServiceError(422, str(error), "invalid_event") from error
        except QUBOInputError as error:
            raise APIServiceError(422, str(error), "invalid_qubo_configuration") from error
        except QAOAResourceLimitError as error:
            raise APIServiceError(422, str(error), "qaoa_instance_too_large") from error
        except QAOASolverError as error:
            logger.warning("Emergency QAOA simulator failed: %s", error)
            raise APIServiceError(502, str(error), "qaoa_failure") from error
        except ReoptimizationError as error:
            raise APIServiceError(422, str(error), "reoptimization_error") from error
        except APIServiceError:
            raise
        except Exception as error:
            logger.exception("Emergency %s optimizer failed", request.method)
            status = 502 if request.method == "qaoa" else 500
            raise APIServiceError(
                status, f"Emergency {request.method} optimization failed. Check the backend logs for diagnostic details.",
                "optimizer_failure",
            ) from error
        payload = _emergency_report_payload(report)
        self._save("/simulate-emergency", payload)
        return payload

    def benchmark(self, request: BenchmarkRequest) -> dict[str, Any]:
        scenarios = (
            [scenario_input_to_domain(item) for item in request.scenarios]
            if request.scenarios is not None else [self._scenario(None)]
        )
        weights = _objective_weights(request.objective_weights)
        solver = self._solver_for(request.qaoa_config) if request.include_qaoa else self.qaoa_solver
        qaoa_adapter = None
        if request.include_qaoa:
            penalties = _qubo_penalties(request.qaoa_penalties)
            if solver is None:
                raise APIServiceError(501, f"{_qaoa_unavailable_detail()}; QAOA metrics will not be generated",
                                      "qaoa_not_implemented")
            if penalties is None:
                raise APIServiceError(422, "qaoa_penalties are required when include_qaoa is true",
                                      "missing_qaoa_penalties")
            qaoa_adapter = QAOASolverAdapter(solver, penalties)
        try:
            records = run_benchmark_suite(
                scenarios, weights,
                exact_config=ExactSolverConfig(request.exact_max_candidate_states),
                qaoa_solver=qaoa_adapter,
            )
        except QAOASolverError as error:
            logger.warning("Benchmark QAOA simulator failed: %s", error)
            raise APIServiceError(502, str(error), "qaoa_failure") from error
        except Exception as error:
            logger.exception("Benchmark optimizer failed")
            status = 502 if request.include_qaoa else 500
            if isinstance(error, QUBOInputError):
                status = 422
            if isinstance(error, QAOAResourceLimitError):
                status = 422
            raise APIServiceError(
                status, "Benchmark optimization failed. Check the backend logs for diagnostic details.",
                "benchmark_failure",
            ) from error
        payload = {
            "results": [record.to_dict() for record in records],
            "experiment_configuration": {
                "scenario_ids": [scenario.id for scenario in scenarios],
                "methods": ["greedy", "exact"] + (["qaoa"] if request.include_qaoa else []),
                "objective_weights": asdict(weights),
                "qaoa": asdict(solver.config) if request.include_qaoa and solver is not None else None,
                "penalty_weights": asdict(penalties) if request.include_qaoa else None,
                "exact_max_candidate_states": request.exact_max_candidate_states,
            },
        }
        self._save("/benchmark", payload)
        return payload

    def run_demo(self, request: DemoRunRequest) -> dict[str, Any]:
        """Run one backend-owned demo case through the normal optimization path."""
        try:
            scenario, event = build_demo_case(self._scenario(None), request.scenario_id)
        except ValueError as error:
            raise APIServiceError(422, str(error), "invalid_demo_scenario") from error
        common = {
            "scenario": ScenarioInput.model_validate(scenario_to_payload(scenario)),
            "method": request.method,
            "objective_weights": request.objective_weights,
            "qaoa_penalties": request.qaoa_penalties,
            "qaoa_config": request.qaoa_config,
            "exact_max_candidate_states": request.exact_max_candidate_states,
        }
        if event is None:
            result = self.optimize(OptimizeRequest(**common))
            endpoint = "/demo-run"
        else:
            result = self.simulate_emergency(EmergencyRequest(
                **common,
                event=(
                    {"kind": "demand_spike", "hospital_id": event.hospital_id,
                     "blood_group": event.blood_group, "new_demand": event.new_demand,
                     "urgency": {"category": event.urgency.category,
                                 "priority_weight": event.urgency.priority_weight}}
                    if isinstance(event, DemandSpike)
                    else {"kind": "route_disruption", "source": event.source,
                          "destination": event.destination}
                ),
            ))
            endpoint = "/demo-run"
        effective_solver = self._solver_for(request.qaoa_config) if request.method == "qaoa" else None
        wrapped = {
            "scenario_id": request.scenario_id,
            "method": request.method,
            "experiment_configuration": {
                "objective_weights": asdict(_objective_weights(request.objective_weights)),
                "qaoa": asdict(effective_solver.config) if effective_solver is not None else None,
                "penalty_weights": (asdict(_qubo_penalties(request.qaoa_penalties))
                                    if request.qaoa_penalties is not None else None),
                "exact_max_candidate_states": request.exact_max_candidate_states,
            },
            "result": result,
        }
        self._save(endpoint, wrapped)
        return wrapped
