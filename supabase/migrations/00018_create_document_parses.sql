-- AI-parsed results for medical documents
create table public.document_parses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doc_type text,
  doc_date text,
  lab_or_clinic text,
  key_findings jsonb not null default '[]'::jsonb,
  summary text,
  raw_response text,
  created_at timestamptz not null default now()
);

create unique index document_parses_doc_id on public.document_parses (document_id);
create index document_parses_patient on public.document_parses (patient_id);

alter table public.document_parses enable row level security;

create policy "Parse readable by linked users"
  on public.document_parses for select to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Parse insertable by linked users"
  on public.document_parses for insert to authenticated
  with check (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Parse updatable by linked users"
  on public.document_parses for update to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Parse deletable by linked users"
  on public.document_parses for delete to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));
