import { createClient } from '@supabase/supabase-js';

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// The public/publishable key identifies this browser app; database RLS—not
// this key—must enforce who can read and change private rows. Never add a
// service-role/secret key to a VITE_ variable or browser bundle.
export const supabaseConfigured = Boolean(projectUrl && publishableKey && import.meta.env.VITE_ENABLE_PRIVATE_PILOT === 'true');

export const supabase = supabaseConfigured
  ? createClient(projectUrl, publishableKey, {
      auth: {
        // Keep this prototype's sign-in session for this browser tab only.
        storage: typeof window === 'undefined' ? undefined : window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Private donor and hospital services are not configured. Apply and verify the donor contact lifecycle migration, configure Supabase, and explicitly enable the private pilot.');
  }
  return supabase;
}
