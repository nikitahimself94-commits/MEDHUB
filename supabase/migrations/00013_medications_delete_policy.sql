create policy "Medications deletable by linked users"
  on public.medications for delete to authenticated
  using (patient_id in (
    select patient_id from public.profiles where user_id = auth.uid()
  ));
