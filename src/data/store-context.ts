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

/** Everything a component can read and do with app state. */
export interface StoreValue {
  data: AppData
  page: PageId
  viewingDateKey: string

  // navigation
  navigate: (page: PageId) => void
  setViewingDateKey: (key: string) => void
  viewWorkoutDate: (key: string) => void

  // workouts — `addExercise` / `addCardio` return true if a PR was set
  setBodyWeight: (dateKey: string, weight: number | null) => void
  addExercise: (dateKey: string, entry: ExerciseEntry) => boolean
  deleteExercise: (dateKey: string, id: string) => void
  addCardio: (dateKey: string, entry: CardioEntry) => boolean
  deleteCardio: (dateKey: string, id: string) => void
  loadTemplateIntoDay: (dateKey: string, template: Template) => void
  /** Load the weekly plan's exercises for `day` into that date's workout. */
  loadPlanIntoDay: (dateKey: string, day: DayName) => void

  // templates
  saveTemplate: (template: Template) => void
  deleteTemplate: (id: string) => void

  // weekly plan
  assignPlanDay: (day: DayName, templateId: string | null) => void
  addPlanExercise: (day: DayName, exercise: TemplateExercise) => void
  removePlanExercise: (day: DayName, index: number) => void

  // recipes
  saveRecipe: (recipe: Recipe) => void
  deleteRecipe: (id: string) => void
  toggleRecipeFavorite: (id: string) => void

  // goals
  setGoal: (exerciseKey: string, target: number) => void
  removeGoal: (exerciseKey: string) => void

  // settings
  savePreferences: (preferences: Preferences) => void
  setHealth: (health: HealthData) => void
  /** Replace the entire app state — used to restore a backup file. */
  restoreData: (data: AppData) => void
}

export const StoreContext = createContext<StoreValue | null>(null)

/** Read app state + actions. Must be used inside <StoreProvider>. */
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>')
  return ctx
}
