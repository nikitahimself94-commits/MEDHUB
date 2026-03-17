-- Temporary read-only share links for doctor visits
create table public.doctor_share_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  token text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index doctor_share_links_token on public.doctor_share_links (token);
create index doctor_share_links_patient on public.doctor_share_links (patient_id, status);

alter table public.doctor_share_links enable row level security;

create policy "Share links readable by linked users"
  on public.doctor_share_links for select to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Share links insertable by linked users"
  on public.doctor_share_links for insert to authenticated
  with check (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Share links updatable by linked users"
  on public.doctor_share_links for update to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));
