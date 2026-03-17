create policy "Medications updatable by linked users"
  on public.medications for update to authenticated
  using (patient_id in (
    select patient_id from public.profiles where user_id = auth.uid()
  ))
  with check (patient_id in (
    select patient_id from public.profiles where user_id = auth.uid()
  ));
