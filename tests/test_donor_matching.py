"""The matcher suggests coordination candidates, never medical eligibility."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from backend.donor_matching import DonorCandidate, EmergencyNeed, match_donors, request_priority_key


def need(**overrides):
    values = {
        "request_id": "REQ-1",
        "blood_group": "O+",
        "component": "Red blood cells",
        "units": 2,
        "urgency": "urgent",
        "required_by": datetime(2030, 1, 2, tzinfo=timezone.utc),
        "city": "Synthetic City",
        "approximate_location": "North Area",
    }
    values.update(overrides)
    return EmergencyNeed(**values)


def candidate(donor_id, **overrides):
    values = {
        "donor_id": donor_id,
        "blood_group": "O+",
        "city": "Synthetic City",
        "approximate_location": "North Area",
        "availability": "available",
        "request_consent": True,
        "share_contact_consent": False,
        "approximate_distance_km": 3.0,
    }
    values.update(overrides)
    return DonorCandidate(**values)


class DonorMatchingTests(unittest.TestCase):
    def test_only_exact_group_available_consented_uncontacted_candidates_are_suggested(self):
        rows = [
            candidate("good"),
            candidate("other-group", blood_group="A+"),
            candidate("unavailable", availability="temporarily_unavailable"),
            candidate("do-not-contact", availability="do_not_contact"),
            candidate("no-request-consent", request_consent=False),
            candidate("declined", declined_request_ids=frozenset({"REQ-1"})),
            candidate("already-contacted", contacted_request_ids=frozenset({"REQ-1"})),
        ]
        matches = match_donors(need(), rows)
        self.assertEqual([item.donor_id for item in matches], ["good"])
        self.assertFalse(matches[0].medical_eligibility_confirmed)
        self.assertNotIn("phone", matches[0].__dict__)
        self.assertIn("authorized personnel", matches[0].reason.casefold())

    def test_matching_is_approximate_and_ordered_without_exact_location_disclosure(self):
        rows = [
            candidate("far", approximate_location="South Area", approximate_distance_km=9),
            candidate("near", approximate_distance_km=1),
        ]
        matches = match_donors(need(), rows, maximum_suggestions=1)
        self.assertEqual(matches[0].donor_id, "near")
        self.assertEqual(matches[0].approximate_location, "North Area")

    def test_distance_filter_and_duplicate_donor_records(self):
        matches = match_donors(
            need(),
            [candidate("near", approximate_distance_km=2), candidate("near", approximate_distance_km=1),
             candidate("unknown", approximate_distance_km=None)],
            maximum_distance_km=3,
        )
        self.assertEqual([item.donor_id for item in matches], ["near"])

    def test_request_priority_uses_urgency_then_required_by(self):
        critical = need(urgency="critical")
        urgent_earlier = need(required_by=datetime(2030, 1, 1, tzinfo=timezone.utc))
        self.assertLess(request_priority_key(critical), request_priority_key(urgent_earlier))

    def test_invalid_match_limits_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "maximum_suggestions"):
            match_donors(need(), [], maximum_suggestions=0)
        with self.assertRaisesRegex(ValueError, "maximum_distance"):
            match_donors(need(), [], maximum_distance_km=-1)


if __name__ == "__main__":
    unittest.main()
