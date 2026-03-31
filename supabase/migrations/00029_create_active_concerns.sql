-- Active concerns: one per patient, the current focus of observation
create table public.active_concerns (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null,
  key_question text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active concern per patient (MVP constraint)
create unique index active_concerns_patient_unique on public.active_concerns (patient_id);

alter table public.active_concerns enable row level security;

create policy "Active concerns readable by linked users"
  on public.active_concerns for select
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

create policy "Active concerns insertable by linked users"
  on public.active_concerns for insert
  to authenticated
  with check (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

create policy "Active concerns updatable by linked users"
  on public.active_concerns for update
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

create policy "Active concerns deletable by linked users"
  on public.active_concerns for delete
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );
