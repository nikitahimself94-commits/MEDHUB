-- AI chat messages: история сообщений чата с агентом
create table public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index ai_chat_messages_patient_date on public.ai_chat_messages (patient_id, created_at asc);

alter table public.ai_chat_messages enable row level security;

create policy "Chat readable by linked users"
  on public.ai_chat_messages for select to authenticated
  using (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));

create policy "Chat insertable by linked users"
  on public.ai_chat_messages for insert to authenticated
  with check (patient_id in (select patient_id from public.profiles where user_id = auth.uid()));
