-- Correct a missing explicit revoke discovered by Supabase's security advisor.
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default, so the
-- anonymous API role must not be able to call this authorized release step.
revoke all on function public.record_collection_release(uuid, integer)
  from public, anon;

-- Signed-in access is still checked inside the function against the
-- appointment, verified collection-centre membership, and request state.
grant execute on function public.record_collection_release(uuid, integer)
  to authenticated;
