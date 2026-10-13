-- Trigger handlers are implementation details, not browser-callable RPCs.
-- Revoke direct execution explicitly because hosted Supabase projects can have
-- default privileges granting new functions to authenticated users.
revoke all on function public.audit_donor_consent() from public, anon, authenticated;
revoke all on function public.withdraw_open_donor_notifications() from public, anon, authenticated;
revoke all on function public.audit_request_status() from public, anon, authenticated;
