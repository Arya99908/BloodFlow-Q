-- Hosted-safe access-policy regression check for the private coordination
-- tables. Every fixture identity and contact value is fictional. The nested
-- PL/pgSQL exception block is a savepoint: the deliberate final exception
-- rolls the fixture rows back even when this file is run against a hosted
-- test project with `supabase db query --linked --file`.
--
-- For the normal local Supabase workflow, this remains a SQL test file and can
-- be run with `supabase test db` (which requires Docker).
do $$
declare
  check_count integer := 0;
  visible_rows integer;
  visible_phone text;
begin
  begin
    insert into auth.users (id, email)
    values
      ('10000000-0000-4000-8000-000000000001', 'donor-one@example.invalid'),
      ('10000000-0000-4000-8000-000000000002', 'donor-two@example.invalid'),
      ('20000000-0000-4000-8000-000000000001', 'hospital-one@example.invalid'),
      ('20000000-0000-4000-8000-000000000002', 'hospital-two@example.invalid');

    insert into public.authorized_institutions
      (id, institution_type, name, city, approximate_area, verified)
    values
      ('TEST-HOSPITAL-1', 'hospital', 'Synthetic Hospital One', 'Test City', 'Area One', true),
      ('TEST-HOSPITAL-2', 'hospital', 'Synthetic Hospital Two', 'Test City', 'Area Two', true);

    insert into public.institution_memberships (user_id, institution_id, role, verified)
    values
      ('20000000-0000-4000-8000-000000000001', 'TEST-HOSPITAL-1', 'hospital_staff', true),
      ('20000000-0000-4000-8000-000000000002', 'TEST-HOSPITAL-2', 'hospital_staff', true);

    insert into public.donor_profiles
      (user_id, full_name, blood_group, phone, city, approximate_area,
       availability, preferred_contact, consent_receive_requests, consent_share_contact)
    values
      ('10000000-0000-4000-8000-000000000001', 'Synthetic Donor One', 'O+', '5550101',
       'Test City', 'Area One', 'available', 'phone', true, false),
      ('10000000-0000-4000-8000-000000000002', 'Synthetic Donor Two', 'O+', '5550102',
       'Test City', 'Area Two', 'available', 'phone', true, false);

    insert into public.emergency_blood_requests
      (id, hospital_institution_id, blood_group, component, units_requested, urgency,
       required_by, location_city, approximate_area, representative_name,
       representative_phone, created_by)
    values
      ('30000000-0000-4000-8000-000000000001', 'TEST-HOSPITAL-1', 'O+',
       'red_blood_cells', 2, 'urgent', now() + interval '1 day', 'Test City',
       'Area One', 'Synthetic Contact', '5550199',
       '20000000-0000-4000-8000-000000000001');

    insert into public.donor_request_notifications
      (id, request_id, donor_user_id, suggestion_reason, status)
    values
      ('40000000-0000-4000-8000-000000000001',
       '30000000-0000-4000-8000-000000000001',
       '10000000-0000-4000-8000-000000000001', 'Synthetic area match', 'contacted');

    -- All 14 application tables must have row-level security switched on.
    if (select count(*) = 14
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = any(array[
            'authorized_institutions', 'institution_memberships', 'donor_profiles',
            'donor_consent_events', 'blood_bank_access', 'verified_component_inventory',
            'emergency_blood_requests', 'stock_reservations', 'donor_request_notifications',
            'donor_responses', 'collection_appointments', 'authorized_collection_teams',
            'transport_assignments', 'request_status_history'
          ]) and c.relrowsecurity) then
      check_count := check_count + 1;
    else raise exception 'RLS is not enabled on every coordination table'; end if;

    -- Anonymous visitors receive no private table reads or workflow RPCs.
    if not has_table_privilege('anon', 'public.donor_profiles', 'select')
       and not has_table_privilege('anon', 'public.emergency_blood_requests', 'select')
       and not has_table_privilege('anon', 'public.verified_component_inventory', 'select')
       and not has_table_privilege('anon', 'public.donor_request_notifications', 'select') then
      check_count := check_count + 1;
    else raise exception 'anon has an unexpected private table read grant'; end if;

    if not has_function_privilege('anon',
         'public.create_emergency_blood_request(text,text,text,integer,text,timestamp with time zone,text,text,text,text,text,text)',
         'execute')
       and not has_function_privilege('anon', 'public.notify_next_donor(uuid)', 'execute')
       and not has_function_privilege('anon', 'public.record_collection_release(uuid,integer)', 'execute') then
      check_count := check_count + 1;
    else raise exception 'anon can execute a private coordination RPC'; end if;

    if not has_function_privilege('authenticated', 'public.audit_donor_consent()', 'execute')
       and not has_function_privilege('authenticated', 'public.withdraw_open_donor_notifications()', 'execute')
       and not has_function_privilege('authenticated', 'public.audit_request_status()', 'execute') then
      check_count := check_count + 1;
    else raise exception 'authenticated can directly execute an internal trigger handler'; end if;

    if not has_column_privilege('authenticated', 'public.emergency_blood_requests', 'representative_phone', 'select')
       and not has_column_privilege('authenticated', 'public.emergency_blood_requests', 'representative_email', 'select')
       and not has_column_privilege('authenticated', 'public.donor_request_notifications', 'donor_user_id', 'select') then
      check_count := check_count + 1;
    else raise exception 'authenticated has an unexpected sensitive column grant'; end if;

    -- An actual anon-role query must fail, rather than merely return no rows.
    execute 'set local role anon';
    perform set_config('request.jwt.claim.sub', '', true);
    begin
      execute 'select full_name from public.donor_profiles';
      raise exception 'anon unexpectedly queried donor profiles';
    exception when insufficient_privilege then
      check_count := check_count + 1;
    end;
    execute 'reset role';

    -- A donor sees their own row and inbox, never another donor's private row.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
    select count(*) into visible_rows from public.donor_profiles;
    if visible_rows = 1 then check_count := check_count + 1;
    else raise exception 'donor does not see exactly their own profile'; end if;
    select count(*) into visible_rows from public.donor_profiles
      where user_id = '10000000-0000-4000-8000-000000000002';
    if visible_rows = 0 then check_count := check_count + 1;
    else raise exception 'donor can see another donor profile'; end if;
    select count(*) into visible_rows from public.donor_request_notifications;
    if visible_rows = 1 then check_count := check_count + 1;
    else raise exception 'donor inbox is not scoped to its owner'; end if;

    -- Verified hospital staff see their own request but cannot see donor contact
    -- before both acceptance and the donor's separate contact-sharing consent.
    perform set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
    select count(*) into visible_rows from public.emergency_blood_requests;
    if visible_rows = 1 then check_count := check_count + 1;
    else raise exception 'hospital staff cannot see their own request'; end if;
    select count(*) into visible_rows from public.donor_profiles
      where user_id = '10000000-0000-4000-8000-000000000001';
    if visible_rows = 0 then check_count := check_count + 1;
    else raise exception 'hospital can see donor contact before acceptance and consent'; end if;

    execute 'reset role';
    update public.donor_profiles set consent_share_contact = true
      where user_id = '10000000-0000-4000-8000-000000000001';
    update public.donor_request_notifications set status = 'accepted', responded_at = now()
      where id = '40000000-0000-4000-8000-000000000001';

    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
    select phone into visible_phone from public.donor_profiles
      where user_id = '10000000-0000-4000-8000-000000000001';
    if visible_phone = '5550101' then check_count := check_count + 1;
    else raise exception 'authorized hospital cannot see consented, accepted contact'; end if;

    -- Another verified hospital remains excluded, even after acceptance.
    perform set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
    select count(*) into visible_rows from public.donor_profiles
      where user_id = '10000000-0000-4000-8000-000000000001';
    if visible_rows = 0 then check_count := check_count + 1;
    else raise exception 'unrelated hospital can see donor contact'; end if;
    select count(*) into visible_rows from public.emergency_blood_requests;
    if visible_rows = 0 then check_count := check_count + 1;
    else raise exception 'hospital can see another hospital request'; end if;

    if check_count <> 14 then
      raise exception 'expected 14 policy checks, passed %', check_count;
    end if;
    raise exception using errcode = 'PZ001', message = 'ROLL BACK SYNTHETIC POLICY FIXTURES';
  exception when sqlstate 'PZ001' then
    if sqlerrm <> 'ROLL BACK SYNTHETIC POLICY FIXTURES' then raise; end if;
  end;
  raise notice 'PASS: % donor/emergency RLS and privilege checks; all synthetic fixtures rolled back', check_count;
end;
$$;
