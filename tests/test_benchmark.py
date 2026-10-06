"""Tests for using the same benchmark record with current solver adapters."""

from __future__ import annotations

import unittest
import csv
import json
import tempfile
from pathlib import Path

from optimization.benchmark import (
    benchmark_solvers,
    export_benchmark_results,
    run_baseline_benchmark,
)
from optimization.exact import ExactSolver, ExactSolverConfig
from optimization.greedy import GreedyAllocator
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig
from optimization.decoder import evaluate_quantum_solution
from optimization.benchmark import run_benchmark_suite
from quantum.qubo import QUBOPenaltyConfig, build_qubo


def scenario() -> Scenario:
    groups = ("O",)
    return Scenario(
        id="benchmark_case",
        blood_groups=groups,
        blood_banks=(BloodBank("bank_a", "Bank A", "LOC_B", {"O": 1}),),
        hospitals=(
            Hospital("hospital_1", "Hospital 1", "LOC_H", {"O": 1},
                     {"O": Urgency("high", 1)}),
        ),
        routes=(Route("bank_a", "hospital_1", 1, 1, 1, "available"),),
        compatibility={("O", "O"): True},
    )


class BenchmarkTests(unittest.TestCase):
    def test_greedy_and_exact_share_benchmark_result_shape(self) -> None:
        config = ObjectiveConfig(10, 5, 1, 0.1, 0)
        records = benchmark_solvers(
            scenario(),
            config,
            [GreedyAllocator(), ExactSolver(ExactSolverConfig(max_candidate_states=10))],
        )

        self.assertEqual([record.method for record in records], ["greedy", "exact"])
        self.assertTrue(all(record.feasibility for record in records))
        self.assertTrue(all(record.runtime_seconds >= 0 for record in records))
        self.assertEqual(records[0].objective_value, records[1].objective_value)

    def test_qaoa_not_requested_has_no_fake_metrics(self) -> None:
        records = run_baseline_benchmark(
            scenario(),
            ObjectiveConfig(10, 5, 1, 0.1, 0),
        )
        qaoa = next(record for record in records if record.method == "qaoa")

        self.assertEqual(qaoa.status, "not_requested")
        self.assertIsNone(qaoa.objective_value)
        self.assertIsNone(qaoa.runtime_seconds)
        self.assertIsNone(qaoa.feasibility)
        self.assertIn("no result was generated", qaoa.detail)

    def test_exact_size_limit_is_recorded_without_fake_solution_values(self) -> None:
        records = run_baseline_benchmark(
            scenario(),
            ObjectiveConfig(10, 5, 1, 0.1, 0),
            exact_config=ExactSolverConfig(max_candidate_states=1),
        )
        exact = next(record for record in records if record.method == "exact")

        self.assertEqual(exact.status, "skipped_too_large")
        self.assertIsNone(exact.objective_value)
        self.assertIsNone(exact.feasibility)
        self.assertIn("exceeds configured limit", exact.detail)

    def test_json_and_csv_exports_include_comparison_fields(self) -> None:
        records = run_baseline_benchmark(
            scenario(),
            ObjectiveConfig(10, 5, 1, 0.1, 0),
        )
        with tempfile.TemporaryDirectory() as temporary_directory:
            json_path = Path(temporary_directory) / "nested" / "results.json"
            csv_path = Path(temporary_directory) / "nested" / "results.csv"
            export_benchmark_results(records, json_path=json_path, csv_path=csv_path)

            data = json.loads(json_path.read_text(encoding="utf-8"))
            self.assertEqual(len(data["results"]), 3)
            self.assertIsNone(next(row for row in data["results"] if row["method"] == "qaoa")["objective_value"])

            with csv_path.open(encoding="utf-8", newline="") as file:
                rows = list(csv.DictReader(file))
            self.assertEqual(len(rows), 3)
            self.assertIn("average_transport_time", rows[0])
            self.assertEqual(next(row for row in rows if row["method"] == "qaoa")["status"], "not_requested")

    def test_measured_qaoa_adapter_is_benchmarked_and_gap_is_reported(self) -> None:
        class QAOAAdapter:
            name = "qaoa"

            def solve(self, scenario, objective_config, secondary_penalties=None):
                qubo = build_qubo(
                    scenario, objective_config, QUBOPenaltyConfig(100, 100),
                    secondary_penalties=secondary_penalties,
                )
                bits = [0] * qubo.variable_count
                for variable in qubo.variable_mapping:
                    if variable.kind == "allocation":
                        bits[variable.index] = 1
                qiskit_key = "".join(str(bit) for bit in reversed(bits))
                return evaluate_quantum_solution(qubo, qiskit_key)

        records = run_benchmark_suite(
            [scenario()], ObjectiveConfig(10, 5, 1, 0.1, 0),
            qaoa_solver=QAOAAdapter(),
        )
        qaoa = next(record for record in records if record.method == "qaoa")
        self.assertEqual(qaoa.status, "completed")
        self.assertTrue(qaoa.feasibility)
        self.assertIsNotNone(qaoa.objective_value)
        self.assertGreaterEqual(qaoa.runtime_seconds, 0)
        self.assertEqual(qaoa.approximation_gap, 0)
        self.assertEqual(qaoa.approximation_gap_status, "defined")

    def test_zero_exact_objective_has_safe_gap_behavior(self) -> None:
        class SendOneQAOA:
            name = "qaoa"

            def solve(self, scenario, objective_config, secondary_penalties=None):
                qubo = build_qubo(
                    scenario, objective_config, QUBOPenaltyConfig(10, 10)
                )
                bits = [0] * qubo.variable_count
                for variable in qubo.variable_mapping:
                    if variable.kind == "allocation":
                        bits[variable.index] = 1
                key = "".join(str(bit) for bit in reversed(bits))
                return evaluate_quantum_solution(qubo, key)

        config = ObjectiveConfig(0, 0, 1, 0, 0)
        records = run_benchmark_suite([scenario()], config, qaoa_solver=SendOneQAOA())
        exact = next(record for record in records if record.method == "exact")
        qaoa = next(record for record in records if record.method == "qaoa")
        self.assertEqual(exact.objective_value, 0)
        self.assertGreater(qaoa.objective_value, 0)
        self.assertIsNone(qaoa.approximation_gap)
        self.assertIn("exact objective is zero", qaoa.approximation_gap_status)

    def test_suite_returns_records_for_each_scenario(self) -> None:
        records = run_benchmark_suite(
            [scenario(), scenario()], ObjectiveConfig(10, 5, 1, 0.1, 0)
        )
        self.assertEqual(len(records), 6)
        self.assertEqual({record.method for record in records}, {"greedy", "exact", "qaoa"})


if __name__ == "__main__":
    unittest.main()
