-- Idempotency keys for scheduled push delivery. Only server-side service-role
-- access is intended; signed-in browser users receive no table privileges.
create table if not exists public.push_delivery_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  delivery_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, delivery_key)
);

alter table public.push_delivery_log enable row level security;
revoke all on public.push_delivery_log from anon, authenticated;
grant all on public.push_delivery_log to service_role;

create index if not exists push_delivery_log_created_at_idx
  on public.push_delivery_log (created_at);
