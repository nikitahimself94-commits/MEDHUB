-- Per-user rotation history for companion template anti-repeat
alter table public.profiles
  add column if not exists companion_rotation_state jsonb default null;
