-- Structured lifestyle/context layer for diary entries (MVP)
alter table public.diary_entries
  add column lifestyle_context jsonb not null default '{}'::jsonb;
