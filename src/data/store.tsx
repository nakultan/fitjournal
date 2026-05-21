import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppData, PageId, Workout } from './types'
import { StoreContext } from './store-context'
import type { StoreValue } from './store-context'
import { loadData, saveData } from './storage'
import { wouldBeCardioPR, wouldBeStrengthPR } from './logic'
import { todayKey } from '@/lib/dates'
import { uid } from '@/lib/uid'

function emptyWorkout(dateKey: string): Workout {
  return { date: dateKey, bodyWeight: null, exercises: [], cardio: [] }
}

/** Immutably update one day's workout, creating it if needed. */
function withWorkout(data: AppData, dateKey: string, fn: (w: Workout) => Workout): AppData {
  const current = data.workouts[dateKey] ?? emptyWorkout(dateKey)
  return { ...data, workouts: { ...data.workouts, [dateKey]: fn(current) } }
}

/** Holds all app state, persists it to localStorage, exposes actions. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadData)
  const [page, setPage] = useState<PageId>('today')
  const [viewingDateKey, setViewingDateKey] = useState<string>(todayKey)
  const [saveFailed, setSaveFailed] = useState(false)

  // Persist on every change — this is the on-device "database". A failed
  // write (quota, disabled storage) is recorded so the UI can warn the user
  // instead of letting unsaved changes look saved. This setState cannot
  // cascade: the effect depends only on `data`, which it never changes, and
  // a same-value update bails out.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a failed device write must surface in render
    setSaveFailed(!saveData(data))
  }, [data])

  const value: StoreValue = {
    data,
    page,
    viewingDateKey,
    saveFailed,

    navigate: setPage,
    setViewingDateKey,
    viewWorkoutDate: (key) => {
      setViewingDateKey(key)
      setPage('today')
    },

    setBodyWeight: (dateKey, weight) =>
      setData((d) => withWorkout(d, dateKey, (w) => ({ ...w, bodyWeight: weight }))),

    addExercise: (dateKey, entry) => {
      const isPR = wouldBeStrengthPR(data.workouts, entry.name, entry.weight)
      setData((d) =>
        withWorkout(d, dateKey, (w) => ({ ...w, exercises: [...w.exercises, entry] })),
      )
      return isPR
    },
    deleteExercise: (dateKey, id) =>
      setData((d) =>
        withWorkout(d, dateKey, (w) => ({
          ...w,
          exercises: w.exercises.filter((e) => e.id !== id),
        })),
      ),
    restoreExercise: (dateKey, entry, index) =>
      setData((d) =>
        withWorkout(d, dateKey, (w) => {
          const exercises = [...w.exercises]
          exercises.splice(Math.min(Math.max(index, 0), exercises.length), 0, entry)
          return { ...w, exercises }
        }),
      ),
    addCardio: (dateKey, entry) => {
      const isPR = wouldBeCardioPR(data.workouts, entry.type, entry.calories)
      setData((d) => withWorkout(d, dateKey, (w) => ({ ...w, cardio: [...w.cardio, entry] })))
      return isPR
    },
    deleteCardio: (dateKey, id) =>
      setData((d) =>
        withWorkout(d, dateKey, (w) => ({ ...w, cardio: w.cardio.filter((c) => c.id !== id) })),
      ),
    restoreCardio: (dateKey, entry, index) =>
      setData((d) =>
        withWorkout(d, dateKey, (w) => {
          const cardio = [...w.cardio]
          cardio.splice(Math.min(Math.max(index, 0), cardio.length), 0, entry)
          return { ...w, cardio }
        }),
      ),
    loadTemplateIntoDay: (dateKey, template) =>
      setData((d) =>
        withWorkout(d, dateKey, (w) => ({
          ...w,
          exercises: [
            ...w.exercises,
            ...template.exercises.map((te) => ({
              id: uid(),
              name: te.name,
              muscle: te.muscle,
              sets: te.sets,
              reps: te.reps,
              weight: 0,
            })),
          ],
        })),
      ),
    loadPlanIntoDay: (dateKey, day) =>
      setData((d) => {
        const plan = d.weeklyPlan[day]
        if (!plan || plan.exercises.length === 0) return d
        return withWorkout(d, dateKey, (w) => ({
          ...w,
          exercises: [
            ...w.exercises,
            ...plan.exercises.map((te) => ({
              id: uid(),
              name: te.name,
              muscle: te.muscle,
              sets: te.sets,
              reps: te.reps,
              weight: 0,
            })),
          ],
        }))
      }),

    saveTemplate: (template) =>
      setData((d) => {
        const exists = d.templates.some((t) => t.id === template.id)
        const templates = exists
          ? d.templates.map((t) => (t.id === template.id ? template : t))
          : [...d.templates, template]
        return { ...d, templates }
      }),
    deleteTemplate: (id) =>
      setData((d) => ({ ...d, templates: d.templates.filter((t) => t.id !== id) })),

    assignPlanDay: (day, templateId) =>
      setData((d) => {
        const weeklyPlan = { ...d.weeklyPlan }
        if (!templateId) {
          delete weeklyPlan[day]
        } else {
          const t = d.templates.find((x) => x.id === templateId)
          if (t) {
            weeklyPlan[day] = {
              templateId: t.id,
              templateName: t.name,
              exercises: t.exercises.map((e) => ({ ...e })),
            }
          }
        }
        return { ...d, weeklyPlan }
      }),
    addPlanExercise: (day, exercise) =>
      setData((d) => {
        const existing = d.weeklyPlan[day] ?? {
          templateId: null,
          templateName: null,
          exercises: [],
        }
        return {
          ...d,
          weeklyPlan: {
            ...d.weeklyPlan,
            [day]: { ...existing, exercises: [...existing.exercises, exercise] },
          },
        }
      }),
    removePlanExercise: (day, index) =>
      setData((d) => {
        const existing = d.weeklyPlan[day]
        if (!existing) return d
        return {
          ...d,
          weeklyPlan: {
            ...d.weeklyPlan,
            [day]: { ...existing, exercises: existing.exercises.filter((_, i) => i !== index) },
          },
        }
      }),

    saveRecipe: (recipe) =>
      setData((d) => {
        const exists = d.recipes.some((r) => r.id === recipe.id)
        const recipes = exists
          ? d.recipes.map((r) => (r.id === recipe.id ? recipe : r))
          : [recipe, ...d.recipes]
        return { ...d, recipes }
      }),
    deleteRecipe: (id) =>
      setData((d) => ({ ...d, recipes: d.recipes.filter((r) => r.id !== id) })),
    toggleRecipeFavorite: (id) =>
      setData((d) => ({
        ...d,
        recipes: d.recipes.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)),
      })),

    setGoal: (exerciseKey, target) =>
      setData((d) => ({ ...d, goals: { ...d.goals, [exerciseKey]: target } })),
    removeGoal: (exerciseKey) =>
      setData((d) => {
        const goals = { ...d.goals }
        delete goals[exerciseKey]
        return { ...d, goals }
      }),

    savePreferences: (preferences) => setData((d) => ({ ...d, preferences })),
    setHealth: (health) => setData((d) => ({ ...d, health })),
    restoreData: (next) => setData(next),
    markBackedUp: () => setData((d) => ({ ...d, lastBackupAt: new Date().toISOString() })),
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
