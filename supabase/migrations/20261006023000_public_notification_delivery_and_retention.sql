-- Zedek Sports public notification delivery and retention
create extension if not exists pg_cron;

alter publication supabase_realtime add table public.user_notifications;

select cron.schedule(
  'zedek-notification-retention',
  '15 3 * * *',
  $$delete from public.user_notifications
    where created_at < now() - interval '30 days'
       or (read_at is not null and read_at < now() - interval '7 days')$$
);
