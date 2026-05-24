import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppData, Workout } from './types'
import { StoreContext } from './store-context'
import type { StoreValue } from './store-context'
import { loadData, requestPersistentStorage, saveData } from './storage'
import { cardioMetric, topSetWeight, wouldBeCardioPR, wouldBeStrengthPR } from './logic'
import { readHealthFromURL } from '@/lib/healthBridge'
import { navigateTo, useRoute } from '@/lib/router'
import { uid } from '@/lib/uid'
import { applyTheme } from '@/lib/theme'

function emptyWorkout(dateKey: string): Workout {
  return { date: dateKey, bodyWeight: null, exercises: [], cardio: [] }
}

/** Immutably update one day's workout, creating it if needed. */
function withWorkout(data: AppData, dateKey: string, fn: (w: Workout) => Workout): AppData {
  const current = data.workouts[dateKey] ?? emptyWorkout(dateKey)
  return { ...data, workouts: { ...data.workouts, [dateKey]: fn(current) } }
}

/** Trailing-debounce window for persistence — coalesces a burst of edits
 *  (e.g. each keystroke in the body-weight field) into one device write. */
const SAVE_DEBOUNCE_MS = 400

/**
 * Loads the on-device journal — which lives in IndexedDB, so the load is
 * async — and mounts the live store once it is ready. The brief wait shows
 * nothing over the app's black background, so there is no flash.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [initialData, setInitialData] = useState<AppData | null>(null)

  useEffect(() => {
    let cancelled = false
    void requestPersistentStorage()
    void loadData().then((loaded) => {
      if (cancelled) return
      // A companion Apple Shortcut can hand Health data to the app via a
      // `?health=` URL parameter; merge it into the loaded data on the very
      // first paint so it lands in state without a follow-up render. The
      // helper strips the parameter so a reload cannot replay a stale import.
      const urlHealth = readHealthFromURL()
      setInitialData(urlHealth ? { ...loaded, health: urlHealth } : loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!initialData) return null
  return <StoreReady initialData={initialData}>{children}</StoreReady>
}

/** Holds all app state, persists it to the device, exposes actions. */
function StoreReady({ initialData, children }: { initialData: AppData; children: ReactNode }) {
  const [data, setData] = useState<AppData>(initialData)
  const route = useRoute()
  const [saveFailed, setSaveFailed] = useState(false)
  const latestData = useRef(data)

  // Persist on change, debounced — a burst of edits becomes one write
  // rather than re-serialising the whole journal on every keystroke. A
  // failed write is recorded so the UI can warn the user instead of
  // letting unsaved changes look saved.
  useEffect(() => {
    latestData.current = data
    const timer = setTimeout(() => {
      void saveData(data).then((ok) => setSaveFailed(!ok))
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [data])

  // Keep the document's colour theme in sync with the preference.
  useEffect(() => {
    applyTheme(data.preferences.theme)
  }, [data.preferences.theme])

  // Flush the pending debounced write immediately when the app is hidden or
  // closed, so a recent change cannot be lost if the OS reclaims the tab.
  useEffect(() => {
    const flush = () => {
      void saveData(latestData.current).then((ok) => setSaveFailed(!ok))
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  const value: StoreValue = {
    data,
    page: route.page,
    viewingDateKey: route.date,
    viewingExerciseKey: route.exerciseKey,
    saveFailed,

    navigate: (page) => navigateTo(page),
    setViewingDateKey: (key) => navigateTo('today', key),
    viewWorkoutDate: (key) => navigateTo('today', key),
    startSession: () => navigateTo('session'),
    viewExercise: (key) => navigateTo('exercise', undefined, key),

    setBodyWeight: (dateKey, weight) =>
      setData((d) => withWorkout(d, dateKey, (w) => ({ ...w, bodyWeight: weight }))),

    setDayNote: (dateKey, note) =>
      setData((d) =>
        withWorkout(d, dateKey, (w) => {
          const trimmed = note.trim()
          if (!trimmed) {
            const { note: _drop, ...rest } = w
            void _drop
            return rest
          }
          return { ...w, note: trimmed }
        }),
      ),

    addExercise: (dateKey, entry) => {
      const isPR = wouldBeStrengthPR(data.workouts, entry.name, topSetWeight(entry))
      setData((d) =>
        withWorkout(d, dateKey, (w) => ({ ...w, exercises: [...w.exercises, entry] })),
      )
      return isPR
    },
    updateExercise: (dateKey, entry) =>
      setData((d) =>
        withWorkout(d, dateKey, (w) => ({
          ...w,
          exercises: w.exercises.map((e) => (e.id === entry.id ? entry : e)),
        })),
      ),
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
    reorderExercise: (dateKey, fromIndex, toIndex) =>
      setData((d) =>
        withWorkout(d, dateKey, (w) => {
          const last = w.exercises.length - 1
          if (
            fromIndex === toIndex ||
            fromIndex < 0 ||
            fromIndex > last ||
            toIndex < 0 ||
            toIndex > last
          ) {
            return w
          }
          const exercises = [...w.exercises]
          const [moved] = exercises.splice(fromIndex, 1)
          exercises.splice(toIndex, 0, moved)
          return { ...w, exercises }
        }),
      ),
    addCardio: (dateKey, entry) => {
      const isPR = wouldBeCardioPR(data.workouts, entry.type, cardioMetric(entry))
      setData((d) => withWorkout(d, dateKey, (w) => ({ ...w, cardio: [...w.cardio, entry] })))
      return isPR
    },
    updateCardio: (dateKey, entry) =>
      setData((d) =>
        withWorkout(d, dateKey, (w) => ({
          ...w,
          cardio: w.cardio.map((c) => (c.id === entry.id ? entry : c)),
        })),
      ),
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
              sets: Array.from({ length: Math.max(1, te.sets) }, () => ({
                reps: te.reps,
                weight: 0,
              })),
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
              sets: Array.from({ length: Math.max(1, te.sets) }, () => ({
                reps: te.reps,
                weight: 0,
              })),
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
    restoreTemplate: (template, index) =>
      setData((d) => {
        const templates = [...d.templates]
        templates.splice(Math.min(Math.max(index, 0), templates.length), 0, template)
        return { ...d, templates }
      }),

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
    restoreRecipe: (recipe, index) =>
      setData((d) => {
        const recipes = [...d.recipes]
        recipes.splice(Math.min(Math.max(index, 0), recipes.length), 0, recipe)
        return { ...d, recipes }
      }),
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
