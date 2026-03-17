-- Medications: drug reference for a patient (active/inactive)
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  dosage text not null default '',
  schedule text not null default '',
  start_date date not null,
  end_date date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index medications_patient_active on public.medications (patient_id, active desc, created_at desc);

alter table public.medications enable row level security;

create policy "Medications readable by linked users"
  on public.medications for select
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

create policy "Medications insertable by linked users"
  on public.medications for insert
  to authenticated
  with check (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );
