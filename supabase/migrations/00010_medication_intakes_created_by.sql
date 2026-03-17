alter table public.medication_intakes
  add column created_by uuid references auth.users(id) on delete set null;
