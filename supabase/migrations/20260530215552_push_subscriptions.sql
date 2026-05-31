-- push_subscriptions: per-device Web Push endpoints for the closed-app
-- streak-save reminder. Each row pairs a browser/PWA's push endpoint with
-- the signed-in user, the chosen reminder time, and the user's local
-- timezone. The Edge Function `send-streak-nudges` queries this table once
-- a minute (via pg_cron) and pushes to each subscription whose local time
-- equals its `reminder_time`.
--
-- The on-device service worker decides what *copy* to show — it reads
-- IndexedDB to check whether today is logged. That keeps daily workout
-- state off the server entirely; the only thing stored here is the
-- subscription endpoint + a time-of-day + an IANA timezone.

create table push_subscriptions (
  user_id        uuid        not null references auth.users(id) on delete cascade,
  endpoint       text        primary key,
  p256dh         text        not null,
  auth           text        not null,
  reminder_time  text        not null,           -- 'HH:mm' (24-hour, local)
  timezone       text        not null,           -- IANA, e.g. 'America/Los_Angeles'
  last_seen_at   timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

-- Each user can only see / manage their own subscriptions. The
-- `subs_due_now()` function below runs as `security definer` so the cron
-- job can read every row regardless of these policies.
create policy "own_subs_select" on push_subscriptions
  for select using (auth.uid() = user_id);
create policy "own_subs_insert" on push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "own_subs_update" on push_subscriptions
  for update using (auth.uid() = user_id);
create policy "own_subs_delete" on push_subscriptions
  for delete using (auth.uid() = user_id);

-- Speeds up the cron scheduler's per-minute query.
create index push_subs_due_idx
  on push_subscriptions (timezone, reminder_time);

-- Returns every subscription whose local-time-now matches its
-- `reminder_time`. Called once a minute by the cron job; the Edge Function
-- iterates the rows and pushes a notification to each.
create or replace function subs_due_now()
returns setof push_subscriptions
language sql
security definer
set search_path = public
as $$
  select *
  from push_subscriptions
  where to_char(now() at time zone timezone, 'HH24:MI') = reminder_time
$$;
