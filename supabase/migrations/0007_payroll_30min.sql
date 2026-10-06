-- Зарплата каждые 30 минут (синхронно с перерывом 30 минут). Запускать целиком в SQL Editor -> Run.
-- Можно запускать повторно. finish_shift / credit_guest_shift / settle_payroll_hour уже берут период из
-- payroll_period(), поэтому достаточно поменять её.

create or replace function payroll_period(t timestamptz) returns timestamptz
language sql immutable as $$
  select date_bin('30 minutes', t, timestamptz '2000-01-01 00:00:00+00')
$$;

-- Ещё не рассчитанные 15-минутные периоды переносим в ближайший 30-минутный (12:15 -> 12:30, 12:00 -> 12:00),
-- чтобы ни одно очко не потерялось при переходе.
update game_sessions g
set payroll_hour = payroll_period(g.payroll_hour + interval '15 minutes')
where g.payroll_hour is not null
  and g.payroll_hour <> payroll_period(g.payroll_hour)
  and not exists (select 1 from payroll_hours p where p.hour_start = g.payroll_hour and p.settled);

-- Расписание: в :02 и :32. Секрет вводить не нужно.
select cron.alter_job(jobid, schedule := '2,32 * * * *') from cron.job where jobname = 'hourly-payroll';
select jobname, schedule, active from cron.job;
