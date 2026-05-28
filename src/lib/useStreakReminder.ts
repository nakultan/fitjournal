/**
 * Best-effort streak-save reminder (P2.5).
 *
 * A PWA can't run code while fully closed, and a server-pushed notification
 * would break FitJournal's no-account / no-servers promise — so this fires
 * the chosen-time nudge only while the app is open. It schedules a one-shot
 * timer for the next occurrence of the chosen `HH:mm`; when it fires, if today
 * still isn't logged, it shows the notification, then reschedules for the
 * following day. Opening the app *after* the time has already passed waits
 * until tomorrow, so the reminder never double-fires.
 */
import { useEffect, useRef } from 'react'
import { useStore } from '@/data/store-context'
import { isLoggedWorkout } from '@/data/logic'
import { todayKey } from '@/lib/dates'
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

/** Show the nudge, preferring the service worker (some mobile browsers reject
 *  the `new Notification` constructor) and falling back to it otherwise. */
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
}
