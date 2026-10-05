-- Расписание почасового расчёта: база сама раз в час (в :02) вызывает наш сайт.
-- Запускать в SQL Editor ПОСЛЕ 0004_payroll.sql.
--
-- ВАЖНО: перед запуском замените ВСТАВЬТЕ_CRON_SECRET на значение CRON_SECRET из Vercel
-- (прямо здесь, в SQL Editor). Сохранять этот файл с настоящим секретом в GitHub нельзя.
-- Можно запускать повторно: старое расписание заменится новым.

select cron.unschedule(jobid) from cron.job where jobname = 'hourly-payroll';

select cron.schedule(
  'hourly-payroll',
  '2 * * * *',
  $$
  select net.http_get(
    url := 'https://www.hiredby.fun/api/cron/payroll',
    headers := jsonb_build_object('Authorization', 'Bearer ВСТАВЬТЕ_CRON_SECRET'),
    timeout_milliseconds := 30000
  );
  $$
);

-- Проверка: должна быть одна строка 'hourly-payroll'
select jobname, schedule, active from cron.job;
