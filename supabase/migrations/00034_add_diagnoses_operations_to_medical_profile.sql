-- Baseline: diagnoses and operations/hospitalizations history
alter table public.medical_profile
  add column diagnoses text[] not null default '{}',
  add column operations_hospitalizations text[] not null default '{}';
