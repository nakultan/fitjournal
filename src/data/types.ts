/**
 * FitJournal data model. Everything the app stores on the device.
 * Derived values (PRs, streaks, stats) are NOT stored — see logic.ts.
 */

/** Bumped whenever the saved-data shape changes, so migrations stay safe. */
export const SCHEMA_VERSION = 3

export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'abs'
export type CardioType = 'treadmill' | 'bike' | 'stairmaster'
export type WeightUnit = 'lbs' | 'kg'
export type DistanceUnit = 'miles' | 'km'
/** How the app picks its colour theme — follow the OS, or force one. */
export type ThemePreference = 'system' | 'light' | 'dark'
export type DayName =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday'
export type RecipeTag =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'high-protein'
  | 'meal-prep'
  | 'quick'
  | 'vegetarian'
  | 'post-workout'

export type PageId =
  | 'today'
  | 'progress'
  | 'plan'
  | 'recipes'
  | 'settings'
  | 'session'
  | 'exercise'

/** One logged set — a number of reps at a given weight. */
export interface SetEntry {
  reps: number
  weight: number
}

/** A single strength exercise logged on a given day — one or more sets. */
export interface ExerciseEntry {
  id: string
  name: string
  muscle: MuscleGroup
  sets: SetEntry[]
  notes?: string
}

/** A single cardio session logged on a given day. */
export interface CardioEntry {
  id: string
  type: CardioType
  time: number // minutes
  speed: number
  calories: number
}

/** Everything logged for one calendar day. */
export interface Workout {
  date: string // YYYY-MM-DD
  bodyWeight: number | null
  exercises: ExerciseEntry[]
  cardio: CardioEntry[]
  /** Free-text day note — energy, sleep, soreness, mood. Optional. */
  note?: string
}

/** A planned exercise inside a template or weekly plan (no weight/notes). */
export interface TemplateExercise {
  name: string
  muscle: MuscleGroup
  sets: number
  reps: number
}

/** Colour swatch for a template — drives the dot in Plan's chip strip
 *  (P2.8). Optional with `neutral` as the cycling fallback during migration. */
export type TemplateColor = 'red' | 'blue' | 'green' | 'amber' | 'neutral'

export interface Template {
  id: string
  name: string
  subtitle: string
  exercises: TemplateExercise[]
  /** Swatch shown in Plan's collapsed template strip. */
  color?: TemplateColor
}

export interface PlanDay {
  templateId: string | null
  templateName: string | null
  exercises: TemplateExercise[]
}

/** Optional per-serving nutrition for a recipe — shown as information only. */
export interface RecipeNutrition {
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

export interface Recipe {
  id: string
  name: string
  tags: RecipeTag[]
  prepTime: number
  cookTime: number
  servings: number
  ingredients: string[]
  steps: string[]
  notes: string
  favorite: boolean
  createdAt: string
  /** A downscaled JPEG data-URL (see lib/image.ts); absent when no photo. */
  photo?: string
  /** Per-serving nutrition; every field optional. */
  nutrition?: RecipeNutrition
  /** True when this row was inserted by the install seed (P2.9). The flag
   *  lets the Recipes empty state read "we seeded 3 starters" and disappears
   *  if the user edits or deletes the row. */
  seed?: boolean
}

/** A single serving of a recipe consumed on a given day — the Recipes →
 *  protein-today bridge (P2.10). Stored separately from workouts so it can
 *  be cleared without affecting training history. */
export interface LoggedMeal {
  id: string
  recipeId: string
  /** YYYY-MM-DD. */
  date: string
  servings: number
}

/**
 * Today screen layout: `classic` always renders Body Weight, Cardio form and
 * Day Note in full (the original Phase 1–5 layout). `focused` collapses each
 * to a tappable affordance until used — for power users who want to scroll
 * straight to logging without the density tax.
 */
export type TodayLayout = 'classic' | 'focused'

/** Streak-save nudge (P2.5) — opt-in PWA reminder fired by the device.
 *  Degrades silently when notification permission is denied. */
export interface StreakNudge {
  enabled: boolean
  /** 24-hour `HH:mm` local time. */
  time: string
}

/** How often the backup reminder asks the user to export (P2.5). Drives the
 *  threshold the existing `BackupReminder` already uses. */
export type BackupReminderWeeks = 1 | 2 | 3 | 4

export interface Preferences {
  weightUnit: WeightUnit
  distanceUnit: DistanceUnit
  goalWeight: number
  /** Target number of workouts per week. */
  weeklyGoal: number
  dailyReminder: boolean
  weeklySummary: boolean
  /** Colour theme: follow the OS, or force light / dark. */
  theme: ThemePreference
  /** Default rest-timer length, in seconds, for the in-workout session. */
  restTimerSeconds?: number
  /** True once the user has gone through the first-run welcome modal. */
  firstRunDismissed?: boolean
  /** Today screen density — see TodayLayout. Defaults to `classic`. */
  todayLayout?: TodayLayout
  /** Daily protein target (g) — drives the Recipes "Protein today" bar
   *  (P2.10). Defaults to 140 on migration. */
  dailyProteinGoal?: number
  /** ISO week (e.g. "2026-W21") the user dismissed the Fresh-start strip
   *  on (P2.12). Stored so the strip stays gone for the rest of that week. */
  freshStartDismissedWeek?: string
  /** Opt-in streak-save reminder (P2.5). */
  streakNudge?: StreakNudge
  /** Weeks between backup-reminder nudges (P2.5). Defaults to 3. */
  backupReminderWeeks?: BackupReminderWeeks
}

/**
 * A snapshot of Apple Health metrics. The first three fields predate the
 * Shortcut bridge; the rest were added with it (see lib/healthBridge.ts). A
 * field is absent when that metric was not part of the sync.
 */
export interface HealthData {
  steps: number | null
  distanceMi: number | null
  flightsClimbed: number | null
  activeEnergy?: number
  exerciseMinutes?: number
  restingHeartRate?: number
  bodyMass?: number
  sleepHours?: number
  importedAt: string | null
  fileName: string | null
}

/**
 * Per-record sync bookkeeping, kept *beside* the journal in IndexedDB — NOT a
 * field of AppData, so JSON backups/exports stay clean and account-free. Only
 * the sync engine (`data/sync.ts`) reads or writes it.
 */
export interface RecordMeta {
  /** ISO timestamp of the last local change to this record — drives LWW. */
  updatedAt: string
  /** True when the record was deleted locally (a tombstone, so the delete
   *  propagates on the next sync instead of the row resurrecting on pull). */
  deleted?: boolean
}

export interface SyncMeta {
  /** Keyed by a record's sync key, `${kind}:${id}`. */
  records: Record<string, RecordMeta>
  /** High-water mark: the newest `updated_at` seen on the last good pull. */
  lastPulledAt: string | null
}

/** The full saved state. One of these lives in localStorage. */
export interface AppData {
  schemaVersion: number
  workouts: Record<string, Workout>
  templates: Template[]
  weeklyPlan: Partial<Record<DayName, PlanDay>>
  recipes: Recipe[]
  /** Exercise-key (lowercased name) -> target weight. */
  goals: Record<string, number>
  preferences: Preferences
  health: HealthData | null
  /** ISO timestamp of the last backup export, or null if never backed up. */
  lastBackupAt: string | null
  /** Recipe meals logged on a given day (P2.10). Optional — old saves keep
   *  working unchanged. */
  loggedMeals?: LoggedMeal[]
}
