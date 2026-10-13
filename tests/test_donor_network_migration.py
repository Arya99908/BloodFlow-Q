"""Source guardrails for the optional Supabase migration.

These tests catch accidental removal of RLS/privacy conditions. They do not
execute PostgreSQL and are not a substitute for testing a disposable Supabase
project before enabling private coordination.
"""
from pathlib import Path
import unittest


MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202610130001_donor_emergency_network.sql"


class DonorNetworkMigrationGuardrailTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8").lower()

    def test_private_tables_enable_row_level_security(self):
        tables = (
            "donor_profiles", "donor_consent_events", "emergency_blood_requests",
            "donor_request_notifications", "donor_responses", "collection_appointments",
            "transport_assignments", "request_status_history", "verified_component_inventory",
        )
        for table in tables:
            with self.subTest(table=table):
                self.assertIn(f"alter table public.{table} enable row level security", self.sql)

    def test_browser_roles_do_not_receive_anonymous_table_access(self):
        self.assertIn("from public, anon, authenticated", self.sql)
        self.assertIn("grant select on public.authorized_institutions", self.sql)
        self.assertNotIn("grant all on", self.sql)

    def test_donor_contact_requires_acceptance_and_separate_consent(self):
        function = self.sql.split("create or replace function public.may_view_donor_contact", 1)[1].split("$$;", 1)[0]
        self.assertIn("n.status = 'accepted'", function)
        self.assertIn("d.consent_share_contact", function)

    def test_request_tables_do_not_grant_donor_user_ids_for_ui_queries(self):
        self.assertIn("grant select (id, request_id, suggestion_reason, status, contacted_at, responded_at, created_at)", self.sql)
        self.assertIn("grant select (id, request_id, collection_centre_id, scheduled_at, status, confirmed_units, created_at, updated_at)", self.sql)
        self.assertNotIn("grant select on public.donor_request_notifications", self.sql)
        self.assertNotIn("grant select on public.collection_appointments", self.sql)
        self.assertNotIn("grant select on public.donor_responses", self.sql)

    def test_outreach_is_unique_and_withdrawal_closes_pending_notices(self):
        self.assertIn("unique (request_id, donor_user_id)", self.sql)
        withdrawal = self.sql.split("create or replace function public.withdraw_open_donor_notifications", 1)[1].split("$$;", 1)[0]
        self.assertIn("new.consent_receive_requests = false", withdrawal)
        self.assertIn("status = 'withdrawn'", withdrawal)

    def test_appointment_decline_reopens_the_request_for_rescheduling(self):
        response = self.sql.split("create or replace function public.respond_to_collection_appointment", 1)[1].split("$$;", 1)[0]
        self.assertIn("if not p_confirm then", response)
        self.assertIn("set status = 'donor_accepted'", response)

    def test_transport_requires_staff_role_and_verified_hospital_link(self):
        function = self.sql.split("create or replace function public.assign_request_transport", 1)[1].split("$$;", 1)[0]
        self.assertIn("has_institution_role(p_institution_id", function)
        self.assertIn("blood_bank_access", function)
        self.assertIn("a.verified", function)

    def test_collection_team_requires_confirmed_centre_appointment_and_staff_role(self):
        function = self.sql.split("create or replace function public.assign_authorized_collection_team", 1)[1].split("$$;", 1)[0]
        self.assertIn("assignment_status <> 'available'", function)
        self.assertIn("institution_type = 'licensed_collection_centre'", function)
        self.assertIn("has_institution_role(team.institution_id", function)
        self.assertIn("a.status = 'confirmed'", function)
        self.assertIn("one_assigned_collection_team_per_request_idx", self.sql)

    def test_request_audit_records_submission_before_inventory_verification(self):
        create_request = self.sql.split("create or replace function public.create_emergency_blood_request", 1)[1].split("$$;", 1)[0]
        inventory = self.sql.split("create or replace function public.verify_request_inventory", 1)[1].split("$$;", 1)[0]
        self.assertIn("'submitted', auth.uid()", create_request)
        self.assertIn("if r.status = 'submitted' then", inventory)
        self.assertIn("set status = 'verifying_inventory'", inventory)

    def test_reserved_stock_is_consumed_only_after_completion(self):
        function = self.sql.split("create or replace function public.advance_emergency_request", 1)[1].split("$$;", 1)[0]
        self.assertIn("elsif new_status = 'completed' then", function)
        self.assertIn("units_available = units_available - stock_row.units_reserved", function)
        self.assertIn("new_status = 'cancelled'", function)

    def test_dispatch_readiness_requires_confirmed_quantities(self):
        function = self.sql.split("create or replace function public.advance_emergency_request", 1)[1].split("$$;", 1)[0]
        self.assertIn("authorized centre-confirmed units plus verified stock do not cover the request quantity", function)
        self.assertIn("sum(a.confirmed_units)", function)
        self.assertIn("a.status = 'reviewed'", function)

    def test_collection_quantity_is_recorded_only_by_attended_centre_staff(self):
        function = self.sql.split("create or replace function public.record_collection_release", 1)[1].split("$$;", 1)[0]
        self.assertIn("a.status <> 'attended'", function)
        self.assertIn("r.status <> 'testing_and_compatibility_checks'", function)
        self.assertIn("has_institution_role(a.collection_centre_id", function)
        self.assertIn("p_units > coalesce(r.shortfall_units, 0)", function)
        self.assertIn("status = 'reviewed', confirmed_units = p_units", function)
        self.assertIn("grant execute on function public.record_collection_release(uuid,integer) to authenticated", self.sql)


if __name__ == "__main__":
    unittest.main()
