"""Behavior tests for the reusable cross-file data validation layer."""

from __future__ import annotations

import copy
import unittest

from backend.data_loader import load_data
from backend.data_validation import DataValidationError, validate_data


class DataValidationTests(unittest.TestCase):
    def valid_data(self) -> dict[str, object]:
        """Start every test with a fresh copy of the real synthetic fixture."""

        return copy.deepcopy(load_data())

    def test_valid_data_passes(self) -> None:
        validate_data(self.valid_data())

    def test_negative_inventory_has_field_path(self) -> None:
        data = self.valid_data()
        data["blood_banks"]["blood_banks"][0]["inventory"]["O"] = -1

        with self.assertRaisesRegex(DataValidationError, r"blood_banks\.blood_banks\[0\]\.inventory\.O.*non-negative"):
            validate_data(data)

    def test_negative_demand_has_field_path(self) -> None:
        data = self.valid_data()
        data["hospitals"]["hospitals"][0]["demand"][0]["units"] = -2

        with self.assertRaisesRegex(DataValidationError, r"hospitals\.hospitals\[0\]\.demand\[0\]\.units.*non-negative"):
            validate_data(data)

    def test_duplicate_bank_and_hospital_ids_are_rejected(self) -> None:
        with self.subTest(entity="blood bank"):
            data = self.valid_data()
            data["blood_banks"]["blood_banks"][1]["id"] = data["blood_banks"]["blood_banks"][0]["id"]
            with self.assertRaisesRegex(DataValidationError, "duplicate blood bank id"):
                validate_data(data)

        with self.subTest(entity="hospital"):
            data = self.valid_data()
            data["hospitals"]["hospitals"][1]["id"] = data["hospitals"]["hospitals"][0]["id"]
            with self.assertRaisesRegex(DataValidationError, "duplicate hospital id"):
                validate_data(data)

    def test_unsupported_blood_group_is_rejected(self) -> None:
        data = self.valid_data()
        data["hospitals"]["hospitals"][0]["demand"][0]["blood_group"] = "Z"

        with self.assertRaisesRegex(DataValidationError, "unsupported blood group 'Z'"):
            validate_data(data)

    def test_route_with_unknown_entity_is_rejected(self) -> None:
        data = self.valid_data()
        data["routes"]["routes"][0]["destination"] = "hospital_missing"

        with self.assertRaisesRegex(DataValidationError, "unknown hospital id 'hospital_missing'"):
            validate_data(data)

    def test_negative_route_time_and_cost_are_rejected(self) -> None:
        for field in ("travel_time_minutes", "transport_cost"):
            with self.subTest(field=field):
                data = self.valid_data()
                data["routes"]["routes"][0][field] = -0.5
                with self.assertRaisesRegex(DataValidationError, f"routes\\.routes\\[0\\]\\.{field}.*non-negative"):
                    validate_data(data)

    def test_zero_route_time_and_cost_are_allowed(self) -> None:
        data = self.valid_data()
        data["routes"]["routes"][0]["travel_time_minutes"] = 0
        data["routes"]["routes"][0]["transport_cost"] = 0

        validate_data(data)

    def test_malformed_compatibility_group_is_rejected(self) -> None:
        data = self.valid_data()
        data["compatibility"]["rules"][0]["recipient_group"] = "Z"

        with self.assertRaisesRegex(DataValidationError, "unsupported blood group 'Z'"):
            validate_data(data)

    def test_incomplete_compatibility_table_is_rejected(self) -> None:
        data = self.valid_data()
        data["compatibility"]["rules"].pop()

        with self.assertRaisesRegex(DataValidationError, "missing donor/recipient rule"):
            validate_data(data)

    def test_invalid_urgency_is_rejected(self) -> None:
        data = self.valid_data()
        data["hospitals"]["hospitals"][0]["demand"][0]["urgency"] = "urgent"

        with self.assertRaisesRegex(DataValidationError, "must be one of: critical, high, low, medium"):
            validate_data(data)


if __name__ == "__main__":
    unittest.main()
