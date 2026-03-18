-- Track when user completed the first-run welcome flow
alter table profiles
  add column if not exists onboarding_completed_at timestamptz default null;
