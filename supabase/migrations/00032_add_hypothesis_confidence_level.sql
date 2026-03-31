-- Add confidence_level to hypotheses: low | medium | high
alter table public.hypotheses
  add column confidence_level text not null default 'low';

alter table public.hypotheses
  add constraint hypotheses_confidence_level_check
  check (confidence_level in ('low', 'medium', 'high'));
