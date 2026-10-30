"""Guard publication against fabricated, conflated, or stale research observations."""
import hashlib
import json
import math
import unittest
from pathlib import Path

from experiments.build_observatory_evidence import ROOT, RUNS, WARM, build


class ObservatoryEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = build()
        cls.raw = [json.loads(line) for line in (ROOT / RUNS).read_text().splitlines()]

    def test_public_artifact_is_reproducible_and_bounded(self):
        path=ROOT/'frontend/public/observatory-evidence.json'
        self.assertEqual(json.loads(path.read_text()), self.data)
        self.assertLess(path.stat().st_size, 2_000_000)
        for source in self.data['sources']:
            self.assertEqual(hashlib.sha256((ROOT/source['path']).read_bytes()).hexdigest(),source['sha256'])

    def test_observations_preserve_all_outcomes_and_measurement_units(self):
        self.assertEqual(len(self.data['observations']),len(self.raw))
        for row, raw in zip(self.data['observations'], self.raw):
            self.assertEqual(row['id'],raw['key'])
            self.assertEqual(row['status'],raw['status'])
            self.assertEqual(row['recorded_elapsed_seconds'],raw.get('wall_seconds'))
            if row['status']=='completed':
                self.assertEqual(row['runtime_seconds'],raw.get('wall_seconds'))
            self.assertEqual(row['operational_feasible_shot_rate'],raw.get('feasible_shot_rate'))
            self.assertEqual(row['strict_feasible_probability'],raw.get('final_feasible_probability'))
            if raw.get('feasibility') is not True:
                self.assertIsNone(row['absolute_gap'])
            if raw['status']=='skipped':
                self.assertIsNone(row['runtime_seconds'])
                self.assertEqual(row['backend'],'not executed')
            if row['absolute_gap'] is not None:
                self.assertEqual(row['raw_absolute_gap'], raw['objective']-raw['reference_optimum'])
                if abs(row['raw_absolute_gap']) <= 1e-9:
                    self.assertEqual(row['absolute_gap'], 0.0)
                    self.assertEqual(row['relative_gap'], 0.0)
                else:
                    self.assertEqual(row['absolute_gap'], row['raw_absolute_gap'])

    def test_warm_comparison_uses_exact_observations_not_rounded_headlines(self):
        w=self.data['warm_start'];raw=json.loads((ROOT/WARM).read_text())
        self.assertEqual(len(w['observations']),6)
        self.assertEqual(w['conditions']['scenario'], 'demo_normal')
        self.assertIn("Scenario(id='" + w['conditions']['scenario'] + "'", raw['scenario'])
        for row in w['observations']:
            original=raw['runs'][row['source']['run_index']]
            self.assertEqual(row['optimal_shot_rate'],original['optimal_shot_rate'])
            self.assertEqual(sum(original['counts'].values()),row['shots'])
        self.assertAlmostEqual(w['standard_mean'],0.0078125)
        self.assertAlmostEqual(w['warm_mean'],0.5442708333333334)
        self.assertAlmostEqual(w['ratio'],69.66666666666667)
        self.assertAlmostEqual(w['difference_pp'],53.645833333333336)

    def test_numerical_tolerance_preserves_raw_roundoff(self):
        tiny = [r for r in self.data['observations'] if r['raw_absolute_gap'] is not None and 0 < abs(r['raw_absolute_gap']) <= 1e-9]
        self.assertTrue(tiny)
        for row in tiny:
            self.assertEqual(row['absolute_gap'], 0.0)
            self.assertEqual(row['relative_gap'], 0.0)
            self.assertNotEqual(row['raw_relative_gap'], 0.0)

    def test_execution_distributions_conserve_recorded_shots(self):
        for row in self.data['execution_examples']:
            self.assertEqual(sum(row['counts'].values()),row['shots'])
            self.assertEqual(sum(v for k,v in row['gate_counts'].items() if k in {'rzz','rxx','ryy','cx','cz'}),row['two_qubit_gates'])
            self.assertIsNone(row['circuit_operations'])

    def test_skipped_scaling_does_not_invent_quantum_measurements(self):
        for row in self.data['scaling']:
            if row['status']=='skipped_quantum':
                self.assertIsNone(row['runtime_seconds'])
                self.assertIsNone(row['strict_feasible_probability'])
            self.assertEqual(row['estimated_full_statevector_bytes'],16*2**row['full_qubits'])
        self.assertTrue(all(row['connectivity']=='all_to_all_unrouted' for row in self.data['basis_resources']))

if __name__=='__main__':
    unittest.main()
