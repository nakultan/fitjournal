// send-streak-nudges
//
// Called once a minute by pg_cron (see the schedule set up in the SQL editor
// during deployment). Fetches every push subscription whose local time-of-day
// matches its `reminder_time` via the `subs_due_now()` SECURITY DEFINER
// function, then sends a Web Push to each.
//
// Subscriptions that return 404/410 (the browser unsubscribed) are pruned
// from the table so the list doesn't grow stale.
//
// Deployed with `--no-verify-jwt` so the cron call doesn't need to pass a
// JWT. The function reads no user-supplied input, sends only the literal
// payload `{"type":"streak"}` to every due endpoint, and the on-device
// service worker decides what copy to show (logged-today vs not). Daily
// workout state stays on the device — the server only knows when to ping.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import webpush from 'https://esm.sh/web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

type Sub = {
  endpoint: string
  p256dh: string
  auth: string
}

Deno.serve(async () => {
  const { data, error } = await supabase.rpc('subs_due_now')
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  const subs = (data ?? []) as Sub[]

  const results = await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ type: 'streak' }),
        )
        return 'sent' as const
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', s.endpoint)
          return 'pruned' as const
        }
        console.error('push failed', code, (e as Error).message)
        return 'failed' as const
      }
    }),
  )

  const tally = { sent: 0, pruned: 0, failed: 0 }
  for (const r of results) {
    if (r.status === 'fulfilled') tally[r.value]++
    else tally.failed++
  }
  return Response.json({ checked: subs.length, ...tally })
})
