-- Storage bucket for document files (private — access via signed URLs)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false);

-- SELECT: authenticated users can read files belonging to their linked patient
create policy "Documents files readable by linked users"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select patient_id::text from public.profiles where user_id = auth.uid()
    )
  );

-- INSERT: authenticated users can upload files for their linked patient
create policy "Documents files uploadable by linked users"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select patient_id::text from public.profiles where user_id = auth.uid()
    )
  );
