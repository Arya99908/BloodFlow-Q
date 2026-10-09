"""Command-line runner for the bundled synthetic benchmark data.

From the project root, run ``python3 -m optimization.run_benchmark``. It writes
machine-readable JSON results and the experiment configuration. When requested,
QAOA uses the real local Qiskit simulator.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from backend.data_loader import load_data
from backend.scenario_factory import scenario_from_loaded_data as build_scenario_from_loaded_data
from optimization.benchmark import export_benchmark_results, run_benchmark_suite
from optimization.exact import ExactSolverConfig
from optimization.models import Scenario
from optimization.objective import ObjectiveConfig
from quantum.qubo import QUBOPenaltyConfig
from quantum.qaoa_solver import QAOAConfig, QAOASolver
from backend.services import QAOASolverAdapter
from backend.demo_scenarios import build_demo_case
from emergency.simulator import apply_emergency_events


def scenario_from_loaded_data(data: dict[str, object]) -> Scenario:
    """Backward-friendly alias around the shared backend scenario factory."""

    return build_scenario_from_loaded_data(data, "bundled_synthetic_dataset")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="results/benchmark.json",
                        help="JSON output path (default: results/benchmark.json)")
    parser.add_argument("--exact-max-states", type=int, default=50000,
                        help="maximum exact-enumeration states per scenario")
    parser.add_argument("--demo-scenario", choices=("normal", "emergency_demand_spike", "transport_disruption"),
                        help="benchmark one compact controlled demo scenario instead of the full bundled dataset")
    parser.add_argument("--critical-weight", type=float, default=10.0)
    parser.add_argument("--unmet-weight", type=float, default=5.0)
    parser.add_argument("--transport-cost-weight", type=float, default=1.0)
    parser.add_argument("--transport-time-weight", type=float, default=0.1)
    parser.add_argument("--secondary-penalty-weight", type=float, default=0.0)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--include-milp", action="store_true",
                        help="include the exact classical MILP solver (SciPy HiGHS)")
    parser.add_argument("--include-qaoa", action="store_true",
                        help="run the real local QAOA simulator (requires explicit penalty weights)")
    parser.add_argument("--qaoa-depth", type=int, default=1)
    parser.add_argument("--shots", type=int, default=256)
    parser.add_argument("--classical-optimizer", choices=("COBYLA", "Nelder-Mead", "Powell"), default="COBYLA")
    parser.add_argument("--max-iterations", type=int, default=40)
    parser.add_argument("--inventory-penalty-weight", type=float)
    parser.add_argument("--demand-penalty-weight", type=float)
    args = parser.parse_args()

    # These are explicit demonstration settings and can be overridden. They
    # are not calibrated or recommended real-world weights.
    objective_config = ObjectiveConfig(
        critical_unmet_weight=args.critical_weight,
        total_unmet_weight=args.unmet_weight,
        transportation_cost_weight=args.transport_cost_weight,
        transportation_time_weight=args.transport_time_weight,
        secondary_penalty_weight=args.secondary_penalty_weight,
    )
    scenario = scenario_from_loaded_data(load_data())
    if args.demo_scenario:
        scenario, event = build_demo_case(scenario, args.demo_scenario)
        if event is not None:
            scenario = apply_emergency_events(scenario, [event])
    qaoa_config = QAOAConfig(p=args.qaoa_depth, shots=args.shots,
                              optimizer=args.classical_optimizer,
                              max_iterations=args.max_iterations, seed=args.seed)
    penalties = None
    qaoa_adapter = None
    if args.include_qaoa:
        if args.inventory_penalty_weight is None or args.demand_penalty_weight is None:
            parser.error("--include-qaoa requires both --inventory-penalty-weight and --demand-penalty-weight")
        penalties = QUBOPenaltyConfig(args.inventory_penalty_weight, args.demand_penalty_weight)
        qaoa_adapter = QAOASolverAdapter(QAOASolver(qaoa_config), penalties)
    records = run_benchmark_suite(
        [scenario],
        objective_config,
        exact_config=ExactSolverConfig(args.exact_max_states),
        qaoa_solver=qaoa_adapter,
        include_milp=args.include_milp,
    )
    target = Path(args.output)
    methods_list = ["greedy"] + (["milp"] if args.include_milp else []) + ["exact"] + (["qaoa"] if args.include_qaoa else [])
    experiment_configuration = {
        "scenario_ids": [scenario.id], "methods": methods_list,
        "objective_weights": {
            "critical_unmet_weight": args.critical_weight,
            "total_unmet_weight": args.unmet_weight,
            "transportation_cost_weight": args.transport_cost_weight,
            "transportation_time_weight": args.transport_time_weight,
            "secondary_penalty_weight": args.secondary_penalty_weight,
        },
        "qaoa": ({"p": qaoa_config.p, "shots": qaoa_config.shots,
                  "optimizer": qaoa_config.optimizer, "max_iterations": qaoa_config.max_iterations,
                  "seed": qaoa_config.seed} if args.include_qaoa else None),
        "penalty_weights": ({"inventory_penalty_weight": penalties.inventory_penalty_weight,
                              "demand_penalty_weight": penalties.demand_penalty_weight}
                             if penalties else None),
        "exact_max_candidate_states": args.exact_max_states,
    }
    export_benchmark_results(records, json_path=target,
                             experiment_configuration=experiment_configuration)
    print(f"Wrote {len(records)} benchmark records to {target}")
    print("QAOA was measured with the local simulator." if args.include_qaoa
          else "QAOA was not requested; no QAOA result was generated.")


if __name__ == "__main__":
    main()
