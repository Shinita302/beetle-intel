-- Beetle records owned by authenticated users
create table if not exists public.beetles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  species text not null default '',
  inventory_counts jsonb not null default '{}'::jsonb,
  larval_growth_track jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists beetles_user_id_idx on public.beetles (user_id);
create index if not exists beetles_created_at_idx on public.beetles (created_at desc);

alter table public.beetles enable row level security;

create policy "Users can select own beetles"
  on public.beetles for select
  using (auth.uid() = user_id);

create policy "Users can insert own beetles"
  on public.beetles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own beetles"
  on public.beetles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own beetles"
  on public.beetles for delete
  using (auth.uid() = user_id);
