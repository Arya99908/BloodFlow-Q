import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.services import BackendService, APIServiceError
from backend.schemas import OptimizeRequest, ScenarioInput
from backend.jobs import execute, _SLOTS
from tests.test_api import tiny_scenario_payload

class ComputeBudgetTests(unittest.TestCase):
    def test_oversized_body_rejected_before_model_construction(self):
        r=TestClient(create_app()).post('/optimize',content=b'x'*1_048_577,headers={'content-type':'application/json'})
        self.assertEqual(r.status_code,413)

    def test_busy_capacity_is_visible(self):
        _SLOTS.acquire();_SLOTS.acquire()
        try:
            r=TestClient(create_app()).post('/optimize',json={})
            self.assertEqual(r.status_code,429)
        finally:
            _SLOTS.release();_SLOTS.release()

    def test_production_worker_completes_and_preserves_result(self):
        service=BackendService();service.isolate_jobs=True
        result=execute(service,'optimize',OptimizeRequest(method='milp',scenario=ScenarioInput(**tiny_scenario_payload())))
        self.assertTrue(result['feasibility'])
        self.assertEqual(len(service.results()['results']),1)

    def test_worker_deadline_returns_no_fabricated_result(self):
        service=BackendService();service.isolate_jobs=True
        with patch('backend.jobs.JOB_TIMEOUT_SECONDS',0):
            with self.assertRaises(APIServiceError) as failure:
                execute(service,'optimize',OptimizeRequest())
        self.assertEqual(failure.exception.status_code,504)
        self.assertEqual(service.results()['results'],[])
