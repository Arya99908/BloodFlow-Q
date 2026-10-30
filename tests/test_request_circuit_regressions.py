"""Request validation and quantum circuit regressions."""
import unittest
from dataclasses import replace
from fastapi.testclient import TestClient
from backend.main import create_app
from tests.test_api import tiny_scenario_payload

class RequestCircuitBoundaryTests(unittest.TestCase):
    def test_boolean_quantities_rejected_at_http_boundary(self):
        for field, collection in [('inventory', 'blood_banks'), ('demand', 'hospitals')]:
            scenario = tiny_scenario_payload()
            scenario[collection][0][field]['O'] = True
            response = TestClient(create_app()).post('/optimize', json={'scenario': scenario})
            self.assertEqual(response.status_code, 422, response.text)

    def test_constant_qaoa_does_not_fabricate_measurements(self):
        scenario = tiny_scenario_payload()
        scenario['blood_banks'][0]['inventory']['O'] = 0
        scenario['hospitals'][0]['demand']['O'] = 0
        response = TestClient(create_app()).post('/optimize', json={
            'scenario': scenario, 'method': 'qaoa',
            'qaoa_penalties': {'inventory_penalty_weight': 10000, 'demand_penalty_weight': 10000}})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertTrue(result['feasibility'])
        self.assertEqual(result['total_objective'], 0)
        self.assertEqual(result['shots'], 0)
        self.assertEqual(result['counts'], {})
        self.assertFalse(result['optimizer_information']['quantum_executed'])
