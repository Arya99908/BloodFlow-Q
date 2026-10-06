"""Tests for strict loading of the small synthetic dataset."""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from backend.data_loader import DataValidationError, load_data


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DATA_DIR = PROJECT_ROOT / "data"
DATA_FILES = (
    "blood_banks.json",
    "hospitals.json",
    "routes.json",
    "compatibility.json",
)


class DataLoaderTests(unittest.TestCase):
    def make_temporary_dataset(self) -> tuple[tempfile.TemporaryDirectory[str], Path, dict[str, object]]:
        """Copy fixture files so each malformed-data test is isolated."""

        temporary_directory = tempfile.TemporaryDirectory()
        target = Path(temporary_directory.name)
        documents: dict[str, object] = {}
        for file_name in DATA_FILES:
            content = json.loads((SOURCE_DATA_DIR / file_name).read_text(encoding="utf-8"))
            documents[file_name] = content
            (target / file_name).write_text(json.dumps(content, indent=2), encoding="utf-8")
        return temporary_directory, target, documents

    def rewrite(self, directory: Path, file_name: str, content: object) -> None:
        (directory / file_name).write_text(json.dumps(content, indent=2), encoding="utf-8")

    def test_loads_three_banks_three_hospitals_and_four_groups(self) -> None:
        loaded = load_data()

        banks = loaded["blood_banks"]["blood_banks"]
        hospitals = loaded["hospitals"]["hospitals"]
        groups = loaded["blood_banks"]["blood_groups"]
        self.assertEqual(len(banks), 3)
        self.assertEqual(len(hospitals), 3)
        self.assertEqual(groups, ["O", "A", "B", "AB"])
        self.assertTrue(all(set(bank["inventory"]) == set(groups) for bank in banks))
        self.assertEqual(len(loaded["routes"]["routes"]), 9)
        self.assertEqual(len(loaded["compatibility"]["rules"]), 16)

    def test_default_data_directory_does_not_depend_on_current_directory(self) -> None:
        loaded = load_data()
        self.assertTrue(loaded["blood_banks"]["synthetic"])

    def test_missing_file_has_clear_error(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(DataValidationError, "blood_banks.json.*does not exist"):
                load_data(directory)

    def test_malformed_json_reports_filename_and_location(self) -> None:
        temporary, directory, _ = self.make_temporary_dataset()
        self.addCleanup(temporary.cleanup)
        (directory / "routes.json").write_text('{"routes": [}', encoding="utf-8")

        with self.assertRaisesRegex(DataValidationError, "routes.json.*line 1, column"):
            load_data(directory)

    def test_unknown_field_is_not_silently_ignored(self) -> None:
        temporary, directory, docs = self.make_temporary_dataset()
        self.addCleanup(temporary.cleanup)
        banks = copy.deepcopy(docs["blood_banks.json"])
        banks["blood_banks"][0]["inventroy"] = banks["blood_banks"][0]["inventory"]
        self.rewrite(directory, "blood_banks.json", banks)

        with self.assertRaisesRegex(DataValidationError, "unexpected field.*inventroy"):
            load_data(directory)

    def test_boolean_is_not_accepted_as_inventory_count(self) -> None:
        temporary, directory, docs = self.make_temporary_dataset()
        self.addCleanup(temporary.cleanup)
        banks = copy.deepcopy(docs["blood_banks.json"])
        banks["blood_banks"][0]["inventory"]["O"] = True
        self.rewrite(directory, "blood_banks.json", banks)

        with self.assertRaisesRegex(DataValidationError, "inventory.O.*whole number"):
            load_data(directory)

    def test_duplicate_or_incomplete_route_table_is_rejected(self) -> None:
        temporary, directory, docs = self.make_temporary_dataset()
        self.addCleanup(temporary.cleanup)
        routes = copy.deepcopy(docs["routes.json"])
        routes["routes"].pop()
        self.rewrite(directory, "routes.json", routes)

        with self.assertRaisesRegex(DataValidationError, "missing route record"):
            load_data(directory)

    def test_incomplete_compatibility_table_is_rejected(self) -> None:
        temporary, directory, docs = self.make_temporary_dataset()
        self.addCleanup(temporary.cleanup)
        compatibility = copy.deepcopy(docs["compatibility.json"])
        compatibility["rules"].pop()
        self.rewrite(directory, "compatibility.json", compatibility)

        with self.assertRaisesRegex(DataValidationError, "missing donor/recipient rule"):
            load_data(directory)

    def test_non_synthetic_dataset_is_rejected(self) -> None:
        temporary, directory, docs = self.make_temporary_dataset()
        self.addCleanup(temporary.cleanup)
        hospitals = copy.deepcopy(docs["hospitals.json"])
        hospitals["synthetic"] = False
        self.rewrite(directory, "hospitals.json", hospitals)

        with self.assertRaisesRegex(DataValidationError, "synthetic.*must be true"):
            load_data(directory)


if __name__ == "__main__":
    unittest.main()
