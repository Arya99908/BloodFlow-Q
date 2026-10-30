import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOOD_GROUPS, saveDonorProfile, updateDonorProfile, createEmergencyRequest } from '../src/services/donorNetwork.js';

test('coordination only exposes the four supported positive groups', () => {
  assert.deepEqual(BLOOD_GROUPS, ['A+', 'B+', 'AB+', 'O+']);
});
test('unsupported labels are rejected before any database write', async () => {
  const client = new Proxy({}, { get() { throw new Error('Database must not be called'); } });
  for (const group of ['', 'unknown', 'A' + String.fromCharCode(45)]) {
    await assert.rejects(saveDonorProfile(client, 'user', { blood_group: group }), /supported positive/);
    await assert.rejects(updateDonorProfile(client, 'user', { blood_group: group }), /supported positive/);
    await assert.rejects(createEmergencyRequest(client, { blood_group: group }), /supported positive/);
  }
});
