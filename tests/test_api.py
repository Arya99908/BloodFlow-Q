"""FastAPI route, validation, and safe-error QA tests."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.services import BackendService
from quantum.qaoa_solver import QAOAConfig, QAOASolver


def tiny_scenario_payload() -> dict[str, object]:
    return {
        "id": "api_tiny",
        "blood_groups": ["O"],
        "blood_banks": [{"id": "bank", "name": "Bank A", "location_id": "B",
                         "inventory": {"O": 2}}],
        "hospitals": [{"id": "hospital", "name": "Hospital 1", "location_id": "H",
                        "demand": {"O": 1},
                        "urgency": {"O": {"category": "high", "priority_weight": 2}}}],
        "routes": [{"source": "bank", "destination": "hospital",
                    "travel_time_minutes": 5, "distance_km": 2,
                    "transport_cost": 1, "status": "available"}],
        "compatibility": [{"donor_group": "O", "recipient_group": "O", "allowed": True}],
        "synthetic": True,
    }


class FailingGreedy:
    name = "greedy"

    def solve(self, *_args, **_kwargs):
        raise RuntimeError("simulated greedy failure")


class FailingQAOA:
    def solve(self, _qubo):
        raise RuntimeError("simulated QAOA simulator failure")


class APITests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(create_app())

    def test_health_scenario_and_results_get_endpoints(self) -> None:
        health = self.client.get("/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["status"], "ok")
        self.assertTrue(health.json()["synthetic_data_only"])

        scenario = self.client.get("/scenario")
        self.assertEqual(scenario.status_code, 200)
        self.assertEqual(len(scenario.json()["blood_banks"]), 3)
        self.assertEqual(scenario.json()["synthetic"], True)

        results = self.client.get("/results")
        self.assertEqual(results.status_code, 200)
        self.assertEqual(results.json(), {"results": []})

    def test_optimize_endpoint_returns_validated_result(self) -> None:
        response = self.client.post("/optimize", json={"scenario": tiny_scenario_payload()})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertTrue(result["feasibility"])
        self.assertEqual(result["scenario_id"], "api_tiny")
        self.assertEqual(result["allocation"][0]["quantity"], 1)
        self.assertEqual(result["total_unmet_demand"], 0)

    def test_simulate_emergency_endpoint_returns_before_and_after(self) -> None:
        response = self.client.post("/simulate-emergency", json={
            "scenario": tiny_scenario_payload(),
            "event": {"kind": "demand_spike", "hospital_id": "hospital",
                      "blood_group": "O", "new_demand": 4,
                      "urgency": {"category": "critical", "priority_weight": 3}},
        })
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["before_allocation"][0]["quantity"], 1)
        self.assertEqual(result["modified_scenario"]["hospitals"][0]["demand"]["O"], 4)
        self.assertEqual(result["after_metrics"]["total_unmet_demand"], 2)
        self.assertTrue(result["feasibility_status"]["both_feasible"])

    def test_benchmark_endpoint_runs_all_methods_without_fake_qaoa(self) -> None:
        response = self.client.post("/benchmark", json={
            "scenarios": [tiny_scenario_payload()],
        })
        self.assertEqual(response.status_code, 200, response.text)
        records = response.json()["results"]
        self.assertEqual([row["method"] for row in records], ["greedy", "exact", "qaoa"])
        qaoa = records[-1]
        self.assertEqual(qaoa["status"], "not_requested")
        self.assertIsNone(qaoa["objective_value"])
        self.assertIsNone(qaoa["runtime_seconds"])

    def test_results_endpoint_contains_recent_operation(self) -> None:
        self.client.post("/optimize", json={"scenario": tiny_scenario_payload()})
        response = self.client.get("/results")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"][0]["endpoint"], "/optimize")

    def test_missing_fields_malformed_json_and_bad_method_return_422(self) -> None:
        missing = self.client.post("/optimize", json={"scenario": {"id": "missing_fields"}})
        self.assertEqual(missing.status_code, 422)
        self.assertEqual(missing.json()["error"], "validation_error")
        self.assertTrue(missing.json()["detail"])

        malformed = self.client.post("/optimize", content="{", headers={"content-type": "application/json"})
        self.assertEqual(malformed.status_code, 422)
        self.assertEqual(malformed.json()["error"], "validation_error")

        bad_method = self.client.post("/optimize", json={"method": "unknown"})
        self.assertEqual(bad_method.status_code, 422)

        unbounded_exact = self.client.post("/optimize", json={
            "exact_max_candidate_states": 50_001,
        })
        self.assertEqual(unbounded_exact.status_code, 422)

    def test_malformed_domain_scenario_returns_clear_422(self) -> None:
        broken = tiny_scenario_payload()
        broken["blood_groups"] = ["A"]  # bank and route data still refer to O
        response = self.client.post("/optimize", json={"scenario": broken})
        self.assertEqual(response.status_code, 422)
        self.assertIn("scenario is invalid", response.json()["detail"])

    def test_unknown_emergency_event_reference_returns_clear_422(self) -> None:
        response = self.client.post("/simulate-emergency", json={
            "scenario": tiny_scenario_payload(),
            "event": {"kind": "demand_spike", "hospital_id": "missing_hospital",
                      "blood_group": "O", "new_demand": 4},
        })
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"], "invalid_event")

    def test_qaoa_penalty_configuration_errors_are_validation_responses(self) -> None:
        class UnusedQAOA:
            def solve(self, _qubo):
                raise AssertionError("invalid penalty must be rejected before solver call")

        client = TestClient(create_app(BackendService(qaoa_solver=UnusedQAOA())))
        response = client.post("/optimize", json={
            "scenario": tiny_scenario_payload(), "method": "qaoa",
            "qaoa_penalties": {"inventory_penalty_weight": 1,
                               "demand_penalty_weight": 1},
        })
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"], "invalid_qubo_configuration")

    def test_impossible_all_routes_blocked_case_reports_shortage_not_exception(self) -> None:
        impossible = tiny_scenario_payload()
        impossible["routes"][0]["status"] = "blocked"
        response = self.client.post("/optimize", json={"scenario": impossible})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertTrue(result["feasibility"])
        self.assertEqual(result["allocation"], [])
        self.assertEqual(result["total_unmet_demand"], 1)

    def test_optimizer_failure_is_sanitized_and_has_no_traceback(self) -> None:
        client = TestClient(create_app(BackendService(greedy_solver=FailingGreedy())))
        response = client.post("/optimize", json={"scenario": tiny_scenario_payload()})
        self.assertEqual(response.status_code, 500)
        self.assertIn("optimizer failed", response.json()["detail"])
        self.assertNotIn("simulated greedy failure", response.text)
        self.assertNotIn("Traceback", response.text)

    def test_qaoa_unavailable_and_qaoa_failure_are_clear_http_errors(self) -> None:
        unavailable_client = TestClient(create_app(BackendService(qaoa_solver=None)))
        unavailable = unavailable_client.post("/optimize", json={
            "scenario": tiny_scenario_payload(), "method": "qaoa",
            "qaoa_penalties": {"inventory_penalty_weight": 100,
                               "demand_penalty_weight": 100},
        })
        self.assertEqual(unavailable.status_code, 501)
        self.assertEqual(unavailable.json()["error"], "qaoa_not_implemented")

        client = TestClient(create_app(BackendService(qaoa_solver=FailingQAOA())))
        failed = client.post("/optimize", json={
            "scenario": tiny_scenario_payload(), "method": "qaoa",
            "qaoa_penalties": {"inventory_penalty_weight": 100,
                               "demand_penalty_weight": 100},
        })
        self.assertEqual(failed.status_code, 502)
        self.assertIn("QAOA solver failed", failed.json()["detail"])
        self.assertNotIn("simulated QAOA simulator failure", failed.text)
        self.assertNotIn("Traceback", failed.text)

    def test_default_scenario_qaoa_reports_local_qubit_limit_without_faking_a_result(self) -> None:
        response = self.client.post("/optimize", json={
            "method": "qaoa",
            "qaoa_penalties": {"inventory_penalty_weight": 10_000,
                               "demand_penalty_weight": 10_000},
        })
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"], "qaoa_instance_too_large")
        self.assertIn("16 qubits", response.json()["detail"])
        self.assertIn("222 binary variables", response.json()["detail"])
        self.assertNotIn("best_measured_bitstring", response.json())

    def test_real_qaoa_runs_for_optimize_and_emergency_on_tiny_scenario(self) -> None:
        service = BackendService(qaoa_solver=QAOASolver(QAOAConfig(
            p=1, shots=32, max_iterations=5, seed=3, max_qubits=8,
        )))
        client = TestClient(create_app(service))
        penalties = {"inventory_penalty_weight": 10_000,
                     "demand_penalty_weight": 10_000}
        optimized = client.post("/optimize", json={
            "scenario": tiny_scenario_payload(), "method": "qaoa",
            "qaoa_penalties": penalties,
        })
        self.assertEqual(optimized.status_code, 200, optimized.text)
        self.assertEqual(optimized.json()["method"], "qaoa")
        self.assertIn("feasibility", optimized.json())
        self.assertEqual(optimized.json()["qaoa_depth"], 1)
        self.assertEqual(optimized.json()["shots"], 32)
        self.assertEqual(sum(optimized.json()["counts"].values()), 32)
        self.assertEqual(optimized.json()["experiment_configuration"]["qaoa"]["shots"], 32)
        self.assertEqual(optimized.json()["qubo_variable_count"], len(
            optimized.json()["best_measured_bitstring"]
        ))

        emergency = client.post("/simulate-emergency", json={
            "scenario": tiny_scenario_payload(), "method": "qaoa",
            "qaoa_penalties": penalties,
            "event": {"kind": "demand_spike", "hospital_id": "hospital",
                      "blood_group": "O", "new_demand": 2},
        })
        self.assertEqual(emergency.status_code, 200, emergency.text)
        self.assertEqual(emergency.json()["method"], "qaoa")
        self.assertEqual(emergency.json()["modified_scenario"]["hospitals"][0]["demand"]["O"], 2)
        self.assertIn("before_allocation", emergency.json())
        self.assertIn("after_allocation", emergency.json())
        for sample_key in ("before_qaoa", "after_qaoa"):
            sample = emergency.json()[sample_key]
            self.assertIsNotNone(sample)
            self.assertEqual(sample["qaoa_depth"], 1)
            self.assertEqual(sample["shots"], 32)
            self.assertEqual(len(sample["best_measured_bitstring"]), sample["qubo_variable_count"])
            self.assertEqual(sum(sample["counts"].values()), 32)

        benchmark = client.post("/benchmark", json={
            "scenarios": [tiny_scenario_payload()],
            "include_qaoa": True,
            "qaoa_penalties": penalties,
        })
        self.assertEqual(benchmark.status_code, 200, benchmark.text)
        records = benchmark.json()["results"]
        measured_qaoa = next(row for row in records if row["method"] == "qaoa")
        self.assertIn(measured_qaoa["status"], {"completed", "infeasible"})
        self.assertIsNotNone(measured_qaoa["objective_value"])

    def test_cors_allows_local_vite_frontend(self) -> None:
        response = self.client.options("/health", headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        })
        self.assertIn(response.status_code, (200, 204))
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")
        self.assertIsNone(response.headers.get("access-control-allow-credentials"))

        rejected = self.client.options("/health", headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "GET",
        })
        self.assertNotEqual(rejected.headers.get("access-control-allow-origin"),
                            "https://untrusted.example")


if __name__ == "__main__":
    unittest.main()
