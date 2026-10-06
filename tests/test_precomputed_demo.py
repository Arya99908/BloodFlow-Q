"""Checks the explicit historical-result fallback and its provenance."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from backend.main import create_app


class PrecomputedDemoTests(unittest.TestCase):
    def test_repository_artifact_has_timestamp_configuration_and_real_method_rows(self) -> None:
        response = TestClient(create_app()).get("/precomputed-demo")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["record_type"], "bloodflow_precomputed_demo")
        self.assertEqual(payload["label"], "PRECOMPUTED EXPERIMENT")
        self.assertTrue(payload["synthetic_data_only"])
        self.assertTrue(payload["created_at_utc"])
        self.assertTrue(payload["reproducibility"]["source_files_sha256"])
        self.assertTrue(payload["reproducibility"]["packages"])
        self.assertIn("python3 -m experiments.create_precomputed_demo",
                      payload["reproducibility"]["command"])

        normal_methods = set()
        emergency_qaoa = None
        for run in payload["runs"]:
            self.assertTrue(run["scenario_id"])
            self.assertTrue(run["timestamp_utc"])
            self.assertTrue(run["configuration"])
            self.assertTrue(run["reproducibility"]["source_files_sha256"])
            self.assertEqual(run["method"], run["result"]["method"])
            self.assertEqual(run["scenario_id"], run["result"]["scenario_id"])
            self.assertIn("result", run["result"])
            if run["scenario_id"] == "normal":
                normal_methods.add(run["method"])
            if run["scenario_id"] == "emergency_demand_spike":
                emergency_qaoa = run
        self.assertEqual(normal_methods, {"greedy", "exact", "qaoa"})
        self.assertIsNotNone(emergency_qaoa)
        emergency_result = emergency_qaoa["result"]["result"]
        self.assertEqual(emergency_result["method"], "qaoa")
        self.assertIn("before_metrics", emergency_result)
        self.assertIn("after_metrics", emergency_result)
        self.assertIn("feasibility", emergency_result["after_metrics"])

    def test_invalid_artifact_service_error_is_not_exposed_as_a_traceback(self) -> None:
        class BrokenArtifactService:
            def precomputed_demo(self):
                from backend.services import APIServiceError
                raise APIServiceError(500, "The precomputed demo artifact has an invalid structure.",
                                      "precomputed_demo_invalid")

        response = TestClient(create_app(BrokenArtifactService())).get("/precomputed-demo")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["error"], "precomputed_demo_invalid")
        self.assertNotIn("Traceback", response.text)


if __name__ == "__main__":
    unittest.main()
