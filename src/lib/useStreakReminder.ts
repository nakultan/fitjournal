/**
 * Streak-save reminder (P2.5) — fires at the user's chosen time when today
 * isn't logged yet. Runs two delivery channels in parallel:
 *
 *   1. **In-session timer** (always active when enabled + permission granted).
 *      A one-shot `setTimeout` fires at the next `HH:mm`; if today still
 *      isn't logged, shows a notification via the service worker, then
 *      reschedules for the next day. Opening the app after the time has
 *      passed waits until tomorrow, so it never double-fires.
 *   2. **Closed-app via Web Push** (signed-in users only, when
 *      `VITE_VAPID_PUBLIC_KEY` is set). When the toggle flips on, the hook
 *      subscribes to `pushManager` and upserts the subscription into
 *      `push_subscriptions`. A Supabase Edge Function pushes at the chosen
 *      time even when the app is closed; the service worker decides the
 *      copy by reading IndexedDB, so daily workout state never leaves the
 *      device. Signed out (or in a build without VAPID config), only the
 *      in-session channel runs.
 */
import { useEffect, useRef } from 'react'
import { useStore } from '@/data/store-context'
import { isLoggedWorkout } from '@/data/logic'
import { todayKey } from '@/lib/dates'
import { isSyncConfigured, supabase } from '@/lib/supabase'
import { urlBase64ToUint8Array } from '@/lib/vapidKey'
import type { Workout } from '@/data/types'

/** Parse "HH:mm" into hours/minutes; null when malformed or out of range. */
function parseTime(t: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

/** ms from `now` until the next local `h:m` — today if still ahead, else tomorrow. */
function msUntilNext(now: Date, h: number, m: number): number {
  const next = new Date(now)
  next.setHours(h, m, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

/** Show the in-session nudge, preferring the service worker (some mobile
 *  browsers reject the `new Notification` constructor). */
async function fireNudge(body: string): Promise<void> {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const options: NotificationOptions = {
      body,
      tag: 'fj-streak-nudge',
      icon: import.meta.env.BASE_URL + 'pwa-192.png',
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.showNotification('FitJournal', options)
        return
      }
    }
    new Notification('FitJournal', options)
  } catch {
    /* best-effort — notification support varies by browser and context */
  }
}

/**
 * Reconcile the device's push subscription with the user's current
 * preferences. Subscribes (and upserts the `push_subscriptions` row) when
 * the reminder is on AND the user is signed in AND permission is granted;
 * unsubscribes + deletes the row otherwise. Idempotent — safe to call
 * repeatedly (on toggle change, on sign-in / sign-out, on mount).
 */
async function syncPushSubscription(opts: { enabled: boolean; time: string }): Promise<void> {
  if (!isSyncConfigured || !supabase) return
  if (typeof Notification === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return

  // getSession() reads from localStorage — no network call.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  const shouldHaveSub =
    opts.enabled && !!user && Notification.permission === 'granted'

  const existing = await reg.pushManager.getSubscription()

  if (!shouldHaveSub) {
    if (existing) {
      // Best-effort cleanup; ignore failures so we don't leave the
      // subscription half-subscribed on the device.
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', existing.endpoint)
      await existing.unsubscribe().catch(() => undefined)
    }
    return
  }

  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapid) return // build without push set up — in-session channel only

  let sub = existing
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      })
    } catch {
      return // browser refused (permission revoked, unsupported, etc.)
    }
  }

  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!p256dh || !auth) return

  await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh,
        auth,
        reminder_time: opts.time,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
}

export function useStreakReminder(): void {
  const { data } = useStore()
  const nudge = data.preferences.streakNudge
  const enabled = !!nudge?.enabled
  const time = nudge?.time ?? ''

  // Read the latest workouts at fire time without resetting the timer every
  // time a set is logged. Updated in an effect so render stays pure.
  const workoutsRef = useRef<Record<string, Workout>>(data.workouts)
  useEffect(() => {
    workoutsRef.current = data.workouts
  }, [data.workouts])

  // In-session timer — runs whenever the reminder is on, regardless of
  // sign-in state. Closes the loop for users who keep the app open at the
  // chosen time even if push isn't configured.
  useEffect(() => {
    if (!enabled) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const parsed = parseTime(time)
    if (!parsed) return

    let timer: ReturnType<typeof setTimeout>
    const schedule = (): void => {
      timer = setTimeout(() => {
        if (!isLoggedWorkout(workoutsRef.current[todayKey()])) {
          void fireNudge("Don't break your streak — log today's workout in FitJournal.")
        }
        schedule()
      }, msUntilNext(new Date(), parsed.h, parsed.m))
    }
    schedule()
    return () => clearTimeout(timer)
  }, [enabled, time])

  // Closed-app channel — reconciles the push subscription with current
  // preferences whenever the toggle / time changes, AND whenever auth state
  // changes (sign-in subscribes the device; sign-out unsubscribes it).
  useEffect(() => {
    void syncPushSubscription({ enabled, time })
    if (!supabase) return
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncPushSubscription({ enabled, time })
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [enabled, time])
}
