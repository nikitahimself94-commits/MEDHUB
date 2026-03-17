create table public.medication_intakes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  medication_id uuid not null references public.medications(id) on delete cascade,
  taken_at timestamptz not null default now()
);

create index idx_medication_intakes_patient_date
  on public.medication_intakes (patient_id, taken_at);

alter table public.medication_intakes enable row level security;

create policy "Intakes viewable by linked users"
  on public.medication_intakes for select to authenticated
  using (patient_id in (
    select patient_id from public.profiles where user_id = auth.uid()
  ));

create policy "Intakes insertable by linked users"
  on public.medication_intakes for insert to authenticated
  with check (patient_id in (
    select patient_id from public.profiles where user_id = auth.uid()
  ));
