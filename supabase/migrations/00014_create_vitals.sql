-- Vitals: patient vital signs (BP, pulse, temperature, SpO2, weight, glucose)
create table public.vitals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  vital_type text not null,
  value text not null,
  unit text not null,
  measured_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index vitals_patient_date on public.vitals (patient_id, measured_at desc);

alter table public.vitals enable row level security;

create policy "Vitals readable by linked users"
  on public.vitals for select
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

create policy "Vitals insertable by linked users"
  on public.vitals for insert
  to authenticated
  with check (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

create policy "Vitals deletable by linked users"
  on public.vitals for delete
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );
