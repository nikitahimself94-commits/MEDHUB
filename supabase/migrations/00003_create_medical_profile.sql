-- Medical profile: core patient health data (one per patient)
create table public.medical_profile (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  blood_type text,
  rh_factor text,
  allergies jsonb not null default '[]'::jsonb,
  chronic_conditions jsonb not null default '[]'::jsonb,
  emergency_info text,
  updated_at timestamptz not null default now()
);

alter table public.medical_profile enable row level security;

-- Select: any authenticated user linked to patient
create policy "Medical profile readable by linked users"
  on public.medical_profile for select
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

-- Insert: any authenticated user linked to patient
create policy "Medical profile insertable by linked users"
  on public.medical_profile for insert
  to authenticated
  with check (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

-- Update: any authenticated user linked to patient
create policy "Medical profile updatable by linked users"
  on public.medical_profile for update
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );
