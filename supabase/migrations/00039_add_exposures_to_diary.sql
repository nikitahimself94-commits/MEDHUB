-- Structured triggers/exposures layer for diary entries (MVP)
alter table public.diary_entries
  add column exposures jsonb not null default '[]'::jsonb;
