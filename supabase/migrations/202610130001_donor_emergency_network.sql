-- BloodFlow-Q donor and emergency-coordination schema.
-- Apply with `supabase db push` only after reviewing it in a disposable project.
-- This migration does not seed real hospitals, donors, inventory, or accounts.

create extension if not exists pgcrypto;

do $$ begin
  create type public.donor_availability as enum ('available', 'temporarily_unavailable', 'do_not_contact');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.bloodflow_urgency as enum ('routine', 'urgent', 'critical');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.request_status as enum (
    'submitted', 'verifying_inventory', 'stock_available', 'searching_for_donors',
    'donor_contacted', 'donor_accepted', 'collection_arranged',
    'at_authorized_blood_centre', 'testing_and_compatibility_checks',
    'ready_for_dispatch', 'dispatched', 'received_by_hospital', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.donor_notification_status as enum ('contacted', 'accepted', 'declined', 'withdrawn');
exception when duplicate_object then null; end $$;

create table if not exists public.authorized_institutions (
  id text primary key,
  institution_type text not null check (institution_type in ('hospital', 'blood_bank', 'licensed_collection_centre', 'platform')),
  name text not null check (length(trim(name)) between 1 and 160),
  city text not null check (length(trim(city)) between 1 and 120),
  approximate_area text not null check (length(trim(approximate_area)) between 1 and 120),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.institution_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id text not null references public.authorized_institutions(id) on delete cascade,
  role text not null check (role in ('hospital_admin', 'hospital_staff', 'blood_bank_staff', 'collection_coordinator', 'platform_admin')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, institution_id)
);
create index if not exists institution_memberships_institution_role_idx
  on public.institution_memberships(institution_id, role) where verified;

create table if not exists public.donor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  blood_group text not null check (blood_group in ('A+', 'B+', 'AB+', 'O+')),
  phone text not null check (length(trim(phone)) between 7 and 40),
  email text check (email is null or length(email) <= 254),
  city text not null check (length(trim(city)) between 1 and 120),
  approximate_area text not null check (length(trim(approximate_area)) between 1 and 120),
  availability public.donor_availability not null default 'temporarily_unavailable',
  preferred_contact text not null check (preferred_contact in ('phone', 'email')),
  consent_receive_requests boolean not null default false,
  consent_share_contact boolean not null default false,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donor_email_contact_check check (preferred_contact <> 'email' or email is not null)
);
create index if not exists donor_matching_lookup_idx
  on public.donor_profiles(blood_group, city, approximate_area, updated_at)
  where availability = 'available' and consent_receive_requests;

create table if not exists public.donor_consent_events (
  id uuid primary key default gen_random_uuid(),
  donor_user_id uuid not null references auth.users(id) on delete cascade,
  consent_kind text not null check (consent_kind in ('receive_requests', 'share_contact')),
  granted boolean not null,
  recorded_at timestamptz not null default now(),
  source text not null default 'donor_portal' check (source in ('donor_portal', 'account_creation'))
);
create index if not exists donor_consent_events_owner_time_idx
  on public.donor_consent_events(donor_user_id, recorded_at desc);

create table if not exists public.blood_bank_access (
  hospital_institution_id text not null references public.authorized_institutions(id) on delete cascade,
  blood_bank_institution_id text not null references public.authorized_institutions(id) on delete cascade,
  verified boolean not null default false,
  primary key (hospital_institution_id, blood_bank_institution_id)
);

create table if not exists public.verified_component_inventory (
  id uuid primary key default gen_random_uuid(),
  blood_bank_institution_id text not null references public.authorized_institutions(id),
  blood_group text not null check (blood_group in ('A+', 'B+', 'AB+', 'O+')),
  component text not null check (component in ('red_blood_cells', 'platelets', 'plasma', 'whole_blood')),
  units_available integer not null check (units_available >= 0),
  verified_by uuid not null references auth.users(id),
  verified_at timestamptz not null default now(),
  valid_until timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists verified_inventory_search_idx
  on public.verified_component_inventory(blood_bank_institution_id, blood_group, component, valid_until)
  where active;

create table if not exists public.emergency_blood_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique default ('BFQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  hospital_institution_id text not null references public.authorized_institutions(id),
  blood_group text not null check (blood_group in ('A+', 'B+', 'AB+', 'O+')),
  component text not null check (component in ('red_blood_cells', 'platelets', 'plasma', 'whole_blood')),
  units_requested integer not null check (units_requested between 1 and 1000),
  urgency public.bloodflow_urgency not null,
  required_by timestamptz not null,
  location_city text not null check (length(trim(location_city)) between 1 and 120),
  approximate_area text not null check (length(trim(approximate_area)) between 1 and 120),
  representative_name text not null check (length(trim(representative_name)) between 1 and 120),
  representative_phone text not null check (length(trim(representative_phone)) between 7 and 40),
  representative_email text check (representative_email is null or length(representative_email) <= 254),
  notes text check (notes is null or length(notes) <= 1000),
  status public.request_status not null default 'submitted',
  verified_stock_units integer check (verified_stock_units is null or verified_stock_units >= 0),
  shortfall_units integer check (shortfall_units is null or shortfall_units >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists emergency_request_hospital_status_idx
  on public.emergency_blood_requests(hospital_institution_id, status, required_by);
create index if not exists emergency_request_urgency_due_idx
  on public.emergency_blood_requests(urgency, required_by)
  where status not in ('completed', 'cancelled');

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.emergency_blood_requests(id) on delete cascade,
  inventory_id uuid not null references public.verified_component_inventory(id),
  units_reserved integer not null check (units_reserved > 0),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, inventory_id)
);
create index if not exists stock_reservations_active_idx
  on public.stock_reservations(inventory_id) where released_at is null;

create table if not exists public.donor_request_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.emergency_blood_requests(id) on delete cascade,
  donor_user_id uuid not null references public.donor_profiles(user_id) on delete cascade,
  suggestion_reason text not null,
  status public.donor_notification_status not null default 'contacted',
  contacted_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, donor_user_id)
);
create index if not exists donor_notification_inbox_idx
  on public.donor_request_notifications(donor_user_id, contacted_at desc);
