-- Add original file name column
alter table public.documents add column file_name text;

-- DELETE policy for documents table (linked users can delete)
create policy "Documents deletable by linked users"
  on public.documents for delete
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );

-- DELETE policy for storage objects in documents bucket
create policy "Documents files deletable by linked users"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select patient_id::text from public.profiles where user_id = auth.uid()
    )
  );
