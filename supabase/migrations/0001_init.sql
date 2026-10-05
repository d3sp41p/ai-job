-- AI Gave Me a Job: схема базы, шаг 2.
-- Запускать целиком в Supabase: SQL Editor -> New query -> вставить -> Run.
-- Можно запускать повторно: ничего не сломает и не удалит.
--
-- Правило: все таблицы закрыты Row Level Security без единой политики.
-- Это значит: браузер (ключи anon/publishable) не может ни читать, ни писать.
-- Пишет и читает только наш сервер секретным ключом (service role).

-- ---------- Устройства и вход ----------
create table if not exists devices (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  ip_hash     text
);

-- одноразовые nonce для «Lock my address» (подпись сообщения)
create table if not exists auth_nonces (
  nonce       text primary key,
  address     text not null,
  expires_at  timestamptz not null,
  used        boolean not null default false
);

create table if not exists wallets (
  address          text primary key,
  display_name     text check (display_name is null or char_length(display_name) <= 20),
  hold_cache       jsonb,
  hold_cached_at   timestamptz,
  tasks_completed  integer not null default 0,
  rank             text not null default 'Intern',
  banned           boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists address_locks (
  address    text not null references wallets(address) on delete cascade,
  device_id  uuid not null references devices(id) on delete cascade,
  signed_at  timestamptz not null default now(),
  primary key (address, device_id)
);

-- какие адреса использовались с какого устройства (лимит 2 адреса в сутки)
create table if not exists device_addresses (
  device_id  uuid not null references devices(id) on delete cascade,
  address    text not null,
  ip_hash    text,
  used_at    timestamptz not null default now()
);
create index if not exists device_addresses_device_idx on device_addresses (device_id, used_at desc);
create index if not exists device_addresses_ip_idx on device_addresses (ip_hash, used_at desc);

-- ---------- Смены ----------
create table if not exists game_sessions (
  id            uuid primary key default gen_random_uuid(),
  wallet        text references wallets(address),          -- null = гость
  device_id     uuid references devices(id),
  ip_hash       text,
  game_id       text not null,
  difficulty    text not null check (difficulty in ('easy','medium','hard')),
  seed          text not null,
  status        text not null default 'active'
                check (status in ('active','finished','failed','expired','abandoned')),
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  finished_at   timestamptz,
  result        jsonb,
  performance   numeric(5,4),
  points        numeric(12,2) not null default 0,
  overtime      boolean not null default false,
  payroll_hour  timestamptz,
  flagged       text                                         -- причина подозрения, для админки
);
create index if not exists game_sessions_wallet_idx on game_sessions (wallet, started_at desc);
create index if not exists game_sessions_device_idx on game_sessions (device_id, started_at desc);
create index if not exists game_sessions_hour_idx on game_sessions (payroll_hour);
-- одна активная смена на адрес
create unique index if not exists game_sessions_one_active_wallet
  on game_sessions (wallet) where status = 'active' and wallet is not null;
-- одна активная смена на устройство
create unique index if not exists game_sessions_one_active_device
  on game_sessions (device_id) where status = 'active';

-- гостевая смена ждёт адрес 15 минут
create table if not exists guest_shifts (
  session_id       uuid primary key default gen_random_uuid(),
  device_id        uuid not null references devices(id) on delete cascade,
  game_session_id  uuid not null references game_sessions(id) on delete cascade,
  expires_at       timestamptz not null,
  redeemed_by      text references wallets(address)
);

-- ---------- Холд ----------
-- каждая проверка баланса, чтобы считать минимум за 24 часа
create table if not exists balance_checks (
  id          bigserial primary key,
  wallet      text not null references wallets(address) on delete cascade,
  checked_at  timestamptz not null default now(),
  balance     numeric(30,6) not null
);
create index if not exists balance_checks_wallet_idx on balance_checks (wallet, checked_at desc);

-- ---------- Зарплата ----------
-- почасовой расчёт; первичный ключ по часу = повторный запуск ничего не делает
create table if not exists payroll_hours (
  hour_start    timestamptz primary key,
  treasury_sol  numeric(20,9),
  slice_sol     numeric(20,9) not null default 0,
  total_points  numeric(14,2) not null default 0,
  settled       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- начислено / выплачено каждому адресу
create table if not exists balances (
  wallet       text primary key references wallets(address) on delete cascade,
  accrued_sol  numeric(20,9) not null default 0 check (accrued_sol >= 0),
  paid_sol     numeric(20,9) not null default 0 check (paid_sol >= 0),
  updated_at   timestamptz not null default now()
);

create table if not exists payouts (
  id            uuid primary key default gen_random_uuid(),
  wallet        text not null references wallets(address),
  amount_sol    numeric(20,9) not null check (amount_sol > 0),
  status        text not null default 'pending' check (status in ('pending','paid','failed')),
  batch_id      uuid,
  tx_signature  text,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists payouts_wallet_idx on payouts (wallet, created_at desc);
create index if not exists payouts_status_idx on payouts (status, created_at);
-- не больше одной незавершённой выплаты на адрес: защита от двойной отправки
create unique index if not exists payouts_one_pending
  on payouts (wallet) where status = 'pending';

-- ---------- Карточки для X ----------
create table if not exists share_cards (
  id          text primary key,
  wallet      text references wallets(address) on delete cascade,
  kind        text not null check (kind in ('payslip','promotion','resume')),
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

-- ---------- Админка ----------
create table if not exists admin_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
-- аварийный выключатель: по умолчанию выплаты на паузе, пока не включим сами
insert into admin_settings (key, value) values ('payouts_paused', 'true'::jsonb)
  on conflict (key) do nothing;

create table if not exists admin_log (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  actor    text,
  action   text not null,
  details  jsonb
);

-- ---------- Защита: RLS включён, политик нет, публичные роли без прав ----------
do $$
declare t text;
begin
  foreach t in array array[
    'devices','auth_nonces','wallets','address_locks','device_addresses',
    'game_sessions','guest_shifts','balance_checks','payroll_hours',
    'balances','payouts','share_cards','admin_settings','admin_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke all on all sequences in schema public from anon, authenticated;
-- новые таблицы в будущем тоже закрыты по умолчанию
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- служебная проверка для /api/health
create or replace function health_check() returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'tables', (select count(*) from information_schema.tables
               where table_schema = 'public' and table_name in (
                 'devices','auth_nonces','wallets','address_locks','device_addresses',
                 'game_sessions','guest_shifts','balance_checks','payroll_hours',
                 'balances','payouts','share_cards','admin_settings','admin_log')),
    'rls_off', (select count(*) from pg_tables
                where schemaname = 'public' and rowsecurity = false),
    'payouts_paused', (select value from admin_settings where key = 'payouts_paused')
  );
$$;
revoke execute on function health_check() from anon, authenticated, public;
grant execute on function health_check() to service_role;
