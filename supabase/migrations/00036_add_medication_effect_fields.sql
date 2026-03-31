-- MVP medication effect tracking: purpose, effect, side effects, therapy changes
alter table public.medications
  add column purpose text not null default '',
  add column effect text not null default '',
  add column side_effects text not null default '',
  add column therapy_changes text not null default '';
