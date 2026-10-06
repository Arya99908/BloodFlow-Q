"""Run a tiny, fully synthetic Greedy/Exact benchmark example.

Run from the project root with ``python -m examples.small_benchmark``. The
example writes JSON and CSV records under ``results/``; QAOA is marked
``not_requested`` because this classical example does not supply a QAOA solver.
It records no fabricated QAOA metrics.
"""

from optimization.benchmark import export_benchmark_results, run_baseline_benchmark
from optimization.exact import ExactSolverConfig
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig


def build_example_scenario() -> Scenario:
    """Create one small fictional bank-to-hospital allocation case."""

    return Scenario(
        id="tiny_benchmark_example",
        blood_groups=("O",),
        blood_banks=(
            BloodBank(
                id="bank_example",
                name="Example Bank",
                location_id="SYNTHETIC_BANK_LOCATION",
                inventory={"O": 2},
            ),
        ),
        hospitals=(
            Hospital(
                id="hospital_example",
                name="Example Hospital",
                location_id="SYNTHETIC_HOSPITAL_LOCATION",
                demand={"O": 3},
                urgency={"O": Urgency(category="high", priority_weight=2)},
            ),
        ),
        routes=(
            Route(
                source="bank_example",
                destination="hospital_example",
                travel_time_minutes=12,
                distance_km=4,
                transport_cost=1.5,
                status="available",
            ),
        ),
        compatibility={("O", "O"): True},
    )


def main() -> None:
    scenario = build_example_scenario()
    # Values are explicit teaching-example weights, not recommended settings.
    objective_config = ObjectiveConfig(
        critical_unmet_weight=10,
        total_unmet_weight=5,
        transportation_cost_weight=1,
        transportation_time_weight=0.1,
        secondary_penalty_weight=0,
    )
    records = run_baseline_benchmark(
        scenario,
        objective_config,
        exact_config=ExactSolverConfig(max_candidate_states=100),
    )
    export_benchmark_results(
        records,
        json_path="results/small_benchmark.json",
        csv_path="results/small_benchmark.csv",
    )
    for record in records:
        print(
            f"{record.method}: status={record.status}, "
            f"objective={record.objective_value}, runtime={record.runtime_seconds}"
        )


if __name__ == "__main__":
    main()
