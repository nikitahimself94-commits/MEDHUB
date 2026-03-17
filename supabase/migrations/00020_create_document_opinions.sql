-- AI second opinion for medical documents
create table public.document_opinions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  opinion text not null,
  raw_response text,
  created_at timestamptz not null default now()
);

create unique index document_opinions_doc_id on public.document_opinions (document_id);
create index document_opinions_patient on public.document_opinions (patient_id);

alter table public.document_opinions enable row level security;

create policy "Opinion readable by linked users"
  on public.document_opinions for select to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Opinion insertable by linked users"
  on public.document_opinions for insert to authenticated
  with check (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Opinion deletable by linked users"
  on public.document_opinions for delete to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));
