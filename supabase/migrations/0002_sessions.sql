-- Шаг 5: счётчики rate limit. Запускать целиком в SQL Editor -> New query -> Run.
-- Можно запускать повторно.

create table if not exists rate_limits (
  key           text primary key,
  window_start  timestamptz not null default now(),
  count         integer not null default 0
);
alter table rate_limits enable row level security;
alter table rate_limits force row level security;
revoke all on rate_limits from anon, authenticated;

-- +1 к счётчику ключа; true = ещё в пределах лимита
create or replace function hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security invoker
as $$
declare c integer;
begin
  insert into rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning r.count into c;
  return c <= p_max;
end $$;
revoke execute on function hit_rate_limit(text, integer, integer) from anon, authenticated, public;
grant execute on function hit_rate_limit(text, integer, integer) to service_role;

-- старые счётчики чистим заодно с проверкой здоровья
create or replace function health_check() returns jsonb
language sql volatile security invoker as $$
  with cleanup as (delete from rate_limits where window_start < now() - interval '1 day' returning 1)
  select jsonb_build_object(
    'tables', (select count(*) from information_schema.tables
               where table_schema = 'public' and table_name in (
                 'devices','auth_nonces','wallets','address_locks','device_addresses',
                 'game_sessions','guest_shifts','balance_checks','payroll_hours',
                 'balances','payouts','share_cards','admin_settings','admin_log','rate_limits')),
    'rls_off', (select count(*) from pg_tables
                where schemaname = 'public' and rowsecurity = false),
    'payouts_paused', (select value from admin_settings where key = 'payouts_paused'),
    'cleaned', (select count(*) from cleanup)
  );
$$;
revoke execute on function health_check() from anon, authenticated, public;
grant execute on function health_check() to service_role;
