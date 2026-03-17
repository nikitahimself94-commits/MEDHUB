-- Diary entries: daily wellbeing log for a patient
create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  wellbeing_score int not null check (wellbeing_score between 1 and 10),
  symptoms text[] not null default '{}',
  pain_location text,
  pain_score int check (pain_score is null or pain_score between 1 and 10),
  sleep_hours numeric(3,1) check (sleep_hours is null or sleep_hours between 0 and 24),
  sleep_quality int check (sleep_quality is null or sleep_quality between 1 and 5),
  notes text,
  tags text[] not null default '{}'
);

create index diary_entries_patient_created on public.diary_entries (patient_id, created_at desc);

alter table public.diary_entries enable row level security;

create policy "Diary entries readable by linked users"
  on public.diary_entries for select
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

create policy "Diary entries insertable by linked users"
  on public.diary_entries for insert
  to authenticated
  with check (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );
