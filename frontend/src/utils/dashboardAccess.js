/**
 * Turns the private dashboard query outcome into an honest, user-facing state.
 * A missing count is never converted into zero: zero is shown only when the
 * authorized database RPC actually returns zero.
 */
export function getDashboardAccessState({ configured, session, error } = {}) {
  if (!configured) {
    return {
      key: 'not_configured',
      valueLabel: 'Not set up',
      message: 'The Supabase connection is not configured, so live database counts cannot be loaded.',
    };
  }

  if (error) {
    const errorText = `${error.code || ''} ${error.message || error}`.toLowerCase();
    if (error.code === '42501' || errorText.includes('platform administrator')) {
      return {
        key: 'admin_required',
        valueLabel: 'Admin only',
        message: 'You are signed in, but this account is not authorized as a platform administrator. Database access policies are working as intended.',
      };
    }
    return {
      key: 'database_error',
      valueLabel: 'Query error',
      message: 'The dashboard could not read its authorized database metrics. Retry after checking the Supabase connection.',
    };
  }

  if (!session) {
    return {
      key: 'sign_in_required',
      valueLabel: 'Sign in',
      message: 'Sign in with an account that has the verified platform administrator role to view live database counts.',
    };
  }

  return {
    key: 'available',
    valueLabel: '',
    message: '',
  };
}

export function formatDashboardCount(metrics, key, unavailableLabel) {
  const value = metrics?.[key];
  return Number.isInteger(value) && value >= 0 ? value.toLocaleString() : unavailableLabel;
}
