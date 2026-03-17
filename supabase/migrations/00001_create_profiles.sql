-- Profiles table: links auth.users to app profile
-- Role (patient/guardian) is a display attribute only — no permission differences
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role text not null check (role in ('patient', 'guardian')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- All authenticated users have equal access — no role-based restrictions
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update only their own profile
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id);

-- Auto-create profile on signup via trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, role, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'patient'),
    coalesce(new.raw_user_meta_data->>'display_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