create index if not exists donor_notification_request_status_idx
  on public.donor_request_notifications(request_id, status);

create table if not exists public.donor_responses (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.donor_request_notifications(id) on delete cascade,
  donor_user_id uuid not null references auth.users(id) on delete cascade,
  response text not null check (response in ('accepted', 'declined')),
  responded_at timestamptz not null default now()
);

create table if not exists public.collection_appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.emergency_blood_requests(id) on delete cascade,
  donor_user_id uuid not null references public.donor_profiles(user_id),
  collection_centre_id text not null references public.authorized_institutions(id),
  scheduled_at timestamptz not null,
  status text not null check (status in ('proposed', 'confirmed', 'cancelled', 'attended', 'reviewed')) default 'proposed',
  -- Only authorized collection-centre staff record units confirmed after
  -- their own procedures. A donor response is never treated as inventory.
  confirmed_units integer check (confirmed_units is null or confirmed_units >= 0),
  confirmed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collection_appointment_request_time_idx
  on public.collection_appointments(request_id, scheduled_at);

create table if not exists public.authorized_collection_teams (
  id uuid primary key default gen_random_uuid(),
  institution_id text not null references public.authorized_institutions(id),
  team_label text not null check (length(trim(team_label)) between 1 and 120),
  assignment_status text not null check (assignment_status in ('available', 'assigned', 'unavailable')) default 'unavailable',
  assigned_request_id uuid references public.emergency_blood_requests(id),
  assigned_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_assigned_collection_team_per_request_idx
  on public.authorized_collection_teams(assigned_request_id)
  where assignment_status = 'assigned' and assigned_request_id is not null;

create table if not exists public.transport_assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.emergency_blood_requests(id) on delete cascade,
  institution_id text not null references public.authorized_institutions(id),
  assigned_by uuid not null references auth.users(id),
  status text not null check (status in ('assigned', 'dispatched', 'received', 'cancelled')) default 'assigned',
  estimated_arrival timestamptz,
  assignment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transport_assignment_request_idx on public.transport_assignments(request_id, status);

create table if not exists public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.emergency_blood_requests(id) on delete cascade,
  from_status public.request_status,
  to_status public.request_status not null,
  actor_user_id uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 500)
);
create index if not exists request_history_request_time_idx on public.request_status_history(request_id, recorded_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end;
$$;

create or replace function public.has_institution_role(p_institution_id text, p_roles text[])
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (
    select 1 from public.institution_memberships m
    join public.authorized_institutions i on i.id = m.institution_id and i.verified
    where m.user_id = auth.uid() and m.institution_id = p_institution_id
      and m.verified and m.role = any(p_roles)
  );
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (
    select 1 from public.institution_memberships m
    where m.user_id = auth.uid() and m.role = 'platform_admin' and m.verified
  );
$$;

create or replace function public.get_coordination_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
begin
  if not public.is_platform_admin() then
    raise exception 'restricted coordination metrics require an authorized platform administrator' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'registered_donors', (select count(*) from public.donor_profiles),
    'available_registered_donors', (select count(*) from public.donor_profiles
      where availability = 'available' and consent_receive_requests),
    'active_emergency_requests', (select count(*) from public.emergency_blood_requests
      where status not in ('completed','cancelled')),
    'requests_awaiting_donor_responses', (select count(distinct request_id)
      from public.donor_request_notifications where status = 'contacted'),
    'collection_appointments', (select count(*) from public.collection_appointments
      where status in ('proposed','confirmed')),
    'fulfilled_from_verified_stock', (select count(*) from public.emergency_blood_requests
      where verified_stock_units >= units_requested and status not in ('cancelled')),
    'awaiting_blood_bank_confirmation', (select count(*) from public.emergency_blood_requests
      where status = 'verifying_inventory'),
    'scope', 'authorized platform aggregate'
  );
end;
$$;

create or replace function public.is_request_participant(p_request_id uuid)
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (
    select 1 from public.donor_request_notifications n
    where n.request_id = p_request_id and n.donor_user_id = auth.uid()
  );
$$;

create or replace function public.may_view_donor_contact(p_donor_id uuid)
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (
    select 1
    from public.donor_profiles d
    join public.donor_request_notifications n on n.donor_user_id = d.user_id and n.status = 'accepted'
    join public.emergency_blood_requests r on r.id = n.request_id
    where d.user_id = p_donor_id and d.consent_share_contact
      and (
        public.has_institution_role(r.hospital_institution_id, array['hospital_admin','hospital_staff','collection_coordinator'])
        or exists (select 1 from public.stock_reservations s
          join public.verified_component_inventory i on i.id = s.inventory_id
          where s.request_id = r.id and public.has_institution_role(i.blood_bank_institution_id, array['blood_bank_staff','collection_coordinator']))
        or exists (select 1 from public.collection_appointments a
          where a.request_id = r.id and public.has_institution_role(a.collection_centre_id, array['blood_bank_staff','collection_coordinator']))
        or public.is_platform_admin()
      )
  );
$$;

create or replace function public.audit_donor_consent()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.donor_consent_events(donor_user_id, consent_kind, granted, source)
    values (new.user_id, 'receive_requests', new.consent_receive_requests, 'account_creation'),
           (new.user_id, 'share_contact', new.consent_share_contact, 'account_creation');
  else
    if new.consent_receive_requests is distinct from old.consent_receive_requests then
      insert into public.donor_consent_events(donor_user_id, consent_kind, granted, source)
      values (new.user_id, 'receive_requests', new.consent_receive_requests, 'donor_portal');
    end if;
    if new.consent_share_contact is distinct from old.consent_share_contact then
      insert into public.donor_consent_events(donor_user_id, consent_kind, granted, source)
      values (new.user_id, 'share_contact', new.consent_share_contact, 'donor_portal');
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.withdraw_open_donor_notifications()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if new.consent_receive_requests = false or new.availability = 'do_not_contact' then
    update public.donor_request_notifications set status = 'withdrawn', responded_at = now()
      where donor_user_id = new.user_id and status = 'contacted';
  end if;
  return new;
end;
$$;

