-- Шаг 7: почасовой расчёт зарплат. Запускать целиком в SQL Editor -> New query -> Run.
-- Можно запускать повторно.

alter table payroll_hours add column if not exists workers integer not null default 0;
alter table payroll_hours add column if not exists distributed_sol numeric(20,9) not null default 0;

-- Рассчитать один прошедший час:
--   порция = казна * доля пула / выплат в сутки,
--   каждому = порция * его очки / все очки, но не больше порция * потолок,
--   сумма добавляется в balances.accrued_sol. Остаток остаётся в казне.
-- Идемпотентно: час, у которого settled = true, второй раз не считается.
create or replace function settle_payroll_hour(
  p_hour timestamptz, p_treasury numeric, p_pool_share numeric, p_per_day integer, p_cap numeric
) returns jsonb
language plpgsql security invoker as $$
declare
  v_slice numeric := round(greatest(p_treasury, 0) * p_pool_share / p_per_day, 9);
  v_done boolean;
  v_total numeric;
  v_workers integer;
  v_paid numeric;
begin
  if p_hour <> date_trunc('hour', p_hour) or p_hour >= date_trunc('hour', now()) then
    return jsonb_build_object('ok', false, 'error', 'hour_not_over');
  end if;

  insert into payroll_hours (hour_start, treasury_sol, slice_sol)
    values (p_hour, p_treasury, v_slice)
    on conflict (hour_start) do nothing;
  select settled into v_done from payroll_hours where hour_start = p_hour for update;
  if v_done then
    return jsonb_build_object('ok', true, 'already', true, 'hour', p_hour);
  end if;

  with pts as (
    select g.wallet, sum(g.points) as p
    from game_sessions g
    join wallets w on w.address = g.wallet
    where g.payroll_hour = p_hour and g.points > 0 and not w.banned
    group by g.wallet
  ), tot as (
    select coalesce(sum(p), 0) as t, count(*) as c from pts
  ), pay as (
    select pts.wallet, round(least(v_slice * pts.p / tot.t, v_slice * p_cap), 9) as amt
    from pts, tot where tot.t > 0
  ), ins as (
    insert into balances (wallet, accrued_sol)
      select wallet, amt from pay where amt > 0
    on conflict (wallet) do update
      set accrued_sol = balances.accrued_sol + excluded.accrued_sol, updated_at = now()
    returning 1
  )
  select (select t from tot), (select c from tot), (select coalesce(sum(amt), 0) from pay)
    into v_total, v_workers, v_paid;

  update payroll_hours set
    treasury_sol = p_treasury, slice_sol = v_slice, total_points = v_total,
    workers = v_workers, distributed_sol = v_paid, settled = true
  where hour_start = p_hour;

  return jsonb_build_object('ok', true, 'hour', p_hour, 'slice', v_slice, 'points', v_total,
                            'workers', v_workers, 'distributed', v_paid);
end $$;

revoke execute on function settle_payroll_hour(timestamptz, numeric, numeric, integer, numeric) from anon, authenticated, public;
grant execute on function settle_payroll_hour(timestamptz, numeric, numeric, integer, numeric) to service_role;

-- Для запуска по расписанию из самой базы (см. supabase/cron_payroll.sql)
create extension if not exists pg_cron;
create extension if not exists pg_net;
