"""Run-specific provenance must neither trust stale code nor overwrite evidence."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from research.quantum_experiments.necessity.run import source_snapshot
from research.quantum_experiments.necessity.validate import validate_sources, save_report


class NecessityProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.module = self.root / 'research/quantum_experiments/necessity/run.py'
        self.module.parent.mkdir(parents=True)
        self.module.write_text('initial source\n')
        self.plan = self.module.parent / 'PROTOCOL.md'
        self.plan.write_text('frozen plan\n')
        self.dependency = self.root / 'optimization/models.py'
        self.dependency.parent.mkdir()
        self.dependency.write_text('model\n')

    def protocol(self):
        return {'source_sha256': source_snapshot(self.root),
                'source_path_format': 'repository-relative-v1',
                'source_coverage': 'test coverage',
                'plan_sha256': hashlib.sha256(self.plan.read_bytes()).hexdigest()}

    def test_portable_snapshot_covers_imported_production_source(self):
        protocol = self.protocol()
        self.assertIn('optimization/models.py', protocol['source_sha256'])
        self.assertTrue(all(not Path(p).is_absolute() for p in protocol['source_sha256']))
        result = validate_sources(protocol, self.root)
        self.assertFalse(result['legacy_source_scope'])
        self.dependency.write_text('changed semantics\n')
        with self.assertRaisesRegex(ValueError, 'Source hash mismatch: optimization/models.py'):
            validate_sources(protocol, self.root)

    def test_legacy_absolute_paths_relocate_but_disclose_limited_coverage(self):
        protocol = self.protocol()
        protocol.pop('source_path_format')
        protocol.pop('source_coverage')
        protocol['source_sha256'] = {
            '/old/machine/repo/research/quantum_experiments/necessity/run.py':
            hashlib.sha256(self.module.read_bytes()).hexdigest()}
        result = validate_sources(protocol, self.root)
        self.assertTrue(result['legacy_source_scope'])
        self.assertIn('dependencies were not captured', result['source_coverage'])
        self.module.write_text('changed\n')
        with self.assertRaisesRegex(ValueError, 'Source hash mismatch'):
            validate_sources(protocol, self.root)

    def test_missing_snapshot_and_escaping_paths_are_rejected(self):
        protocol = self.protocol()
        protocol['source_sha256'] = {}
        with self.assertRaisesRegex(ValueError, 'nonempty'):
            validate_sources(protocol, self.root)
        protocol['source_sha256'] = {'../outside.py': 'bad'}
        with self.assertRaisesRegex(ValueError, 'escapes repository'):
            validate_sources(protocol, self.root)

    def test_changed_plan_is_rejected(self):
        protocol = self.protocol()
        self.plan.write_text('changed protocol\n')
        with self.assertRaisesRegex(ValueError, 'plan hash mismatch'):
            validate_sources(protocol, self.root)

    def test_report_is_local_and_never_overwrites_previous_evidence(self):
        selected = self.root / 'fresh_run'
        selected.mkdir()
        old = self.root / 'necessity_validation.json'
        old.write_text('historical evidence')
        save_report(selected, {'validated_runs': 240})
        self.assertEqual(json.loads((selected / 'validation.json').read_text()), {'validated_runs': 240})
        self.assertEqual(old.read_text(), 'historical evidence')
        with self.assertRaises(FileExistsError):
            save_report(selected, {'validated_runs': 0})
        self.assertEqual(json.loads((selected / 'validation.json').read_text())['validated_runs'], 240)


if __name__ == '__main__':
    unittest.main()
