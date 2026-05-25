import { createContext, useContext } from 'react'
import type {
  AppData,
  CardioEntry,
  DayName,
  ExerciseEntry,
  HealthData,
  PageId,
  Preferences,
  Recipe,
  Template,
  TemplateExercise,
} from './types'
import type { ProgressSection, SettingsSection } from '@/lib/router'

/** Everything a component can read and do with app state. */
export interface StoreValue {
  data: AppData
  page: PageId
  viewingDateKey: string
  /** The exercise the Exercise Detail screen is viewing, or undefined. */
  viewingExerciseKey?: string
  /** When Settings is active, the sub-section (preferences / data / health / about);
   *  undefined means the Settings cards index. */
  viewingSettingsSection?: SettingsSection
  /** When Progress is active, the active room (story / records / history). */
  viewingProgressSection?: ProgressSection
  /** True when the most recent write to device storage failed. */
  saveFailed: boolean
  /** Timestamp (Date.now()) of the last successful save; 0 before first save. */
  lastSavedAt: number

  // navigation
  navigate: (page: PageId) => void
  setViewingDateKey: (key: string) => void
  viewWorkoutDate: (key: string) => void
  /** Enter the in-workout session screen for today. */
  startSession: () => void
  /** Open the per-exercise progression detail by lowercased name key. */
  viewExercise: (key: string) => void
  /** Open a specific Settings sub-section by hash route; null returns to the cards index. */
  viewSettings: (section: SettingsSection | null) => void
  /** Switch to a Progress room (story / records / history). */
  viewProgress: (section: ProgressSection) => void

  // workouts — `addExercise` / `addCardio` return true if a PR was set;
  // `restore*` re-insert a deleted entry at its original index (for undo);
  // `update*` replace an existing entry, matched by its id
  setBodyWeight: (dateKey: string, weight: number | null) => void
  /** Set (or clear, via empty string) the day-level journal note. */
  setDayNote: (dateKey: string, note: string) => void
  addExercise: (dateKey: string, entry: ExerciseEntry) => boolean
  updateExercise: (dateKey: string, entry: ExerciseEntry) => void
  deleteExercise: (dateKey: string, id: string) => void
  restoreExercise: (dateKey: string, entry: ExerciseEntry, index: number) => void
  /** Move an exercise within the day by index. No-op for invalid indices. */
  reorderExercise: (dateKey: string, fromIndex: number, toIndex: number) => void
  addCardio: (dateKey: string, entry: CardioEntry) => boolean
  updateCardio: (dateKey: string, entry: CardioEntry) => void
  deleteCardio: (dateKey: string, id: string) => void
  restoreCardio: (dateKey: string, entry: CardioEntry, index: number) => void
  loadTemplateIntoDay: (dateKey: string, template: Template) => void
  /** Load the weekly plan's exercises for `day` into that date's workout. */
  loadPlanIntoDay: (dateKey: string, day: DayName) => void

  // templates
  saveTemplate: (template: Template) => void
  deleteTemplate: (id: string) => void
  restoreTemplate: (template: Template, index: number) => void

  // weekly plan
  assignPlanDay: (day: DayName, templateId: string | null) => void
  addPlanExercise: (day: DayName, exercise: TemplateExercise) => void
  removePlanExercise: (day: DayName, index: number) => void

  // recipes
  saveRecipe: (recipe: Recipe) => void
  deleteRecipe: (id: string) => void
  restoreRecipe: (recipe: Recipe, index: number) => void
  toggleRecipeFavorite: (id: string) => void

  // logged meals (P2.10 protein bridge)
  /** Log one serving of a recipe consumed on `date`. Returns the new entry's id. */
  addLoggedMeal: (recipeId: string, date: string, servings?: number) => string
  /** Remove a logged meal by id. */
  removeLoggedMeal: (id: string) => void

  // goals
  setGoal: (exerciseKey: string, target: number) => void
  removeGoal: (exerciseKey: string) => void

  // settings
  savePreferences: (preferences: Preferences) => void
  setHealth: (health: HealthData) => void
  /** Replace the entire app state — used to restore a backup file. */
  restoreData: (data: AppData) => void
  /** Record that the user has just exported a backup. */
  markBackedUp: () => void
}

export const StoreContext = createContext<StoreValue | null>(null)

/** Read app state + actions. Must be used inside <StoreProvider>. */
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>')
  return ctx
}
