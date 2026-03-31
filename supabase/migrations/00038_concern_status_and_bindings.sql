-- Active concern status: active, paused, resolved
alter table public.active_concerns
  add column status text not null default 'active';

alter table public.active_concerns
  add constraint active_concerns_status_check
  check (status in ('active', 'paused', 'resolved'));

-- Concern bindings: diary, vitals, documents
alter table public.diary_entries
  add column concern_id uuid references public.active_concerns(id) on delete set null;

alter table public.vitals
  add column concern_id uuid references public.active_concerns(id) on delete set null;

alter table public.documents
  add column concern_id uuid references public.active_concerns(id) on delete set null;
