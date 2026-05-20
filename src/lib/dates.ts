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
