-- Шаг 6: смены на сервере. Запускать целиком в SQL Editor -> New query -> Run.
-- Можно запускать повторно.

-- paid = смена холдера, practice = адрес без монет (без оплаты), guest = гость
alter table game_sessions add column if not exists mode text not null default 'paid';
alter table guest_shifts add column if not exists created_at timestamptz not null default now();
create index if not exists game_sessions_ip_idx on game_sessions (ip_hash, started_at desc);
create index if not exists guest_shifts_device_idx on guest_shifts (device_id, created_at desc);

-- Начать смену. Кулдаун считается от СТАРТА последней смены: по устройству и по адресу.
-- С одной сети (IP) не больше p_ip_max смен за время кулдауна.
create or replace function start_shift(
  p_wallet text, p_device uuid, p_ip text, p_game text, p_difficulty text, p_mode text,
  p_cooldown_seconds integer, p_expires_seconds integer, p_ip_max integer
) returns jsonb
language plpgsql security invoker as $$
declare
  last_start timestamptz;
  ip_count integer;
  new_id uuid;
  started timestamptz;
  cd interval := make_interval(secs => p_cooldown_seconds);
begin
  perform pg_advisory_xact_lock(hashtext('shift:dev:' || p_device::text));
  if p_wallet is not null then
    perform pg_advisory_xact_lock(hashtext('shift:addr:' || p_wallet));
  end if;

  -- брошенные смены закрываем
  update game_sessions set status = 'abandoned'
    where status = 'active' and expires_at < now()
      and (device_id = p_device or (p_wallet is not null and wallet = p_wallet));

  select max(started_at) into last_start from game_sessions
    where device_id = p_device or (p_wallet is not null and wallet = p_wallet);
  if last_start is not null and last_start > now() - cd then
    return jsonb_build_object('ok', false, 'error', 'cooldown', 'cooldown_ends_at', last_start + cd);
  end if;

  select count(*) into ip_count from game_sessions where ip_hash = p_ip and started_at > now() - cd;
  if ip_count >= p_ip_max then
    return jsonb_build_object('ok', false, 'error', 'ip_busy');
  end if;

  insert into game_sessions (wallet, device_id, ip_hash, game_id, difficulty, seed, mode, expires_at)
    values (p_wallet, p_device, p_ip, p_game, p_difficulty, '-', p_mode, now() + make_interval(secs => p_expires_seconds))
    returning id, started_at into new_id, started;
  return jsonb_build_object('ok', true, 'id', new_id, 'started_at', started, 'cooldown_ends_at', started + cd);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'active');
end $$;

-- Закончить смену. Срабатывает ОДИН раз и только для устройства, которое её начало.
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
    payroll_hour = case when p_points > 0 then date_trunc('hour', now()) else null end
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

-- Успешная гостевая смена ждёт адрес. Только первая за p_window_minutes на устройство.
create or replace function hold_guest_shift(p_device uuid, p_session uuid, p_wait_minutes integer, p_window_minutes integer)
returns boolean
language plpgsql security invoker as $$
begin
  perform pg_advisory_xact_lock(hashtext('guest:' || p_device::text));
  if exists (select 1 from guest_shifts where device_id = p_device
             and created_at > now() - make_interval(mins => p_window_minutes)) then
    return false;
  end if;
  insert into guest_shifts (device_id, game_session_id, expires_at)
    values (p_device, p_session, now() + make_interval(mins => p_wait_minutes));
  return true;
end $$;

-- Гостевая смена переходит адресу (вызывается, когда гость вставил адрес)
create or replace function claim_guest_shift(p_device uuid, p_wallet text)
returns jsonb
language plpgsql security invoker as $$
declare gs uuid; s game_sessions%rowtype;
begin
  update guest_shifts set redeemed_by = p_wallet
    where session_id = (
      select session_id from guest_shifts
      where device_id = p_device and redeemed_by is null and expires_at > now()
      order by created_at desc limit 1 for update skip locked)
    returning game_session_id into gs;
  if gs is null then return null; end if;
  select * into s from game_sessions where id = gs;
  return jsonb_build_object('id', s.id, 'game_id', s.game_id, 'difficulty', s.difficulty,
                            'performance', s.performance, 'started_at', s.started_at);
end $$;

create or replace function credit_guest_shift(p_id uuid, p_wallet text, p_points numeric, p_overtime boolean, p_count_task boolean)
returns void
language plpgsql security invoker as $$
begin
  update game_sessions set wallet = p_wallet, points = p_points, overtime = p_overtime,
    payroll_hour = case when p_points > 0 then date_trunc('hour', now()) else null end
  where id = p_id and wallet is null;
  if found and p_count_task then
    update wallets set tasks_completed = tasks_completed + 1 where address = p_wallet;
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'start_shift(text,uuid,text,text,text,text,integer,integer,integer)',
    'finish_shift(uuid,uuid,numeric,numeric,boolean,jsonb,text,boolean)',
    'hold_guest_shift(uuid,uuid,integer,integer)',
    'claim_guest_shift(uuid,text)',
    'credit_guest_shift(uuid,text,numeric,boolean,boolean)'
  ] loop
    execute format('revoke execute on function %s from anon, authenticated, public', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
