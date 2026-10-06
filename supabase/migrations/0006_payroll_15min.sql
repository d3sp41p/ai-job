-- Зарплата каждые 15 минут вместо раза в час. Запускать целиком в SQL Editor -> New query -> Run.
-- Можно запускать повторно. Колонки по-прежнему называются payroll_hour / hour_start,
-- но теперь это начало 15-минутного периода (12:00, 12:15, 12:30, 12:45).

create or replace function payroll_period(t timestamptz) returns timestamptz
language sql immutable as $$
  select date_bin('15 minutes', t, timestamptz '2000-01-01 00:00:00+00')
$$;

create or replace function finish_shift(
  p_id uuid, p_device uuid, p_performance numeric, p_points numeric, p_overtime boolean,
  p_result jsonb, p_flag text, p_count_task boolean
) returns jsonb
language plpgsql security invoker as $$
declare w text; tasks integer;
begin
  update game_sessions set
    status = 'finished', finished_at = now(), performance = p_performance, points = p_points,
    overtime = p_overtime, result = p_result, flagged = p_flag,
    payroll_hour = case when p_points > 0 then payroll_period(now()) else null end
  where id = p_id and device_id = p_device and status = 'active' and expires_at > now()
  returning wallet into w;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  if p_count_task and w is not null then
    update wallets set tasks_completed = tasks_completed + 1 where address = w returning tasks_completed into tasks;
  end if;
  return jsonb_build_object('ok', true, 'tasks_completed', tasks);
end $$;

create or replace function credit_guest_shift(p_id uuid, p_wallet text, p_points numeric, p_overtime boolean, p_count_task boolean)
returns void
language plpgsql security invoker as $$
begin
  update game_sessions set wallet = p_wallet, points = p_points, overtime = p_overtime,
    payroll_hour = case when p_points > 0 then payroll_period(now()) else null end
  where id = p_id and wallet is null;
  if found and p_count_task then
    update wallets set tasks_completed = tasks_completed + 1 where address = p_wallet;
  end if;
end $$;

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
  if p_hour <> payroll_period(p_hour) or p_hour >= payroll_period(now()) then
    return jsonb_build_object('ok', false, 'error', 'period_not_over');
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

revoke execute on function payroll_period(timestamptz) from anon, authenticated, public;
grant execute on function payroll_period(timestamptz) to service_role;

-- Расписание: каждые 15 минут (в :02, :17, :32, :47). Секрет вводить заново не нужно.
select cron.alter_job(jobid, schedule := '2,17,32,47 * * * *') from cron.job where jobname = 'hourly-payroll';
select jobname, schedule, active from cron.job;
