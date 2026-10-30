-- Optional private pilot only. Apply and test before enabling private UI.
begin;
create or replace function public.may_view_donor_contact(p_donor_id uuid)
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (
    select 1 from public.donor_profiles d
    join public.donor_request_notifications n on n.donor_user_id=d.user_id and n.status='accepted'
    join public.emergency_blood_requests r on r.id=n.request_id
    where d.user_id=p_donor_id and d.consent_share_contact
      and r.status not in ('completed','cancelled')
      and n.responded_at > now() - interval '24 hours'
      and r.required_by > now()
      and (
        public.has_institution_role(r.hospital_institution_id, array['hospital_admin','hospital_staff','collection_coordinator'])
        or exists (select 1 from public.stock_reservations s
          join public.verified_component_inventory i on i.id=s.inventory_id
          where s.request_id=r.id and s.released_at is null
            and public.has_institution_role(i.blood_bank_institution_id,array['blood_bank_staff','collection_coordinator']))
        or exists (select 1 from public.collection_appointments a
          where a.request_id=r.id and a.status in ('proposed','confirmed','attended')
            and public.has_institution_role(a.collection_centre_id,array['blood_bank_staff','collection_coordinator']))
        or public.is_platform_admin()
      )
  );
$$;
-- Institutional permission no longer grants an entire profile row.
drop policy if exists donor_profile_read_self_or_authorized on public.donor_profiles;
create policy donor_profile_read_self_or_authorized on public.donor_profiles
  for select to authenticated using (user_id=auth.uid() or public.is_platform_admin());

create or replace function public.get_consented_donor_contact(p_donor_id uuid)
returns table(full_name text, contact_method text, contact_value text)
language sql stable security definer set search_path=public,auth,pg_temp as $$
  select d.full_name, d.preferred_contact,
    case when d.preferred_contact='email' then d.email else d.phone end
  from public.donor_profiles d
  where d.user_id=p_donor_id and public.may_view_donor_contact(d.user_id);
$$;
revoke all on function public.get_consented_donor_contact(uuid) from public, anon;
grant execute on function public.get_consented_donor_contact(uuid) to authenticated;
commit;
