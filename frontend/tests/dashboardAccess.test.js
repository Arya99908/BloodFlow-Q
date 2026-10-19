import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDashboardCount, getDashboardAccessState } from '../src/utils/dashboardAccess.js';
import { getDashboardMetrics } from '../src/services/donorNetwork.js';

test('reports sign-in requirement instead of implying the database is empty', () => {
  const state = getDashboardAccessState({ configured: true, session: null });

  assert.equal(state.key, 'sign_in_required');
  assert.match(state.message, /verified platform administrator/i);
  assert.equal(state.valueLabel, 'Sign in');
});

test('distinguishes an authenticated non-admin from a database failure', () => {
  const denied = getDashboardAccessState({
    configured: true,
    session: { user: { id: 'synthetic-user' } },
    error: { code: '42501', message: 'permission denied' },
  });
  const failed = getDashboardAccessState({
    configured: true,
    session: { user: { id: 'synthetic-user' } },
    error: { code: '08006', message: 'connection failed' },
  });

  assert.equal(denied.key, 'admin_required');
  assert.equal(failed.key, 'database_error');
});

test('preserves real zero counts and never converts missing data to zero', () => {
  assert.equal(formatDashboardCount({ registered_donors: 0 }, 'registered_donors', 'Sign in'), '0');
  assert.equal(formatDashboardCount({}, 'registered_donors', 'Sign in'), 'Sign in');
  assert.equal(formatDashboardCount({ registered_donors: -1 }, 'registered_donors', 'Sign in'), 'Sign in');
});

test('reports missing Supabase configuration separately', () => {
  const state = getDashboardAccessState({ configured: false });
  assert.equal(state.key, 'not_configured');
  assert.equal(state.valueLabel, 'Not set up');
});

test('preserves Supabase authorization codes for the dashboard access state', async () => {
  const client = {
    rpc: async () => ({ data: null, error: { code: '42501', message: 'permission denied' } }),
  };

  await assert.rejects(getDashboardMetrics(client), (error) => {
    assert.equal(error.code, '42501');
    const state = getDashboardAccessState({
      configured: true,
      session: { user: { id: 'synthetic-user' } },
      error,
    });
    assert.equal(state.key, 'admin_required');
    assert.equal(state.valueLabel, 'Admin only');
    return true;
  });
});
