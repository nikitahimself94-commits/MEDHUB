-- Emotion entries: дневник эмоций (5 параметров по шкале 1–5)
create table public.emotion_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  anxiety smallint not null check (anxiety between 1 and 5),
  depression smallint not null check (depression between 1 and 5),
  calmness smallint not null check (calmness between 1 and 5),
  fatigue smallint not null check (fatigue between 1 and 5),
  hope smallint not null check (hope between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create index emotion_entries_patient_date on public.emotion_entries (patient_id, created_at desc);

alter table public.emotion_entries enable row level security;

create policy "Emotions readable by linked users"
  on public.emotion_entries for select to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Emotions insertable by linked users"
  on public.emotion_entries for insert to authenticated
  with check (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Emotions deletable by linked users"
  on public.emotion_entries for delete to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));
