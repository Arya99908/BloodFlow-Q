"""Regression checks for the synthetic donor and emergency workflow."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from backend.emergency_demo import apply_demo_action, start_demo
from backend.main import create_app


class EmergencyCoordinationDemoTests(unittest.TestCase):
    def test_fixed_demo_starts_with_four_need_one_stock_three_shortfall(self):
        state = start_demo()
        self.assertTrue(state["synthetic"])
        self.assertIn("SIMULATED", state["simulation_label"])
        self.assertEqual(state["request"]["units_requested"], 4)
        self.assertEqual(state["inventory_check"]["accessible_units"], 1)
        self.assertEqual(state["inventory_check"]["shortfall_units"], 3)
        self.assertEqual(state["inventory_check"]["remaining_shortfall_units"], 3)
        self.assertEqual(len(state["potential_donors"]), 3)
        self.assertEqual(len(state["donor_notifications"]), 1)
        self.assertTrue(all(n["medical_eligibility_confirmed"] is False for n in state["donor_notifications"]))
        for donor in state["donor_notifications"]:
            self.assertFalse({"email", "phone", "home_address", "latitude", "longitude"} & donor.keys())

    def test_demo_progresses_only_in_order_and_completion_requires_receipt(self):
        state = start_demo()
        with self.assertRaisesRegex(ValueError, "not available"):
            apply_demo_action(state, "complete")

        state = apply_demo_action(state, "accept_donor", "DEMO-DONOR-01")
        self.assertEqual(state["request"]["status"], "Donor Accepted")
        self.assertFalse(state["accepted_donor"]["contact_details_visible"])
        state = apply_demo_action(state, "arrange_appointment")
        self.assertIn("simulated", state["appointment"]["status"])
        state = apply_demo_action(state, "confirm_collection")
        self.assertEqual(state["request"]["status"], "At Authorized Blood Centre")
        state = apply_demo_action(state, "begin_testing")
        self.assertEqual(state["request"]["status"], "Testing and Compatibility Checks")
        state = apply_demo_action(state, "confirm_testing_and_release")
        self.assertEqual(state["request"]["status"], "Ready for Dispatch")
        self.assertEqual(state["blood_centre_release"]["confirmed_units"], 3)
        self.assertEqual(state["collection"]["confirmed_units"], 3)
        self.assertEqual(state["inventory_check"]["remaining_shortfall_units"], 0)
        self.assertTrue(state["blood_centre_release"]["simulated"])
        state = apply_demo_action(state, "assign_transport")
        self.assertTrue(state["transport"]["simulated"])
        state = apply_demo_action(state, "confirm_dispatch")
        self.assertEqual(state["request"]["status"], "Dispatched")
        state = apply_demo_action(state, "confirm_receipt")
        self.assertEqual(state["request"]["status"], "Received by Hospital")
        state = apply_demo_action(state, "complete")
        self.assertEqual(state["request"]["status"], "Completed")
        self.assertTrue(all(row["simulated"] for row in state["history"]))

    def test_declined_donor_is_not_contacted_twice(self):
        state = apply_demo_action(start_demo(), "decline_donor", "DEMO-DONOR-01")
        self.assertEqual(state["donor_notifications"][0]["status"], "declined")
        self.assertEqual(state["donor_notifications"][1]["donor_id"], "DEMO-DONOR-02")
        with self.assertRaisesRegex(ValueError, "already responded"):
            apply_demo_action(state, "decline_donor", "DEMO-DONOR-01")
        state = apply_demo_action(state, "accept_donor", "DEMO-DONOR-02")
        self.assertEqual(state["accepted_donor"]["donor_id"], "DEMO-DONOR-02")

    def test_synthetic_request_can_be_cancelled_and_not_cancelled_twice(self):
        state = apply_demo_action(start_demo(), "cancel")
        self.assertEqual(state["request"]["status"], "Cancelled")
        self.assertEqual(state["next_actions"], [])
        self.assertTrue(state["history"][-1]["simulated"])
        with self.assertRaisesRegex(ValueError, "cannot be cancelled again"):
            apply_demo_action(state, "cancel")

    def test_api_rebuilds_demo_only_from_allowed_action_log(self):
        client = TestClient(create_app())
        started = client.post("/coordination/demo/start")
        self.assertEqual(started.status_code, 200, started.text)
        start = started.json()
        response = client.post("/coordination/demo/action", json={
            "actions": start["action_log"],
            "action": "accept_donor",
            "donor_id": "DEMO-DONOR-01",
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["request"]["status"], "Donor Accepted")

    def test_api_accepts_cancellation_as_a_synthetic_workflow_action(self):
        client = TestClient(create_app())
        started = client.post("/coordination/demo/start").json()
        response = client.post("/coordination/demo/action", json={
            "actions": started["action_log"], "action": "cancel",
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["request"]["status"], "Cancelled")
        self.assertEqual(response.json()["next_actions"], [])

    def test_api_rejects_skipped_steps_and_extra_untrusted_state(self):
        client = TestClient(create_app())
        skip = client.post("/coordination/demo/action", json={"action": "complete"})
        self.assertEqual(skip.status_code, 422)
        self.assertEqual(skip.json()["error"], "invalid_demo_action")
        forged = client.post("/coordination/demo/action", json={
            "session": {"synthetic": True, "phone": "+15555550123"},
            "action": "complete",
        })
        self.assertEqual(forged.status_code, 422)
        self.assertEqual(forged.json()["error"], "validation_error")

    def test_live_personal_data_features_are_reported_disabled_not_faked(self):
        client = TestClient(create_app())
        capabilities = client.get("/coordination/capabilities").json()
        self.assertFalse(capabilities["live_records_enabled"])
        self.assertTrue(capabilities["synthetic_demo_enabled"])
        self.assertIn("frontend Supabase client", capabilities["live_records_reason"])
        dashboard = client.get("/coordination/dashboard").json()
        self.assertFalse(dashboard["available"])
        self.assertIsNone(dashboard["metrics"]["registered_donors"])
        self.assertIn("does not query private Supabase", dashboard["message"])


if __name__ == "__main__":
    unittest.main()
