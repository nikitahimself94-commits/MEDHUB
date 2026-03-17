-- Documents: medical document metadata for a patient
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  document_date date not null,
  category text not null default '',
  title text not null,
  doctor text,
  lab text,
  file_url text,
  status text not null default 'normal' check (status in ('normal', 'review', 'abnormal')),
  tags text[] not null default '{}',
  notes text
);

create index documents_patient_created on public.documents (patient_id, created_at desc);

alter table public.documents enable row level security;

create policy "Documents readable by linked users"
  on public.documents for select
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

create policy "Documents insertable by linked users"
  on public.documents for insert
  to authenticated
  with check (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );
