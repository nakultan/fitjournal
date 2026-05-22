/**
 * FitJournal data model. Everything the app stores on the device.
 * Derived values (PRs, streaks, stats) are NOT stored — see logic.ts.
 */

/** Bumped whenever the saved-data shape changes, so migrations stay safe. */
export const SCHEMA_VERSION = 2

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

export type PageId =
  | 'today'
  | 'progress'
  | 'records'
  | 'history'
  | 'plan'
  | 'recipes'
  | 'settings'

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
}

/** A planned exercise inside a template or weekly plan (no weight/notes). */
export interface TemplateExercise {
  name: string
  muscle: MuscleGroup
  sets: number
  reps: number
}

export interface Template {
  id: string
  name: string
  subtitle: string
  exercises: TemplateExercise[]
}

export interface PlanDay {
  templateId: string | null
  templateName: string | null
  exercises: TemplateExercise[]
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
}

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
}

export interface HealthData {
  steps: number | null
  distanceMi: number | null
  flightsClimbed: number | null
  importedAt: string | null
  fileName: string | null
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
}
