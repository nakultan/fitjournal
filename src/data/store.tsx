import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppData, SyncMeta, Workout } from './types'
import { StoreContext } from './store-context'
import type { StoreValue, SyncState } from './store-context'
import {
  emptySyncMeta,
  loadData,
  loadSyncMeta,
  requestPersistentStorage,
  saveData,
  saveSyncMeta,
} from './storage'
import { stampChanges, synchronize } from './sync'
import { cardioMetric, topSetWeight, wouldBeCardioPR, wouldBeStrengthPR } from './logic'
import { readHealthFromURL } from '@/lib/healthBridge'
import { navigateTo, useRoute } from '@/lib/router'
import { uid } from '@/lib/uid'
import { applyTheme } from '@/lib/theme'
import { supabase, isSyncConfigured } from '@/lib/supabase'

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
  const [initial, setInitial] = useState<{ data: AppData; syncMeta: SyncMeta } | null>(null)

  useEffect(() => {
    let cancelled = false
    void requestPersistentStorage()
    // Load the journal and its sync sidecar together, so the live store mounts
    // with both in hand — no second render to wire sync up.
    void Promise.all([loadData(), loadSyncMeta()]).then(([loaded, meta]) => {
      if (cancelled) return
      // A companion Apple Shortcut can hand Health data to the app via a
      // `?health=` URL parameter; merge it into the loaded data on the very
      // first paint so it lands in state without a follow-up render. The
      // helper strips the parameter so a reload cannot replay a stale import.
      const urlHealth = readHealthFromURL()
      setInitial({
        data: urlHealth ? { ...loaded, health: urlHealth } : loaded,
        syncMeta: meta ?? emptySyncMeta(),
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!initial) return null
  return (
    <StoreReady initialData={initial.data} initialSyncMeta={initial.syncMeta}>
      {children}
    </StoreReady>
  )
}

/** Holds all app state, persists it to the device, exposes actions. */
function StoreReady({
  initialData,
  initialSyncMeta,
  children,
}: {
  initialData: AppData
  initialSyncMeta: SyncMeta
  children: ReactNode
}) {
  const [data, setData] = useState<AppData>(initialData)
  const route = useRoute()
  const [saveFailed, setSaveFailed] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(0)
  const latestData = useRef(data)

  // --- Sync state + bookkeeping --------------------------------------------
  // The sidecar and the "last data we stamped against" live in refs so the
  // store actions never need to know sync exists — we diff prev→next in the
  // save effect below and stamp whatever changed.
  const syncMetaRef = useRef<SyncMeta>(initialSyncMeta)
  const stampedAgainst = useRef<AppData>(initialData)
  const [sync, setSync] = useState<SyncState>({
    configured: isSyncConfigured,
    signedIn: false,
    email: null,
    status: 'idle',
    lastSyncedAt: null,
  })
  // Guards a sync cycle so foreground + online + post-save triggers can't
  // stack concurrent pulls.
  const syncInFlight = useRef(false)
  // Mirrors `sync.signedIn` for the closures that run outside React state.
  const signedInRef = useRef(false)

  // Apply a merged journal from the server without the save effect mistaking
  // pulled records for fresh local edits: point the stamp baseline AND the
  // sidecar at the merged result first, so the ensuing diff is a no-op.
  const applyMerged = useCallback((merged: { data: AppData; meta: SyncMeta }) => {
    syncMetaRef.current = merged.meta
    stampedAgainst.current = merged.data
    latestData.current = merged.data
    void saveSyncMeta(merged.meta)
    setData(merged.data)
  }, [])

  // Run one sync cycle (pull → merge → push). Safe to call from anywhere;
  // no-ops when sync isn't configured or nobody is signed in.
  const syncNow = useCallback(async () => {
    if (!supabase || !signedInRef.current || syncInFlight.current) return
    syncInFlight.current = true
    setSync((s) => ({ ...s, status: 'syncing' }))
    try {
      const result = await synchronize(latestData.current, syncMetaRef.current)
      if (result) {
        applyMerged(result)
        setSync((s) => ({ ...s, status: 'idle', lastSyncedAt: Date.now() }))
      } else {
        setSync((s) => ({ ...s, status: 'idle' }))
      }
    } catch {
      setSync((s) => ({ ...s, status: 'error' }))
    } finally {
      syncInFlight.current = false
    }
  }, [applyMerged])

  // Track the auth session: reflect it in `sync`, and kick a sync on sign-in.
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data: { session } }) => {
      signedInRef.current = Boolean(session)
      setSync((s) => ({ ...s, signedIn: Boolean(session), email: session?.user.email ?? null }))
      if (session) void syncNow()
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      signedInRef.current = Boolean(session)
      setSync((s) => ({
        ...s,
        signedIn: Boolean(session),
        email: session?.user.email ?? null,
        status: session ? s.status : 'idle',
      }))
      if (session) void syncNow()
    })
    return () => listener.subscription.unsubscribe()
  }, [syncNow])

  // Re-sync when the app comes to the foreground or the network returns —
  // the two moments a phone and a laptop are most likely to have diverged.
  useEffect(() => {
    if (!supabase) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    const onOnline = () => void syncNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [syncNow])

  // Persist on change, debounced — a burst of edits becomes one write
  // rather than re-serialising the whole journal on every keystroke. A
  // failed write is recorded so the UI can warn the user instead of
  // letting unsaved changes look saved.
  useEffect(() => {
    latestData.current = data
    // Stamp whatever changed since the last commit into the sync sidecar, so
    // the next sync knows which records this device touched. When the change
    // came from applying a remote merge, `stampedAgainst` already points at
    // this same data, so the diff is empty and nothing is re-stamped.
    if (data !== stampedAgainst.current) {
      const nextMeta = stampChanges(stampedAgainst.current, data, syncMetaRef.current)
      if (nextMeta !== syncMetaRef.current) {
        syncMetaRef.current = nextMeta
        void saveSyncMeta(nextMeta)
      }
      stampedAgainst.current = data
    }
    const timer = setTimeout(() => {
      void saveData(data).then((ok) => {
        setSaveFailed(!ok)
        if (ok) setLastSavedAt(Date.now())
      })
      void syncNow()
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [data, syncNow])

  // Keep the document's colour theme in sync with the preference.
  useEffect(() => {
    applyTheme(data.preferences.theme)
  }, [data.preferences.theme])

  // Flush the pending debounced write immediately when the app is hidden or
  // closed, so a recent change cannot be lost if the OS reclaims the tab.
  useEffect(() => {
    const flush = () => {
      void saveData(latestData.current).then((ok) => {
        setSaveFailed(!ok)
        if (ok) setLastSavedAt(Date.now())
      })
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

  // Send a magic-link sign-in email. On clicking the link the user lands back
  // in the app already authenticated; `onAuthStateChange` then kicks the first
  // sync. Returns a friendly error string, or null on success.
  const signIn = useCallback(async (email: string): Promise<string | null> => {
    if (!supabase) return 'Sync is not configured in this build.'
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    })
    return error ? error.message : null
  }, [])

  // Sign out — stops syncing; the local journal stays on the device exactly as
  // the offline-only app always has.
  const signOut = useCallback(async (): Promise<void> => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const value: StoreValue = {
    data,
    page: route.page,
    viewingDateKey: route.date,
    viewingExerciseKey: route.exerciseKey,
    viewingSettingsSection: route.settingsSection,
    viewingProgressSection: route.progressSection,
    saveFailed,
    lastSavedAt,
    sync,
    signIn,
    signOut,
    syncNow,

    navigate: (page) => navigateTo(page),
    setViewingDateKey: (key) => navigateTo('today', key),
    viewWorkoutDate: (key) => navigateTo('today', key),
    startSession: () => navigateTo('session'),
    viewExercise: (key) => navigateTo('exercise', undefined, key),
    viewSettings: (section) => navigateTo('settings', undefined, undefined, section ?? undefined),
    viewProgress: (section) =>
      navigateTo('progress', undefined, undefined, undefined, section),

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
    reorderTemplate: (fromIndex, toIndex) =>
      setData((d) => {
        const last = d.templates.length - 1
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          fromIndex > last ||
          toIndex < 0 ||
          toIndex > last
        ) {
          return d
        }
        const templates = [...d.templates]
        const [moved] = templates.splice(fromIndex, 1)
        templates.splice(toIndex, 0, moved)
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

    // P2.10 — the protein-today bridge logs servings of a recipe consumed on a
    // given day. The list is intentionally append-only (the bar can show
    // multiple servings of the same recipe), and the id is returned so the
    // caller can wire it up to an Undo affordance.
    addLoggedMeal: (recipeId, date, servings = 1) => {
      const id = uid()
      setData((d) => ({
        ...d,
        loggedMeals: [...(d.loggedMeals ?? []), { id, recipeId, date, servings }],
      }))
      return id
    },
    removeLoggedMeal: (id) =>
      setData((d) => ({
        ...d,
        loggedMeals: (d.loggedMeals ?? []).filter((m) => m.id !== id),
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
