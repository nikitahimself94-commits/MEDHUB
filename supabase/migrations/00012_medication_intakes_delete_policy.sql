create policy "Intakes deletable by linked users"
  on public.medication_intakes for delete to authenticated
  using (patient_id in (
    select patient_id from public.profiles where user_id = auth.uid()
  ));
