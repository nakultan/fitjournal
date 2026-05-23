/**
 * Apple Health bridge. A pure PWA cannot read HealthKit directly — there is
 * no web API — so the data arrives from an Apple Shortcut that reads Health
 * and opens FitJournal with a `?health=<json>` query parameter. This module
 * reads that parameter, and also parses a manually imported JSON file; both
 * go through the same validating parser. The reverse direction —
 * `buildLogWorkoutURL` — opens a companion "log workout" Shortcut.
 */
import type { HealthData, WeightUnit } from '@/data/types'

/** The companion-Shortcut name the user installs to write workouts to Health. */
export const LOG_WORKOUT_SHORTCUT_NAME = 'FitJournalLogWorkout'

/** A finite number, or undefined — rejects NaN, Infinity, strings, null. */
function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Build a HealthData record from a decoded JSON payload. Every field is
 * validated to be a finite number; anything else is dropped silently.
 * Returns null when the payload is not an object or carries no usable value.
 *
 * `source` is recorded for display — a file name, or null for a URL sync.
 */
export function parseHealthPayload(
  input: unknown,
  source: string | null,
): HealthData | null {
  if (input === null || typeof input !== 'object') return null
  const o = input as Record<string, unknown>

  const steps = finiteNumber(o.steps)
  const distanceMi = finiteNumber(o.distanceMi)
  const flightsClimbed = finiteNumber(o.flightsClimbed)
  const activeEnergy = finiteNumber(o.activeEnergy)
  const exerciseMinutes = finiteNumber(o.exerciseMinutes)
  const restingHeartRate = finiteNumber(o.restingHeartRate)
  const bodyMass = finiteNumber(o.bodyMass)
  const sleepHours = finiteNumber(o.sleepHours)

  // Use ?? rather than || so that a real zero counts as a value.
  const hasValue =
    steps ??
    distanceMi ??
    flightsClimbed ??
    activeEnergy ??
    exerciseMinutes ??
    restingHeartRate ??
    bodyMass ??
    sleepHours
  if (hasValue === undefined) return null

  return {
    steps: steps ?? null,
    distanceMi: distanceMi ?? null,
    flightsClimbed: flightsClimbed ?? null,
    activeEnergy,
    exerciseMinutes,
    restingHeartRate,
    bodyMass,
    sleepHours,
    importedAt: new Date().toISOString(),
    fileName: source,
  }
}

/**
 * Read a one-shot health payload from the `?health=` URL parameter, then
 * strip the parameter so a reload or the back button cannot replay a stale
 * import. Returns null in the common case where there is no payload.
 */
export function readHealthFromURL(): HealthData | null {
  let raw: string | null
  try {
    raw = new URLSearchParams(location.search).get('health')
  } catch {
    return null
  }
  if (!raw) return null

  // Strip the parameter immediately — whether or not it parses — so the
  // import can never run twice. The hash (the app's route) is preserved.
  try {
    history.replaceState(null, '', location.pathname + location.hash)
  } catch {
    /* best-effort — a lingering parameter is harmless beyond a re-import */
  }

  try {
    return parseHealthPayload(JSON.parse(raw), null)
  } catch {
    return null
  }
}

/** The shape the log-workout Shortcut receives as JSON text input. */
export interface WorkoutLogPayload {
  date: string
  exerciseCount: number
  totalSets: number
  /** Σ reps × weight, in the user's preferred weight unit. */
  totalVolume: number
  weightUnit: WeightUnit
  cardioMinutes: number
  /** Optional — sent only if the day has a logged body weight. */
  bodyWeight?: number
}

/**
 * Build the URL that opens the companion log-workout Shortcut, passing the
 * day's summary as JSON text input. The Shortcut decides how to turn this
 * into a HealthKit Workout sample. Returns the URL; the caller assigns it
 * to `location.href`. Fails silently on devices without Shortcuts installed.
 */
export function buildLogWorkoutURL(payload: WorkoutLogPayload): string {
  const json = JSON.stringify(payload)
  return `shortcuts://run-shortcut?name=${encodeURIComponent(
    LOG_WORKOUT_SHORTCUT_NAME,
  )}&input=text&text=${encodeURIComponent(json)}`
}
