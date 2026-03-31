-- Align hypothesis statuses with source of truth: add deprioritized + urgent review needed
alter table public.hypotheses
  drop constraint hypotheses_status_check;

alter table public.hypotheses
  add constraint hypotheses_status_check
  check (status in ('emerging', 'plausible', 'supported', 'weakened', 'deprioritized', 'unresolved', 'urgent review needed'));
