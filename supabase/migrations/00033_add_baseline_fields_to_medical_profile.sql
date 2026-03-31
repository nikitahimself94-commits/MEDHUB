-- Baseline fields for medical_profile: demographics, family risk, lifestyle
alter table public.medical_profile
  add column sex text,
  add column birth_date date,
  add column height_cm smallint,
  add column baseline_weight_kg numeric(5,1),
  add column family_risk_categories text[] not null default '{}',
  add column smoking_status text not null default 'unknown',
  add column alcohol_status text not null default 'unknown',
  add column functional_baseline text;

alter table public.medical_profile
  add constraint medical_profile_sex_check
  check (sex is null or sex in ('male', 'female', 'other'));

alter table public.medical_profile
  add constraint medical_profile_smoking_check
  check (smoking_status in ('unknown', 'never', 'former', 'current'));

alter table public.medical_profile
  add constraint medical_profile_alcohol_check
  check (alcohol_status in ('unknown', 'none', 'moderate', 'heavy'));
