-- Restrict new writes without deleting or relabeling existing private records.
-- NOT VALID retains historical rows; new inserts and updates enforce the scope.
begin;
alter table public.donor_profiles add constraint donor_profiles_positive_group
  check (blood_group in ('A+', 'B+', 'AB+', 'O+')) not valid;
alter table public.verified_component_inventory add constraint inventory_positive_group
  check (blood_group in ('A+', 'B+', 'AB+', 'O+')) not valid;
alter table public.emergency_blood_requests add constraint emergency_positive_group
  check (blood_group in ('A+', 'B+', 'AB+', 'O+')) not valid;
commit;
