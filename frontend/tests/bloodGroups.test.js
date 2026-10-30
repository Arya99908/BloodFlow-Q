import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOOD_GROUPS, saveDonorProfile, updateDonorProfile, createEmergencyRequest } from '../src/services/donorNetwork.js';

test('coordination exposes all eight supported ABO/Rh labels', () => {
  assert.deepEqual(BLOOD_GROUPS, ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
});
test('unsupported labels are rejected before any database write', async () => {
  const client = new Proxy({}, { get() { throw new Error('Database must not be called'); } });
  for (const group of ['', 'unknown', 'U-']) {
    await assert.rejects(saveDonorProfile(client, 'user', { blood_group: group }), /supported blood groups/);
    await assert.rejects(updateDonorProfile(client, 'user', { blood_group: group }), /supported blood groups/);
    await assert.rejects(createEmergencyRequest(client, { blood_group: group }), /supported blood groups/);
  }
});
