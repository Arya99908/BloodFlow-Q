"""Pydantic request and response models for the BloodFlow-Q API."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    """Reject misspelled or unexpected request fields instead of ignoring them."""

    model_config = ConfigDict(extra="forbid")


class UrgencyInput(StrictModel):
    category: Literal["low", "medium", "high", "critical"]
    priority_weight: float = Field(gt=0, allow_inf_nan=False)


class BloodBankInput(StrictModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    location_id: str = Field(min_length=1)
    inventory: dict[str, int]


class HospitalInput(StrictModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    location_id: str = Field(min_length=1)
    demand: dict[str, int]
    urgency: dict[str, UrgencyInput]


class RouteInput(StrictModel):
    source: str = Field(min_length=1)
    destination: str = Field(min_length=1)
    travel_time_minutes: float = Field(ge=0, allow_inf_nan=False)
    distance_km: float = Field(ge=0, allow_inf_nan=False)
    transport_cost: float = Field(ge=0, allow_inf_nan=False)
    status: Literal["available", "blocked"]


class CompatibilityRuleInput(StrictModel):
    donor_group: str = Field(min_length=1)
    recipient_group: str = Field(min_length=1)
    allowed: bool


class ScenarioInput(StrictModel):
    id: str = Field(min_length=1, default="api_scenario")
    blood_groups: list[str] = Field(min_length=1)
    blood_banks: list[BloodBankInput] = Field(min_length=1)
    hospitals: list[HospitalInput] = Field(min_length=1)
    routes: list[RouteInput]
    compatibility: list[CompatibilityRuleInput]
    synthetic: Literal[True] = True


class ObjectiveWeightsInput(StrictModel):
    critical_unmet_weight: float = Field(default=10, ge=0, allow_inf_nan=False)
    total_unmet_weight: float = Field(default=5, ge=0, allow_inf_nan=False)
    transportation_cost_weight: float = Field(default=1, ge=0, allow_inf_nan=False)
    transportation_time_weight: float = Field(default=0.1, ge=0, allow_inf_nan=False)
    secondary_penalty_weight: float = Field(default=0, ge=0, allow_inf_nan=False)


class QUBOPenaltiesInput(StrictModel):
    inventory_penalty_weight: float = Field(gt=0, allow_inf_nan=False)
    demand_penalty_weight: float = Field(gt=0, allow_inf_nan=False)


class QAOAConfigInput(StrictModel):
    """Reproducible controls passed to the real local QAOA simulator."""

    p: int = Field(default=1, ge=1, le=5)
    shots: int = Field(default=256, ge=1, le=10_000)
    optimizer: Literal["COBYLA", "Nelder-Mead", "Powell"] = "COBYLA"
    max_iterations: int = Field(default=40, ge=1, le=500)
    seed: int = Field(default=7, ge=0, le=4_294_967_295)


class OptimizeRequest(StrictModel):
    scenario: ScenarioInput | None = None
    method: Literal["greedy", "exact", "qaoa"] = "greedy"
    objective_weights: ObjectiveWeightsInput = Field(default_factory=ObjectiveWeightsInput)
    qaoa_penalties: QUBOPenaltiesInput | None = None
    qaoa_config: QAOAConfigInput | None = None
    # Do not let an API caller disable the exact solver's resource guard.
    exact_max_candidate_states: int = Field(default=50_000, ge=1, le=50_000)


class DemandSpikeInput(StrictModel):
    kind: Literal["demand_spike"]
    hospital_id: str
    blood_group: str
    new_demand: int = Field(ge=0)
    urgency: UrgencyInput | None = None


class InventoryReductionInput(StrictModel):
    kind: Literal["inventory_reduction"]
    bank_id: str
    blood_group: str
    units_to_remove: int = Field(ge=0)


class RouteDisruptionInput(StrictModel):
    kind: Literal["route_disruption"]
    source: str
    destination: str


class HospitalPriorityChangeInput(StrictModel):
    kind: Literal["hospital_priority_change"]
    hospital_id: str
    blood_group: str
    urgency: UrgencyInput


EmergencyEventInput = Annotated[
    DemandSpikeInput | InventoryReductionInput | RouteDisruptionInput | HospitalPriorityChangeInput,
    Field(discriminator="kind"),
]


class EmergencyRequest(StrictModel):
    scenario: ScenarioInput | None = None
    event: EmergencyEventInput
    method: Literal["greedy", "exact", "qaoa"] = "greedy"
    objective_weights: ObjectiveWeightsInput = Field(default_factory=ObjectiveWeightsInput)
    qaoa_penalties: QUBOPenaltiesInput | None = None
    qaoa_config: QAOAConfigInput | None = None
    exact_max_candidate_states: int = Field(default=50_000, ge=1, le=50_000)


class BenchmarkRequest(StrictModel):
    scenarios: list[ScenarioInput] | None = None
    include_qaoa: bool = False
    objective_weights: ObjectiveWeightsInput = Field(default_factory=ObjectiveWeightsInput)
    qaoa_penalties: QUBOPenaltiesInput | None = None
    qaoa_config: QAOAConfigInput | None = None
    exact_max_candidate_states: int = Field(default=50_000, ge=1, le=50_000)


class AllocationResponse(StrictModel):
    source: str
    destination: str
    blood_group: str
    recipient_group: str
    quantity: int


class HealthResponse(StrictModel):
    status: str
    synthetic_data_only: bool
    qaoa_available: bool


class OptimizationResponse(StrictModel):
    scenario_id: str
    method: str
    status: str
    feasibility: bool
    violations: list[dict[str, object]]
    allocation: list[AllocationResponse]
    unmet_demand: list[dict[str, object]]
    objective_breakdown: dict[str, object]
    total_objective: float
    critical_satisfaction: dict[str, int | float | None]
    total_unmet_demand: int
    transport_cost: float
    average_transport_time: float | None
    objective_basis: str | None = None
    # Populated only when this request actually ran a QUBO/QAOA solver.
    qubo_variable_count: int | None = None
    qaoa_depth: int | None = None
    shots: int | None = None
    best_measured_bitstring: str | None = None
    counts: dict[str, int] | None = None
    measured_mean_energy: float | None = None
    qaoa_runtime_seconds: float | None = None
    optimizer_information: dict[str, object] | None = None
    # The service includes the effective run settings with real QAOA results.
    # Keep this in the strict response schema so FastAPI can serialize them.
    experiment_configuration: dict[str, object] | None = None


class ResultsResponse(StrictModel):
    results: list[dict[str, object]]


class EmergencyResponse(StrictModel):
    original_scenario: dict[str, object]
    emergency_event: dict[str, object]
    modified_scenario: dict[str, object]
    before_allocation: list[AllocationResponse]
    after_allocation: list[AllocationResponse]
    before_metrics: dict[str, object]
    after_metrics: dict[str, object]
    allocation_changes: list[dict[str, object]]
    feasibility_status: dict[str, bool]
    method: str
    # QAOA emergency runs re-optimize both the before and after scenarios.
    # Keep both measured sample summaries in the response for transparent
    # presentation; classical runs return null for these fields.
    before_qaoa: dict[str, object] | None = None
    after_qaoa: dict[str, object] | None = None


class BenchmarkResponse(StrictModel):
    results: list[dict[str, object]]
    experiment_configuration: dict[str, object] | None = None


class DemoRunRequest(StrictModel):
    scenario_id: Literal["normal", "emergency_demand_spike", "transport_disruption"]
    method: Literal["greedy", "exact", "qaoa"] = "qaoa"
    objective_weights: ObjectiveWeightsInput = Field(default_factory=ObjectiveWeightsInput)
    qaoa_penalties: QUBOPenaltiesInput | None = None
    qaoa_config: QAOAConfigInput | None = None
    exact_max_candidate_states: int = Field(default=50_000, ge=1, le=50_000)
