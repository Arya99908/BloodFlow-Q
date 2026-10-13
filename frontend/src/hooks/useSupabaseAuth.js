import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

/** Share the current browser-tab auth state with donor and hospital pages. */
export function useSupabaseAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (!error) setSession(data.session || null);
      setLoading(false);
    }).catch(() => {
      // A storage/refresh failure must leave the portal in a logged-out state
      // instead of surfacing an unhandled browser promise rejection.
      if (mounted) setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { client: supabase, configured: Boolean(supabase), session, user: session?.user || null, loading };
}
