-- Add onboarding context to profiles (stores first-step flow answers)
alter table profiles
  add column if not exists onboarding_context jsonb default null;
