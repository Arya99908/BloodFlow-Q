"""Experiment output handling must preserve every previously recorded run."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from experiments.run_experiments import _write_experiment_files


class ExperimentOutputSafetyTests(unittest.TestCase):
    def test_existing_result_is_never_overwritten_or_paired_with_new_config(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            result_path = root / "results" / "run.json"
            config_path = root / "configurations" / "run.json"
            result_path.parent.mkdir()
            config_path.parent.mkdir()
            original = '{"original": true}\n'
            result_path.write_text(original, encoding="utf-8")

            with self.assertRaisesRegex(FileExistsError, "choose a new --run-id"):
                _write_experiment_files(
                    result_path, config_path,
                    {"configuration": {"new": True}, "results": []},
                )

            self.assertEqual(result_path.read_text(encoding="utf-8"), original)
            self.assertFalse(config_path.exists())

    def test_existing_configuration_prevents_creation_of_raw_result(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            result_path = root / "results" / "run.json"
            config_path = root / "configurations" / "run.json"
            result_path.parent.mkdir()
            config_path.parent.mkdir()
            original = '{"configuration": "original"}\n'
            config_path.write_text(original, encoding="utf-8")

            with self.assertRaises(FileExistsError):
                _write_experiment_files(
                    result_path, config_path,
                    {"configuration": {"new": True}, "results": []},
                )

            self.assertFalse(result_path.exists())
            self.assertEqual(config_path.read_text(encoding="utf-8"), original)


if __name__ == "__main__":
    unittest.main()
