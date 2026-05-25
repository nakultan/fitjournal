import type { DayName } from '@/data/types'

/** Local YYYY-MM-DD key for a date. */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Parse a YYYY-MM-DD key into a local Date at noon (dodges DST edges). */
export function parseKey(key: string): Date {
  return new Date(`${key}T12:00:00`)
}

/** Today's date key. */
export function todayKey(): string {
  return dateKey(new Date())
}

/** A new Date `days` away from `d`. */
export function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

/** e.g. "Tue, May 20, 2026" */
export function formatLong(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** e.g. "May 20" */
export function formatShort(key: string): string {
  return parseKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** The seven weekday names, Monday first. */
export const DAY_NAMES: DayName[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

/** The weekday name for a date (matches the Monday-first DAY_NAMES order). */
export function dayNameOf(d: Date): DayName {
  return DAY_NAMES[(d.getDay() + 6) % 7]
}

/**
 * ISO 8601 week string, e.g. `"2026-W21"`. The ISO week starts on Monday
 * and the first week of the year is the one containing Thursday. Used by
 * the Fresh-start Monday strip (P2.12) to gate "once per week" persistence.
 */
export function isoWeek(d: Date): string {
  // Copy to a UTC date so DST and timezone shifts don't bend the maths.
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  // 1 = Mon, ..., 7 = Sun (ISO).
  const dayOfWeek = u.getUTCDay() || 7
  // Move to the Thursday of the same ISO week, then the year of that
  // Thursday is the ISO-week-numbering year.
  u.setUTCDate(u.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(u.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil((((u.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)
  return `${u.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}
