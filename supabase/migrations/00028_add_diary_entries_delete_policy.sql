-- Allow linked users to delete their own diary entries
create policy "Diary entries deletable by linked users"
  on public.diary_entries for delete
  to authenticated
  using (
    patient_id in (select patient_id from public.profiles where user_id = auth.uid())
  );
