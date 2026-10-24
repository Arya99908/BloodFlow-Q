import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectStudyTrials } from '../src/utils/studyTrials.js';
test('historical seed 201 resolves to an actual confirmatory trial', () => {
  const study = JSON.parse(readFileSync(new URL('../public/quantum-value-study.json', import.meta.url)));
  const selected = selectStudyTrials(study, 'multi_facility_tradeoff', '201');
  assert.equal(selected.selectedSeed, '301');
  assert.ok(selected.rows.some(row => row.method === 'qaoa' && String(row.seed) === selected.selectedSeed));
  assert.equal(selectStudyTrials(study, 'multi_facility_tradeoff', '305').selectedSeed, '305');
});
test('empty or changing artifacts do not invent trial identifiers', () => {
  assert.deepEqual(selectStudyTrials(null, 'missing', '201').seeds, []);
  const study = { configuration: { scenario_sizes: { new_case: {} } }, results: [{scenario_id:'new_case',seed:42}] };
  assert.equal(selectStudyTrials(study,'old_case','301').selectedSeed,'42');
});
