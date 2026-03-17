-- AI-generated doctor visit preparation summaries
create table public.doctor_visit_preps (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  summary text not null,
  raw_response text,
  created_at timestamptz not null default now()
);

create index doctor_visit_preps_patient on public.doctor_visit_preps (patient_id, created_at desc);

alter table public.doctor_visit_preps enable row level security;

create policy "Prep readable by linked users"
  on public.doctor_visit_preps for select to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Prep insertable by linked users"
  on public.doctor_visit_preps for insert to authenticated
  with check (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Prep deletable by linked users"
  on public.doctor_visit_preps for delete to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));