create or replace function public.audit_request_status()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.request_status_history(request_id, from_status, to_status, actor_user_id)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.request_status_history(request_id, from_status, to_status, actor_user_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists donor_profiles_updated_at on public.donor_profiles;
create trigger donor_profiles_updated_at before update on public.donor_profiles
for each row execute function public.set_updated_at();
drop trigger if exists donor_profiles_consent_audit on public.donor_profiles;
create trigger donor_profiles_consent_audit after insert or update on public.donor_profiles
for each row execute function public.audit_donor_consent();
drop trigger if exists donor_profiles_withdraw_pending on public.donor_profiles;
create trigger donor_profiles_withdraw_pending after update of availability, consent_receive_requests on public.donor_profiles
for each row execute function public.withdraw_open_donor_notifications();
drop trigger if exists emergency_requests_updated_at on public.emergency_blood_requests;
create trigger emergency_requests_updated_at before update on public.emergency_blood_requests
for each row execute function public.set_updated_at();
drop trigger if exists emergency_requests_status_audit on public.emergency_blood_requests;
create trigger emergency_requests_status_audit after insert or update of status on public.emergency_blood_requests
for each row execute function public.audit_request_status();
drop trigger if exists collection_appointments_updated_at on public.collection_appointments;
create trigger collection_appointments_updated_at before update on public.collection_appointments
for each row execute function public.set_updated_at();
drop trigger if exists authorized_collection_teams_updated_at on public.authorized_collection_teams;
create trigger authorized_collection_teams_updated_at before update on public.authorized_collection_teams
for each row execute function public.set_updated_at();
drop trigger if exists transport_assignments_updated_at on public.transport_assignments;
create trigger transport_assignments_updated_at before update on public.transport_assignments
for each row execute function public.set_updated_at();

create or replace function public.create_emergency_blood_request(
  p_hospital_id text, p_blood_group text, p_component text, p_units integer,
  p_urgency text, p_required_by timestamptz, p_city text, p_approximate_area text,
  p_representative_name text, p_representative_phone text,
  p_representative_email text default null, p_notes text default null
) returns public.emergency_blood_requests
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare result public.emergency_blood_requests;
begin
  if not public.has_institution_role(p_hospital_id, array['hospital_admin','hospital_staff'])
     and not public.is_platform_admin() then
    raise exception 'verified hospital access is required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.authorized_institutions i where i.id = p_hospital_id and i.institution_type = 'hospital' and i.verified) then
    raise exception 'hospital identity is not verified' using errcode = '42501';
  end if;
  if p_required_by <= now() then raise exception 'required-by time must be in the future' using errcode = '22023'; end if;
  insert into public.emergency_blood_requests(
    hospital_institution_id, blood_group, component, units_requested, urgency, required_by,
    location_city, approximate_area, representative_name, representative_phone,
    representative_email, notes, status, created_by
  ) values (
    p_hospital_id, p_blood_group, p_component, p_units, p_urgency::public.bloodflow_urgency,
    p_required_by, trim(p_city), trim(p_approximate_area), trim(p_representative_name),
    trim(p_representative_phone), nullif(trim(p_representative_email), ''), nullif(trim(p_notes), ''),
    'submitted', auth.uid()
  ) returning * into result;
  return result;
end;
$$;

create or replace function public.verify_request_inventory(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r public.emergency_blood_requests; available_units integer; remaining integer; row record; reserved integer;
begin
  select * into r from public.emergency_blood_requests where id = p_request_id for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if not public.has_institution_role(r.hospital_institution_id, array['hospital_admin','hospital_staff'])
     and not public.is_platform_admin() then raise exception 'verified hospital access is required' using errcode = '42501'; end if;
  if r.status = 'submitted' then
    update public.emergency_blood_requests set status = 'verifying_inventory'
      where id = r.id returning * into r;
  end if;
  if r.status <> 'verifying_inventory' then raise exception 'request is not awaiting inventory verification' using errcode = '22023'; end if;

  -- Serialize requests for the same group/component, and count only stock
  -- recorded by verified blood-bank staff with a current validity window.
  perform pg_advisory_xact_lock(hashtext(r.blood_group || ':' || r.component));
  available_units := 0;
  remaining := r.units_requested;
  for row in
    select i.id, i.units_available,
      coalesce((select sum(s.units_reserved) from public.stock_reservations s
        where s.inventory_id = i.id and s.released_at is null), 0) as already_reserved
    from public.verified_component_inventory i
    join public.blood_bank_access a on a.blood_bank_institution_id = i.blood_bank_institution_id
      and a.hospital_institution_id = r.hospital_institution_id and a.verified
    where i.active and i.valid_until > now() and i.blood_group = r.blood_group and i.component = r.component
      and exists (select 1 from public.authorized_institutions b
        where b.id = i.blood_bank_institution_id and b.institution_type = 'blood_bank' and b.verified)
    order by i.valid_until, i.created_at
    for update of i
  loop
    reserved := least(remaining, greatest(0, row.units_available - row.already_reserved));
    if reserved > 0 then
      insert into public.stock_reservations(request_id, inventory_id, units_reserved)
      values (r.id, row.id, reserved) on conflict (request_id, inventory_id) do nothing;
      available_units := available_units + reserved;
      remaining := remaining - reserved;
    end if;
    exit when remaining = 0;
  end loop;

  update public.emergency_blood_requests set
    verified_stock_units = available_units,
    shortfall_units = greatest(0, r.units_requested - available_units),
    status = case when available_units >= r.units_requested then 'stock_available'::public.request_status
                  else 'searching_for_donors'::public.request_status end
  where id = r.id;
  return jsonb_build_object('request_id', r.id, 'verified_stock_units', available_units,
    'shortfall_units', greatest(0, r.units_requested - available_units),
    'status', case when available_units >= r.units_requested then 'stock_available' else 'searching_for_donors' end,
    'synthetic', false);
end;
$$;

create or replace function public.notify_next_donor(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r public.emergency_blood_requests; matched record; notice_id uuid;
begin
  select * into r from public.emergency_blood_requests where id = p_request_id;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if not public.has_institution_role(r.hospital_institution_id, array['hospital_admin','hospital_staff','collection_coordinator'])
     and not public.is_platform_admin() then raise exception 'verified hospital access is required' using errcode = '42501'; end if;
  if r.status not in ('searching_for_donors', 'donor_contacted') or coalesce(r.shortfall_units, 0) < 1 then
    raise exception 'request is not in donor-search status' using errcode = '22023';
  end if;
  if exists (select 1 from public.donor_request_notifications n
    where n.request_id = r.id and n.status = 'contacted') then
    return jsonb_build_object('contacted', false, 'message', 'Waiting for the current donor response.', 'synthetic', false);
  end if;
  -- Notify only one candidate per call. Exact group-label equality is a
  -- coordination filter, not compatibility or donor eligibility confirmation.
  select d.user_id, d.approximate_area into matched
  from public.donor_profiles d
  where d.blood_group = r.blood_group and d.city = r.location_city
    and d.availability = 'available' and d.consent_receive_requests
    and not exists (select 1 from public.donor_request_notifications n
      where n.request_id = r.id and n.donor_user_id = d.user_id)
  order by (d.approximate_area <> r.approximate_area), d.updated_at, d.user_id
  limit 1;
  if not found then
    return jsonb_build_object('contacted', false, 'message', 'No additional consented candidate is available.', 'synthetic', false);
  end if;
  insert into public.donor_request_notifications(request_id, donor_user_id, suggestion_reason)
  values (r.id, matched.user_id,
    'Configured blood-group label matches; approximate city/area ordering; self-reported availability and outreach consent. No medical eligibility is implied.')
  on conflict (request_id, donor_user_id) do nothing
  returning id into notice_id;
  if notice_id is null then
    return jsonb_build_object('contacted', false, 'message', 'Duplicate notification prevented.', 'synthetic', false);
  end if;
  update public.emergency_blood_requests set status = 'donor_contacted' where id = r.id;
  return jsonb_build_object('contacted', true, 'notification_id', notice_id, 'area', matched.approximate_area,
    'contact_details_shared', false, 'synthetic', false);
end;
$$;

create or replace function public.respond_to_donor_request(p_notification_id uuid, p_response text)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare n public.donor_request_notifications; r public.emergency_blood_requests;
begin
  if p_response not in ('accepted', 'declined') then raise exception 'response must be accepted or declined' using errcode = '22023'; end if;
  select * into n from public.donor_request_notifications where id = p_notification_id for update;
  if not found or n.donor_user_id <> auth.uid() then raise exception 'request notification not found' using errcode = '42501'; end if;
  if n.status <> 'contacted' then raise exception 'notification already has a response' using errcode = '22023'; end if;
  update public.donor_request_notifications set status = p_response::public.donor_notification_status,
    responded_at = now() where id = n.id;
  insert into public.donor_responses(notification_id, donor_user_id, response)
  values (n.id, auth.uid(), p_response);
  if p_response = 'accepted' then
    update public.emergency_blood_requests set status = 'donor_accepted'
      where id = n.request_id and status in ('donor_contacted', 'searching_for_donors');
  end if;
  select * into r from public.emergency_blood_requests where id = n.request_id;
  return jsonb_build_object('request_id', n.request_id, 'response', p_response, 'request_status', r.status);
end;
$$;

create or replace function public.advance_emergency_request(p_request_id uuid, p_status text, p_note text default null)
returns public.emergency_blood_requests language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r public.emergency_blood_requests; new_status public.request_status; roles text[]; permitted boolean; stock_row record;
begin
  begin new_status := p_status::public.request_status;
  exception when invalid_text_representation then raise exception 'unknown request status' using errcode = '22023'; end;
  select * into r from public.emergency_blood_requests where id = p_request_id for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if new_status = 'cancelled' then
    roles := array['hospital_admin','hospital_staff','collection_coordinator'];
  elsif new_status in ('at_authorized_blood_centre','testing_and_compatibility_checks','ready_for_dispatch','dispatched') then
    roles := array['blood_bank_staff','collection_coordinator'];
  elsif new_status in ('received_by_hospital','completed') then
    roles := array['hospital_admin','hospital_staff','collection_coordinator'];
  elsif new_status = 'collection_arranged' then
    roles := array['hospital_admin','hospital_staff','collection_coordinator'];
  else
    raise exception 'this status can only be changed by the inventory or donor workflow' using errcode = '42501';
  end if;
  if r.status in ('completed','cancelled') then raise exception 'request is already closed' using errcode = '22023'; end if;
  permitted :=
    (new_status = 'cancelled' and r.status not in ('completed','cancelled'))
    or (new_status = 'collection_arranged' and r.status = 'donor_accepted')
    or (new_status = 'testing_and_compatibility_checks' and r.status in ('at_authorized_blood_centre','stock_available'))
    or (new_status = 'ready_for_dispatch' and r.status = 'testing_and_compatibility_checks')
    or (new_status = 'dispatched' and r.status = 'ready_for_dispatch')
    or (new_status = 'received_by_hospital' and r.status = 'dispatched')
    or (new_status = 'completed' and r.status = 'received_by_hospital');
  if not permitted then raise exception 'status transition is not allowed from % to %', r.status, new_status using errcode = '22023'; end if;
  if new_status = 'ready_for_dispatch'
     and coalesce(r.verified_stock_units, 0) + coalesce((
       select sum(a.confirmed_units) from public.collection_appointments a
       where a.request_id = r.id and a.status = 'reviewed'
     ), 0) < r.units_requested then
    raise exception 'authorized centre-confirmed units plus verified stock do not cover the request quantity' using errcode = '22023';
  end if;
  if not public.has_institution_role(r.hospital_institution_id, roles)
     and not public.is_platform_admin()
     and not exists (
       select 1 from public.stock_reservations s
       join public.verified_component_inventory i on i.id = s.inventory_id
       where s.request_id = r.id and public.has_institution_role(i.blood_bank_institution_id, roles)
     )
     and not exists (
       select 1 from public.collection_appointments a
       where a.request_id = r.id and public.has_institution_role(a.collection_centre_id, roles)
     ) then
    raise exception 'authorized staff access is required for this status' using errcode = '42501';
  end if;
  if new_status = 'dispatched' and not public.is_platform_admin() and not exists (
    select 1 from public.transport_assignments t
    where t.request_id = r.id and t.status = 'assigned'
      and public.has_institution_role(t.institution_id, array['blood_bank_staff','collection_coordinator'])
  ) then
    raise exception 'only staff at the assigned transport institution can confirm dispatch' using errcode = '42501';
  end if;
  if new_status = 'at_authorized_blood_centre' and not exists (
    select 1 from public.collection_appointments a where a.request_id = r.id and a.status = 'confirmed'
  ) then
    raise exception 'a confirmed licensed-centre appointment is required' using errcode = '22023';
  end if;
  if new_status = 'testing_and_compatibility_checks' and r.status = 'at_authorized_blood_centre' and not exists (
    select 1 from public.collection_appointments a where a.request_id = r.id and a.status = 'attended'
  ) then
    raise exception 'authorized collection-centre attendance must be recorded first' using errcode = '22023';
  end if;
  if new_status = 'dispatched' and not exists (
    select 1 from public.transport_assignments t where t.request_id = r.id and t.status = 'assigned'
  ) then
    raise exception 'confirmed transport assignment is required before dispatch' using errcode = '22023';
  end if;
  update public.emergency_blood_requests set status = new_status where id = r.id returning * into r;
  if new_status = 'dispatched' then
    update public.transport_assignments set status = 'dispatched' where request_id = r.id and status = 'assigned';
  elsif new_status = 'received_by_hospital' then
    update public.transport_assignments set status = 'received' where request_id = r.id and status = 'dispatched';
  elsif new_status = 'completed' then
    -- Verified stock is consumed only after the hospital confirms receipt and
    -- an authorized user completes the request. A reservation is not a unit
    -- permanently removed from inventory before this point.
    for stock_row in
      select s.id as reservation_id, s.inventory_id, s.units_reserved
      from public.stock_reservations s
      where s.request_id = r.id and s.released_at is null
      for update
    loop
      update public.verified_component_inventory
        set units_available = units_available - stock_row.units_reserved
        where id = stock_row.inventory_id and units_available >= stock_row.units_reserved;
      if not found then
        raise exception 'reserved stock is no longer available; request completion was not recorded' using errcode = '22023';
      end if;
      update public.stock_reservations set released_at = now() where id = stock_row.reservation_id;
    end loop;
  end if;
  if p_note is not null then
    with latest_event as (
      select id from public.request_status_history where request_id = r.id order by recorded_at desc limit 1
    )
    update public.request_status_history set note = left(p_note, 500)
      where id = (select id from latest_event);
  end if;
  if new_status = 'cancelled' then
    update public.stock_reservations set released_at = now() where request_id = r.id and released_at is null;
    update public.donor_request_notifications set status = 'withdrawn', responded_at = now()
      where request_id = r.id and status = 'contacted';
    update public.collection_appointments set status = 'cancelled'
      where request_id = r.id and status in ('proposed','confirmed');
    update public.authorized_collection_teams set assignment_status = 'available', assigned_request_id = null, assigned_by = null
      where assigned_request_id = r.id and assignment_status = 'assigned';
  elsif new_status = 'completed' then
    update public.authorized_collection_teams set assignment_status = 'available', assigned_request_id = null, assigned_by = null
      where assigned_request_id = r.id and assignment_status = 'assigned';
  end if;
  return r;
end;
$$;

create or replace function public.record_collection_release(p_appointment_id uuid, p_units integer)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare a public.collection_appointments; r public.emergency_blood_requests; total_confirmed integer; remaining integer;
begin
  select * into a from public.collection_appointments where id = p_appointment_id for update;
  if not found then raise exception 'appointment not found' using errcode = 'P0002'; end if;
  select * into r from public.emergency_blood_requests where id = a.request_id for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if not public.has_institution_role(a.collection_centre_id, array['blood_bank_staff','collection_coordinator'])
     and not public.is_platform_admin() then
    raise exception 'authorized collection-centre staff access is required' using errcode = '42501';
  end if;
  if a.status <> 'attended' or r.status <> 'testing_and_compatibility_checks' then
    raise exception 'confirmed donor attendance and the authorized testing-status step are required' using errcode = '22023';
  end if;
  if p_units is null or p_units < 0 or p_units > coalesce(r.shortfall_units, 0) then
    raise exception 'confirmed units must be a whole number from zero through the current shortfall' using errcode = '22023';
  end if;

  -- This is an explicit staff attestation that the centre has confirmed units
  -- for release after its own collection, screening, testing and review. The
  -- application does not decide eligibility or infer a successful test.
  update public.collection_appointments set status = 'reviewed', confirmed_units = p_units,
    confirmed_by = auth.uid() where id = a.id returning * into a;
  select coalesce(r.verified_stock_units, 0) + coalesce(sum(c.confirmed_units), 0)::integer
    into total_confirmed
    from public.collection_appointments c
    where c.request_id = r.id and c.status = 'reviewed';
  remaining := greatest(0, r.units_requested - total_confirmed);
  update public.emergency_blood_requests set shortfall_units = remaining,
    status = case when remaining > 0 then 'searching_for_donors'::public.request_status
                  else 'testing_and_compatibility_checks'::public.request_status end
    where id = r.id returning * into r;
  return jsonb_build_object('appointment_id', a.id, 'confirmed_units', a.confirmed_units,
    'total_confirmed_units', total_confirmed, 'shortfall_units', remaining,
    'request_status', r.status, 'synthetic', false);
end;
$$;

drop function if exists public.confirm_collection_at_centre(uuid);
create function public.confirm_collection_at_centre(p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare a public.collection_appointments; result public.collection_appointments;
begin
  select * into a from public.collection_appointments where id = p_appointment_id for update;
  if not found then raise exception 'appointment not found' using errcode = 'P0002'; end if;
  if a.status <> 'confirmed' then raise exception 'donor-confirmed appointment is required' using errcode = '22023'; end if;
  if not public.has_institution_role(a.collection_centre_id, array['blood_bank_staff','collection_coordinator'])
     and not public.is_platform_admin() then raise exception 'authorized collection-centre staff access is required' using errcode = '42501'; end if;
  update public.collection_appointments set status = 'attended', confirmed_by = auth.uid()
    where id = a.id returning * into result;
  update public.emergency_blood_requests set status = 'at_authorized_blood_centre'
    where id = a.request_id and status = 'collection_arranged';
  return jsonb_build_object('appointment_id', result.id, 'request_id', result.request_id,
    'status', result.status, 'confirmed_at', result.updated_at);
end;
$$;

drop function if exists public.propose_collection_appointment(uuid,text,timestamptz);
create or replace function public.propose_collection_appointment(
  p_request_id uuid, p_collection_centre_id text, p_scheduled_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r public.emergency_blood_requests; donor uuid; result public.collection_appointments;
begin
  select * into r from public.emergency_blood_requests where id = p_request_id for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if not public.has_institution_role(r.hospital_institution_id, array['hospital_admin','hospital_staff','collection_coordinator'])
     and not public.is_platform_admin() then raise exception 'verified hospital access is required' using errcode = '42501'; end if;
  if r.status <> 'donor_accepted' then raise exception 'appointment requires an accepted donor response' using errcode = '22023'; end if;
  if p_scheduled_at <= now() then raise exception 'appointment must be scheduled in the future' using errcode = '22023'; end if;
  if not exists (select 1 from public.authorized_institutions i where i.id = p_collection_centre_id
    and i.institution_type = 'licensed_collection_centre' and i.verified) then
    raise exception 'collection centre is not verified' using errcode = '42501';
  end if;
  if exists (select 1 from public.collection_appointments a
    where a.request_id = r.id and a.status in ('proposed','confirmed','attended')) then
    raise exception 'an active collection appointment already exists' using errcode = '22023';
  end if;
  select n.donor_user_id into donor from public.donor_request_notifications n
    where n.request_id = r.id and n.status = 'accepted' order by n.responded_at desc limit 1;
  if donor is null then raise exception 'accepted donor response not found' using errcode = '22023'; end if;
  insert into public.collection_appointments(request_id, donor_user_id, collection_centre_id, scheduled_at)
    values (r.id, donor, p_collection_centre_id, p_scheduled_at) returning * into result;
  update public.emergency_blood_requests set status = 'collection_arranged' where id = r.id;
  return jsonb_build_object('appointment_id', result.id, 'request_id', result.request_id,
    'collection_centre_id', result.collection_centre_id, 'scheduled_at', result.scheduled_at,
    'status', result.status);
end;
$$;

drop function if exists public.respond_to_collection_appointment(uuid,boolean);
create or replace function public.respond_to_collection_appointment(p_appointment_id uuid, p_confirm boolean)
returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare appointment public.collection_appointments; result public.collection_appointments;
begin
  select * into appointment from public.collection_appointments where id = p_appointment_id for update;
  if not found or appointment.donor_user_id <> auth.uid() then raise exception 'appointment not found' using errcode = '42501'; end if;
  if appointment.status <> 'proposed' then raise exception 'appointment already has a response' using errcode = '22023'; end if;
  update public.collection_appointments set status = case when p_confirm then 'confirmed' else 'cancelled' end,
    confirmed_by = auth.uid()
    where id = appointment.id returning * into result;
  -- A declined proposal must not strand the request in collection_arranged.
  -- Returning to donor_accepted lets verified hospital staff propose another
  -- visit with the same consenting donor without creating duplicate notices.
  if not p_confirm then
    update public.emergency_blood_requests set status = 'donor_accepted'
      where id = appointment.request_id and status = 'collection_arranged';
  end if;
  return jsonb_build_object('appointment_id', result.id, 'request_id', result.request_id,
    'scheduled_at', result.scheduled_at, 'status', result.status);
end;
$$;

create or replace function public.assign_request_transport(
  p_request_id uuid, p_institution_id text, p_estimated_arrival timestamptz default null,
  p_assignment_reference text default null
) returns public.transport_assignments
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r public.emergency_blood_requests; result public.transport_assignments;
begin
  select * into r from public.emergency_blood_requests where id = p_request_id for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if r.status <> 'ready_for_dispatch' then raise exception 'transport can be assigned only when ready for dispatch' using errcode = '22023'; end if;
  if not public.has_institution_role(r.hospital_institution_id, array['collection_coordinator'])
     and not public.is_platform_admin() then raise exception 'verified coordinator access is required' using errcode = '42501'; end if;
  if not public.has_institution_role(p_institution_id, array['blood_bank_staff','collection_coordinator'])
     and not public.is_platform_admin() then raise exception 'verified transport institution staff access is required' using errcode = '42501'; end if;
  if p_estimated_arrival is not null and p_estimated_arrival <= now() then
    raise exception 'estimated arrival must be in the future' using errcode = '22023';
  end if;
  if not exists (select 1 from public.authorized_institutions i where i.id = p_institution_id
    and i.institution_type = 'blood_bank' and i.verified) then raise exception 'transport institution is not verified' using errcode = '42501'; end if;
  if not exists (select 1 from public.blood_bank_access a
    where a.hospital_institution_id = r.hospital_institution_id
      and a.blood_bank_institution_id = p_institution_id and a.verified) then
    raise exception 'transport institution is not an authorized partner for this hospital' using errcode = '42501';
  end if;
  insert into public.transport_assignments(request_id, institution_id, assigned_by, estimated_arrival, assignment_reference)
    values (r.id, p_institution_id, auth.uid(), p_estimated_arrival, nullif(trim(p_assignment_reference), ''))
    returning * into result;
  return result;
end;
$$;

create or replace function public.assign_authorized_collection_team(p_request_id uuid, p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r public.emergency_blood_requests; team public.authorized_collection_teams;
begin
  select * into r from public.emergency_blood_requests where id = p_request_id for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if r.status <> 'collection_arranged' then raise exception 'team assignment requires a scheduled collection visit' using errcode = '22023'; end if;
  select * into team from public.authorized_collection_teams where id = p_team_id for update;
  if not found or team.assignment_status <> 'available' then raise exception 'collection team is not available' using errcode = '22023'; end if;
  if not exists (select 1 from public.authorized_institutions i
    where i.id = team.institution_id and i.institution_type = 'licensed_collection_centre' and i.verified)
    then raise exception 'team must belong to a verified licensed collection centre' using errcode = '42501'; end if;
  if not public.has_institution_role(team.institution_id, array['blood_bank_staff','collection_coordinator'])
    and not public.is_platform_admin() then raise exception 'authorized collection-centre staff access is required' using errcode = '42501'; end if;
  if not exists (select 1 from public.collection_appointments a
    where a.request_id = r.id and a.collection_centre_id = team.institution_id and a.status = 'confirmed')
    then raise exception 'the donor must confirm an appointment at this centre first' using errcode = '22023'; end if;
  update public.authorized_collection_teams set assignment_status = 'assigned',
    assigned_request_id = r.id, assigned_by = auth.uid()
    where id = team.id;
  return jsonb_build_object('team_id', team.id, 'request_id', r.id,
    'institution_id', team.institution_id, 'status', 'assigned');
end;
$$;

create or replace function public.is_request_institution_member(p_request_id uuid)
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select public.is_platform_admin() or exists (
    select 1 from public.emergency_blood_requests r where r.id = p_request_id
    and (
      public.has_institution_role(r.hospital_institution_id, array['hospital_admin','hospital_staff','collection_coordinator'])
      or exists (select 1 from public.stock_reservations s join public.verified_component_inventory i on i.id = s.inventory_id
        where s.request_id = r.id and public.has_institution_role(i.blood_bank_institution_id, array['blood_bank_staff','collection_coordinator']))
      or exists (select 1 from public.collection_appointments a
        where a.request_id = r.id and public.has_institution_role(a.collection_centre_id, array['blood_bank_staff','collection_coordinator']))
    )
  );
$$;

-- Supabase grants function execution to PUBLIC by default. Remove that
-- default explicitly; the authenticated role receives only the RPC grants at
-- the bottom of this migration.
revoke all on function public.set_updated_at() from public, anon;
revoke all on function public.has_institution_role(text, text[]) from public, anon;
revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.get_coordination_dashboard() from public, anon;
revoke all on function public.is_request_participant(uuid) from public, anon;
revoke all on function public.may_view_donor_contact(uuid) from public, anon;
revoke all on function public.audit_donor_consent() from public, anon;
revoke all on function public.withdraw_open_donor_notifications() from public, anon;
revoke all on function public.audit_request_status() from public, anon;
revoke all on function public.create_emergency_blood_request(text,text,text,integer,text,timestamptz,text,text,text,text,text,text) from public, anon;
revoke all on function public.verify_request_inventory(uuid) from public, anon;
revoke all on function public.notify_next_donor(uuid) from public, anon;
revoke all on function public.respond_to_donor_request(uuid,text) from public, anon;
revoke all on function public.advance_emergency_request(uuid,text,text) from public, anon;
revoke all on function public.confirm_collection_at_centre(uuid) from public, anon;
revoke all on function public.propose_collection_appointment(uuid,text,timestamptz) from public, anon;
revoke all on function public.respond_to_collection_appointment(uuid,boolean) from public, anon;
revoke all on function public.assign_request_transport(uuid,text,timestamptz,text) from public, anon;
revoke all on function public.assign_authorized_collection_team(uuid,uuid) from public, anon;
revoke all on function public.is_request_institution_member(uuid) from public, anon;

-- Row-level security is enabled on every table that may contain private data.
alter table public.authorized_institutions enable row level security;
alter table public.institution_memberships enable row level security;
alter table public.donor_profiles enable row level security;
alter table public.donor_consent_events enable row level security;
alter table public.blood_bank_access enable row level security;
alter table public.verified_component_inventory enable row level security;
alter table public.emergency_blood_requests enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.donor_request_notifications enable row level security;
alter table public.donor_responses enable row level security;
alter table public.collection_appointments enable row level security;
alter table public.authorized_collection_teams enable row level security;
alter table public.transport_assignments enable row level security;
alter table public.request_status_history enable row level security;

drop policy if exists institution_list_authenticated on public.authorized_institutions;
create policy institution_list_authenticated on public.authorized_institutions
  for select to authenticated using (verified or public.is_platform_admin());
drop policy if exists membership_read_self_or_admin on public.institution_memberships;
create policy membership_read_self_or_admin on public.institution_memberships
  for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
drop policy if exists donor_profile_read_self_or_authorized on public.donor_profiles;
create policy donor_profile_read_self_or_authorized on public.donor_profiles
  for select to authenticated using (user_id = auth.uid() or public.may_view_donor_contact(user_id));
drop policy if exists donor_profile_insert_self on public.donor_profiles;
create policy donor_profile_insert_self on public.donor_profiles
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists donor_profile_update_self on public.donor_profiles;
create policy donor_profile_update_self on public.donor_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists donor_consent_read_self on public.donor_consent_events;
create policy donor_consent_read_self on public.donor_consent_events
  for select to authenticated using (donor_user_id = auth.uid() or public.is_platform_admin());
drop policy if exists blood_bank_access_read_member on public.blood_bank_access;
create policy blood_bank_access_read_member on public.blood_bank_access
  for select to authenticated using (
    public.has_institution_role(hospital_institution_id, array['hospital_admin','hospital_staff'])
    or public.has_institution_role(blood_bank_institution_id, array['blood_bank_staff'])
    or public.is_platform_admin()
  );
drop policy if exists inventory_read_bank_staff on public.verified_component_inventory;
create policy inventory_read_bank_staff on public.verified_component_inventory
  for select to authenticated using (
    public.has_institution_role(blood_bank_institution_id, array['blood_bank_staff'])
    or public.is_platform_admin()
  );
drop policy if exists inventory_write_bank_staff on public.verified_component_inventory;
create policy inventory_write_bank_staff on public.verified_component_inventory
  for all to authenticated using (
    public.has_institution_role(blood_bank_institution_id, array['blood_bank_staff'])
    or public.is_platform_admin()
  ) with check (
    (public.has_institution_role(blood_bank_institution_id, array['blood_bank_staff'])
      and verified_by = auth.uid())
    or public.is_platform_admin()
  );
drop policy if exists emergency_request_read_participant on public.emergency_blood_requests;
create policy emergency_request_read_participant on public.emergency_blood_requests
  for select to authenticated using (
    public.is_request_institution_member(id)
    or public.is_request_participant(id) or public.is_platform_admin()
  );
drop policy if exists donor_notification_read_owner_or_hospital on public.donor_request_notifications;
create policy donor_notification_read_owner_or_hospital on public.donor_request_notifications
  for select to authenticated using (
    donor_user_id = auth.uid()
    or exists (select 1 from public.emergency_blood_requests r where r.id = request_id
      and public.has_institution_role(r.hospital_institution_id, array['hospital_admin','hospital_staff','collection_coordinator']))
    or public.is_platform_admin()
  );
drop policy if exists donor_response_read_owner_or_staff on public.donor_responses;
create policy donor_response_read_owner_or_staff on public.donor_responses
  for select to authenticated using (
    donor_user_id = auth.uid()
    or exists (select 1 from public.donor_request_notifications n join public.emergency_blood_requests r on r.id = n.request_id
      where n.id = notification_id and public.has_institution_role(r.hospital_institution_id, array['hospital_admin','hospital_staff','collection_coordinator']))
    or public.is_platform_admin()
  );
drop policy if exists appointment_read_participant on public.collection_appointments;
create policy appointment_read_participant on public.collection_appointments
  for select to authenticated using (
    donor_user_id = auth.uid() or public.is_request_institution_member(request_id)
  );
drop policy if exists appointment_write_authorized_staff on public.collection_appointments;
create policy appointment_write_authorized_staff on public.collection_appointments
  for all to authenticated using (public.is_request_institution_member(request_id))
  with check (public.is_request_institution_member(request_id));
drop policy if exists collection_team_staff_only on public.authorized_collection_teams;
create policy collection_team_staff_only on public.authorized_collection_teams
  for all to authenticated using (
    public.has_institution_role(institution_id, array['blood_bank_staff','collection_coordinator']) or public.is_platform_admin()
  ) with check (
    public.has_institution_role(institution_id, array['blood_bank_staff','collection_coordinator']) or public.is_platform_admin()
  );
drop policy if exists transport_read_participant on public.transport_assignments;
create policy transport_read_participant on public.transport_assignments
  for select to authenticated using (public.is_request_institution_member(request_id));
drop policy if exists transport_write_staff on public.transport_assignments;
create policy transport_write_staff on public.transport_assignments
  for all to authenticated using (public.is_request_institution_member(request_id))
  with check (public.is_request_institution_member(request_id));
drop policy if exists request_history_read_participant on public.request_status_history;
create policy request_history_read_participant on public.request_status_history
  for select to authenticated using (public.is_request_participant(request_id) or public.is_request_institution_member(request_id));

-- Authenticated clients use only owner/role-checked policies and RPCs. They do
-- not receive a service-role key. Sensitive writes are not granted directly.
revoke all on public.authorized_institutions, public.institution_memberships,
  public.donor_profiles, public.donor_consent_events, public.blood_bank_access,
  public.verified_component_inventory, public.emergency_blood_requests,
  public.stock_reservations, public.donor_request_notifications,
  public.donor_responses, public.collection_appointments,
  public.authorized_collection_teams, public.transport_assignments,
  public.request_status_history from public, anon, authenticated;
grant select on public.authorized_institutions, public.institution_memberships,
  public.donor_profiles, public.donor_consent_events, public.blood_bank_access,
  public.verified_component_inventory, public.authorized_collection_teams,
  public.transport_assignments to authenticated;
grant select (id, request_id, suggestion_reason, status, contacted_at, responded_at, created_at)
  on public.donor_request_notifications to authenticated;
grant select (id, request_id, collection_centre_id, scheduled_at, status, confirmed_units, created_at, updated_at)
  on public.collection_appointments to authenticated;
grant select (id, request_id, from_status, to_status, recorded_at, note)
  on public.request_status_history to authenticated;
grant select (id, request_code, hospital_institution_id, blood_group, component,
  units_requested, urgency, required_by, location_city, approximate_area, status,
  verified_stock_units, shortfall_units, created_at, updated_at)
  on public.emergency_blood_requests to authenticated;
grant insert, update on public.donor_profiles to authenticated;
grant insert, update on public.verified_component_inventory to authenticated;
grant execute on function public.has_institution_role(text, text[]) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.get_coordination_dashboard() to authenticated;
grant execute on function public.is_request_participant(uuid) to authenticated;
grant execute on function public.may_view_donor_contact(uuid) to authenticated;
grant execute on function public.create_emergency_blood_request(text,text,text,integer,text,timestamptz,text,text,text,text,text,text) to authenticated;
grant execute on function public.verify_request_inventory(uuid) to authenticated;
grant execute on function public.notify_next_donor(uuid) to authenticated;
grant execute on function public.respond_to_donor_request(uuid,text) to authenticated;
grant execute on function public.advance_emergency_request(uuid,text,text) to authenticated;
grant execute on function public.propose_collection_appointment(uuid,text,timestamptz) to authenticated;
grant execute on function public.respond_to_collection_appointment(uuid,boolean) to authenticated;
grant execute on function public.confirm_collection_at_centre(uuid) to authenticated;
grant execute on function public.record_collection_release(uuid,integer) to authenticated;
grant execute on function public.assign_request_transport(uuid,text,timestamptz,text) to authenticated;
grant execute on function public.assign_authorized_collection_team(uuid,uuid) to authenticated;
grant execute on function public.is_request_institution_member(uuid) to authenticated;

comment on table public.donor_profiles is 'Private volunteer coordination profile; not a clinical eligibility record.';
comment on column public.donor_profiles.approximate_area is 'Coarse area only. Never store a home address or precise GPS here.';
comment on table public.verified_component_inventory is 'Component-specific stock entered and verified by authorized blood-bank staff; not populated from the aggregate research JSON.';
comment on function public.notify_next_donor(uuid) is 'Creates one in-app notification per call for an exact label/area suggestion; not medical compatibility or eligibility.';
comment on function public.record_collection_release(uuid,integer) is 'Authorized centre staff attest to units confirmed for release after their independent procedures; donor acceptance is never inventory.';
