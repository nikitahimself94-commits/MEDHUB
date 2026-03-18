-- Update trigger: auto-create patient record on signup and link to profile
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_patient_id uuid;
begin
  -- Create a patient record for this user
  insert into public.patients (display_name)
  values (coalesce(new.raw_user_meta_data->>'display_name', ''))
  returning id into new_patient_id;

  -- Create profile linked to patient
  insert into public.profiles (user_id, role, display_name, patient_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'patient'),
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    new_patient_id
  );
  return new;
end;
$$ language plpgsql security definer;

-- Also add INSERT policy on patients for service role operations
-- (trigger bypasses RLS via security definer, but direct inserts need this)
create policy "Patients insertable by authenticated users"
  on public.patients for insert
  to authenticated
  with check (true);

-- Add INSERT policy on profiles for authenticated users
-- (needed if we create profiles from server actions as fallback)
create policy "Profiles insertable by authenticated users"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);
