-- Timeline events: хронологическая лента ключевых медицинских событий
create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_date date not null,
  title text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index timeline_events_patient_date on public.timeline_events (patient_id, event_date desc);

alter table public.timeline_events enable row level security;

create policy "Timeline readable by linked users"
  on public.timeline_events for select to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Timeline insertable by linked users"
  on public.timeline_events for insert to authenticated
  with check (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Timeline deletable by linked users"
  on public.timeline_events for delete to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));
