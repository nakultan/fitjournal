-- Schedules the `send-streak-nudges` Edge Function to fire once a minute
-- via pg_cron + pg_net. The function itself decides who gets pushed
-- (via the `subs_due_now()` query) — the cron just keeps the heartbeat
-- ticking.
--
-- `cron.schedule(jobname, ...)` is upsert-by-name, so re-applying this
-- migration in a fresh environment is safe and idempotent.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

select cron.schedule(
  'streak-nudges',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://drpaauafpjiwwffaqyat.functions.supabase.co/send-streak-nudges',
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
  $$
);
