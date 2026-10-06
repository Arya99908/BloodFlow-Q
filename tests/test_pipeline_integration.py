"""End-to-end API checks spanning scenario, QUBO/QAOA, and operations."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.data_loader import DataValidationError, load_data
from backend.demo_scenarios import build_demo_case
from backend.main import create_app
from backend.scenario_factory import scenario_from_loaded_data
from backend.services import BackendService
from optimization.decoder import evaluate_quantum_solution
from optimization.objective import ObjectiveConfig
from quantum.ising import convert_qubo_to_ising
from quantum.qaoa_solver import QAOAConfig, QAOASolver
from quantum.qubo import QUBOPenaltyConfig, build_qubo


def scenario_payload(*, inventory: int = 2, demand: int = 1,
                     route_status: str = "available",
                     urgency: str = "critical") -> dict[str, object]:
    """Build the smallest readable synthetic scenario for integrated checks."""
    return {
        "id": "integration_tiny",
        "blood_groups": ["O"],
        "blood_banks": [{"id": "bank", "name": "Bank A", "location_id": "B",
                         "inventory": {"O": inventory}}],
        "hospitals": [{"id": "hospital", "name": "Hospital 1", "location_id": "H",
                        "demand": {"O": demand},
                        "urgency": {"O": {"category": urgency, "priority_weight": 3}}}],
        "routes": [{"source": "bank", "destination": "hospital",
                    "travel_time_minutes": 5, "distance_km": 2,
                    "transport_cost": 1, "status": route_status}],
        "compatibility": [{"donor_group": "O", "recipient_group": "O", "allowed": True}],
        "synthetic": True,
    }


class BrokenQAOA:
    def solve(self, _qubo):
        raise RuntimeError("private simulator diagnostic")


class FullPipelineIntegrationTests(unittest.TestCase):
    def test_infeasible_measured_demo_candidate_keeps_its_bits_and_energy(self) -> None:
        """A finite-shot sample with no feasible observed state stays infeasible.

        This fixed local Aer seed reproduces a real measured candidate. The
        assertions compare its QUBO energy to the same decoded classical cost
        plus the explicit equality penalty, while also checking the Ising
        energy and the API's unmodified feasibility report.
        """
        weights = ObjectiveConfig(10, 5, 1, 0.1, 0)
        penalties = QUBOPenaltyConfig(10_000, 10_000)
        base = scenario_from_loaded_data(load_data())
        compact, _ = build_demo_case(base, "normal")
        qubo = build_qubo(compact, weights, penalties)
        self.assertEqual(qubo.variable_count, 10)
        qaoa_config = QAOAConfig(
            p=1, shots=64, max_iterations=10, seed=3, max_qubits=16,
        )
        measured_run = QAOASolver(qaoa_config).solve(qubo)
        self.assertEqual(sum(measured_run.counts.values()), 64)
        self.assertEqual(measured_run.best_bitstring, "1101100101")
        # Several samples decode to allocation-feasible shipments but violate
        # the QUBO's auxiliary inventory-slack equality. No sampled bitstring
        # satisfies every encoded equality in this short run.
        self.assertTrue(all(
            qubo.evaluate_assignment(tuple(int(bit) for bit in candidate.bitstring[::-1]))
            .total_penalty > 0
            for candidate in measured_run.ranked_candidates
        ))

        client = TestClient(create_app())
        response = client.post("/demo-run", json={
            "scenario_id": "normal", "method": "qaoa",
            "objective_weights": {
                "critical_unmet_weight": 10,
                "total_unmet_weight": 5,
                "transportation_cost_weight": 1,
                "transportation_time_weight": 0.1,
                "secondary_penalty_weight": 0,
            },
            "qaoa_penalties": {
                "inventory_penalty_weight": 10_000,
                "demand_penalty_weight": 10_000,
            },
            "qaoa_config": {
                "p": 1, "shots": 64, "optimizer": "COBYLA",
                "max_iterations": 10, "seed": 3,
            },
        })
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()["result"]
        self.assertFalse(result["feasibility"])
        self.assertEqual(result["best_measured_bitstring"], measured_run.best_bitstring)
        self.assertEqual(result["violations"][0]["check"], "demand_accounting")
        self.assertEqual(result["violations"][0]["expected"], 4)
        self.assertEqual(result["violations"][0]["actual"], 3)

        candidate = evaluate_quantum_solution(qubo, result["best_measured_bitstring"])
        mapping_bits = candidate.decoded_candidate.bits_in_mapping_order
        assignment = qubo.evaluate_assignment(mapping_bits)
        ising = convert_qubo_to_ising(qubo)
        self.assertAlmostEqual(qubo.energy(mapping_bits), assignment.energy)
        self.assertAlmostEqual(ising.energy(result["best_measured_bitstring"]), assignment.energy)
        self.assertAlmostEqual(assignment.energy,
                               assignment.classical_objective + assignment.total_penalty)
        self.assertAlmostEqual(result["total_objective"], assignment.classical_objective)
        self.assertIn("not a feasible allocation score", result["objective_basis"])
        self.assertEqual(candidate.decoded_allocation[0].quantity, 2)
        self.assertEqual(candidate.unmet_demand[("hospital_1", "O")], 1)

    def test_normal_scenario_runs_qubo_qaoa_decoder_validator_and_benchmark(self) -> None:
        solver = QAOASolver(QAOAConfig(p=1, shots=24, max_iterations=8,
                                       seed=11, max_qubits=8))
        client = TestClient(create_app(BackendService(qaoa_solver=solver)))
        scenario = scenario_payload()
        penalties = {"inventory_penalty_weight": 10_000,
                     "demand_penalty_weight": 10_000}

        response = client.post("/optimize", json={
            "scenario": scenario, "method": "qaoa", "qaoa_penalties": penalties,
        })
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["method"], "qaoa")
        self.assertEqual(result["qubo_variable_count"], len(result["best_measured_bitstring"]))
        self.assertIn(result["feasibility"], (True, False))
        self.assertIn("allocation", result)  # decoded from the QUBO variable mapping
        self.assertIn("violations", result)  # classical validator report
        self.assertIn("total_objective", result)

        benchmark = client.post("/benchmark", json={
            "scenarios": [scenario], "include_qaoa": True,
            "qaoa_penalties": penalties,
        })
        self.assertEqual(benchmark.status_code, 200, benchmark.text)
        rows = benchmark.json()["results"]
        self.assertEqual([row["method"] for row in rows], ["greedy", "exact", "qaoa"])
        measured = next(row for row in rows if row["method"] == "qaoa")
        self.assertIn(measured["status"], {"completed", "infeasible"})
        self.assertIsNotNone(measured["runtime_seconds"])
        self.assertIsNotNone(measured["objective_value"])

    def test_insufficient_inventory_and_critical_demand_are_accounted_for(self) -> None:
        client = TestClient(create_app())
        scenario = scenario_payload(inventory=1, demand=4, urgency="critical")
        response = client.post("/optimize", json={"scenario": scenario, "method": "greedy"})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertTrue(result["feasibility"])
        self.assertEqual(sum(item["quantity"] for item in result["allocation"]), 1)
        self.assertEqual(result["total_unmet_demand"], 3)
        self.assertEqual(result["critical_satisfaction"]["total_units"], 4)
        self.assertEqual(result["critical_satisfaction"]["satisfied_units"], 1)

    def test_emergency_demand_spike_and_route_disruption_reoptimize(self) -> None:
        client = TestClient(create_app())
        scenario = scenario_payload(inventory=3, demand=1)
        spike = client.post("/simulate-emergency", json={
            "scenario": scenario,
            "event": {"kind": "demand_spike", "hospital_id": "hospital",
                      "blood_group": "O", "new_demand": 3,
                      "urgency": {"category": "critical", "priority_weight": 5}},
        })
        self.assertEqual(spike.status_code, 200, spike.text)
        report = spike.json()
        self.assertEqual(report["original_scenario"]["hospitals"][0]["demand"]["O"], 1)
        self.assertEqual(report["modified_scenario"]["hospitals"][0]["demand"]["O"], 3)
        self.assertIn("before_allocation", report)
        self.assertIn("after_allocation", report)
        self.assertEqual(report["after_metrics"]["total_unmet_demand"], 0)

        disruption = client.post("/simulate-emergency", json={
            "scenario": scenario,
            "event": {"kind": "route_disruption", "source": "bank",
                      "destination": "hospital"},
        })
        self.assertEqual(disruption.status_code, 200, disruption.text)
        changed = disruption.json()
        self.assertEqual(changed["original_scenario"]["routes"][0]["status"], "available")
        self.assertEqual(changed["modified_scenario"]["routes"][0]["status"], "blocked")
        self.assertEqual(changed["after_allocation"], [])

    def test_invalid_input_malformed_data_and_qaoa_failure_are_reported(self) -> None:
        client = TestClient(create_app())
        invalid = client.post("/optimize", json={"scenario": {"synthetic": False}})
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(invalid.json()["error"], "validation_error")
        self.assertNotIn("Traceback", invalid.text)

        broken_qaoa = TestClient(create_app(BackendService(qaoa_solver=BrokenQAOA())))
        failure = broken_qaoa.post("/optimize", json={
            "scenario": scenario_payload(), "method": "qaoa",
            "qaoa_penalties": {"inventory_penalty_weight": 10_000,
                               "demand_penalty_weight": 10_000},
        })
        self.assertEqual(failure.status_code, 502)
        self.assertIn("QAOA solver failed", failure.json()["detail"])
        self.assertNotIn("private simulator diagnostic", failure.text)
        self.assertNotIn("Traceback", failure.text)

        with tempfile.TemporaryDirectory() as folder:
            data_dir = Path(folder)
            for source in Path(__file__).parents[1].joinpath("data").glob("*.json"):
                (data_dir / source.name).write_bytes(source.read_bytes())
            (data_dir / "routes.json").write_text("{ malformed", encoding="utf-8")
            with self.assertRaisesRegex(DataValidationError, "invalid JSON"):
                load_data(data_dir)


if __name__ == "__main__":
    unittest.main()
