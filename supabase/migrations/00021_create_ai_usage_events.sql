-- AI usage tracking for cost control and future billing
create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  feature_name text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_events_patient on public.ai_usage_events (patient_id, created_at desc);
create index ai_usage_events_feature on public.ai_usage_events (feature_name, created_at desc);

alter table public.ai_usage_events enable row level security;

create policy "Usage readable by linked users"
  on public.ai_usage_events for select to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Usage insertable by linked users"
  on public.ai_usage_events for insert to authenticated
  with check (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Usage deletable by linked users"
  on public.ai_usage_events for delete to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));
