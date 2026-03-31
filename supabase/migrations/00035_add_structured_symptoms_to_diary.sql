-- Structured symptoms layer for diary entries (MVP)
alter table public.diary_entries
  add column structured_symptoms jsonb not null default '[]'::jsonb;
