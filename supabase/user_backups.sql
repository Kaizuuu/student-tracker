-- One private, versioned Student Tracker backup per authenticated user.
create table if not exists public.user_backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (
    jsonb_typeof(data) = 'object'
    and data ->> 'app' = 'student-tracker'
  ),
  updated_at timestamptz not null default now()
);

alter table public.user_backups enable row level security;

grant select, insert, update, delete on public.user_backups to authenticated;

drop policy if exists "Users can read their own planner backup" on public.user_backups;
create policy "Users can read their own planner backup"
  on public.user_backups for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own planner backup" on public.user_backups;
create policy "Users can create their own planner backup"
  on public.user_backups for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own planner backup" on public.user_backups;
create policy "Users can update their own planner backup"
  on public.user_backups for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own planner backup" on public.user_backups;
create policy "Users can delete their own planner backup"
  on public.user_backups for delete to authenticated
  using ((select auth.uid()) = user_id);
