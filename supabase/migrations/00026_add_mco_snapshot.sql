-- MCO v1: Medical Context Object — cached current snapshot in profiles
alter table public.profiles
  add column if not exists mco_snapshot jsonb default null,
  add column if not exists mco_updated_at timestamptz default null;
