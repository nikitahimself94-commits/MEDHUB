-- Hypotheses: one per active concern, MVP hypothesis engine layer
create table public.hypotheses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  concern_id uuid not null references public.active_concerns(id) on delete cascade,
  statement text not null,
  status text not null,
  supporting jsonb not null default '[]'::jsonb,
  weakening jsonb not null default '[]'::jsonb,
  missing jsonb not null default '[]'::jsonb,
  next_step jsonb not null,
  contributing_domains text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One hypothesis per concern (MVP constraint)
create unique index hypotheses_concern_unique on public.hypotheses (concern_id);

-- Status must be one of MVP lifecycle states
alter table public.hypotheses
  add constraint hypotheses_status_check
  check (status in ('emerging', 'plausible', 'supported', 'weakened', 'unresolved'));

alter table public.hypotheses enable row level security;

create policy "Hypotheses readable by linked users"
  on public.hypotheses for select
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

create policy "Hypotheses insertable by linked users"
  on public.hypotheses for insert
  to authenticated
  with check (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

create policy "Hypotheses updatable by linked users"
  on public.hypotheses for update
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

create policy "Hypotheses deletable by linked users"
  on public.hypotheses for delete
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );
