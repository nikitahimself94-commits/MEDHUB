-- Central entity: the patient whose medical data is stored
-- All future product tables (diary, documents, medications, etc.) reference patient_id
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.patients enable row level security;

-- All authenticated users can read patients they are linked to via profiles
create policy "Patients readable by linked users"
  on public.patients for select
  to authenticated
  using (
    id in (select patient_id from public.profiles where user_id = auth.uid())
  );

-- All authenticated users linked to patient can update
create policy "Patients updatable by linked users"
  on public.patients for update
  to authenticated
  using (
    id in (select patient_id from public.profiles where user_id = auth.uid())
  );

-- Add patient_id to profiles: links auth user to a shared patient record
alter table public.profiles
  add column patient_id uuid references public.patients(id) on delete cascade;

-- Update trigger: new users get a profile without patient_id (must be linked manually)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, role, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'patient'),
    coalesce(new.raw_user_meta_data->>'display_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;
