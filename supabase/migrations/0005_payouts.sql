-- Шаг 8: автоматические выплаты. Запускать целиком в SQL Editor -> New query -> Run.
-- Можно запускать повторно.

alter table payouts add column if not exists lamports bigint;
alter table payouts add column if not exists last_valid_height bigint; -- после этого блока транзакция уже не пройдёт

-- Выплата подтверждена в сети: payouts -> paid, balances.paid_sol += сумма. Один раз на выплату.
create or replace function mark_payouts_paid(p_ids uuid[])
returns integer
language plpgsql security invoker as $$
declare n integer;
begin
  with done as (
    update payouts set status = 'paid', updated_at = now()
    where id = any(p_ids) and status = 'pending'
    returning wallet, amount_sol
  ), sums as (
    select wallet, sum(amount_sol) as s from done group by wallet
  ), upd as (
    update balances b set paid_sol = b.paid_sol + sums.s, updated_at = now()
    from sums where b.wallet = sums.wallet
    returning 1
  )
  select count(*) into n from done;
  return n;
end $$;

-- Транзакция точно не попала в сеть (blockhash истёк, подписи нет): сумма вернётся в следующую выплату
create or replace function mark_payouts_failed(p_ids uuid[], p_error text)
returns integer
language plpgsql security invoker as $$
declare n integer;
begin
  update payouts set status = 'failed', error = left(p_error, 300), updated_at = now()
  where id = any(p_ids) and status = 'pending';
  get diagnostics n = row_count;
  return n;
end $$;

do $$
declare f text;
begin
  foreach f in array array['mark_payouts_paid(uuid[])', 'mark_payouts_failed(uuid[],text)'] loop
    execute format('revoke execute on function %s from anon, authenticated, public', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
