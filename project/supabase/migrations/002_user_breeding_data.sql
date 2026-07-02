-- User-scoped breeding data (growth logs, inventory, pairings, pest risks)
create table if not exists public.user_breeding_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  growth_entries jsonb not null default '[]'::jsonb,
  species_inventory jsonb not null default '[]'::jsonb,
  pairings jsonb not null default '[]'::jsonb,
  pest_risks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_breeding_data enable row level security;

create policy "Users can select own breeding data"
  on public.user_breeding_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own breeding data"
  on public.user_breeding_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own breeding data"
  on public.user_breeding_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own breeding data"
  on public.user_breeding_data for delete
  using (auth.uid() = user_id);
