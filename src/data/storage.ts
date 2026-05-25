import type { AppData, Preferences, Template } from './types'
import { SCHEMA_VERSION } from './types'
import { uid } from '@/lib/uid'

/**
 * Legacy localStorage key. The journal now lives in IndexedDB (below); this
 * key is still read once — to migrate installs from before that change —
 * and is used as a fallback store when IndexedDB is unavailable.
 */
const STORAGE_KEY = 'fitjournal'

/** IndexedDB home of the journal: one database, one store, one record. */
const DB_NAME = 'fitjournal'
const DB_VERSION = 1
const STORE_NAME = 'journal'
const RECORD_KEY = 'appdata'

const DEFAULT_PREFERENCES: Preferences = {
  weightUnit: 'lbs',
  distanceUnit: 'miles',
  goalWeight: 170,
  weeklyGoal: 4,
  dailyReminder: true,
  weeklySummary: true,
  theme: 'system',
  restTimerSeconds: 120,
}

/** Push / Pull / Legs — the seeded starter templates. Exported so the Plan
 *  empty state can re-seed if the user nukes everything and wants the
 *  starting templates back. */
export function seedPushPullLegs(): Template[] {
  return seedTemplates()
}

/** Push / Pull / Legs — a friendly starting point for a fresh install. */
function seedTemplates(): Template[] {
  return [
    {
      id: uid(),
      name: 'Push Day',
      subtitle: 'Chest, Shoulders, Triceps',
      exercises: [
        { name: 'Bench Press', muscle: 'chest', sets: 4, reps: 10 },
        { name: 'Incline DB Press', muscle: 'chest', sets: 3, reps: 10 },
        { name: 'Overhead Press', muscle: 'shoulders', sets: 3, reps: 8 },
        { name: 'Lateral Raises', muscle: 'shoulders', sets: 3, reps: 15 },
        { name: 'Tricep Pushdown', muscle: 'arms', sets: 3, reps: 12 },
      ],
    },
    {
      id: uid(),
      name: 'Pull Day',
      subtitle: 'Back, Biceps',
      exercises: [
        { name: 'Barbell Row', muscle: 'back', sets: 4, reps: 8 },
        { name: 'Lat Pulldown', muscle: 'back', sets: 3, reps: 10 },
        { name: 'Seated Cable Row', muscle: 'back', sets: 3, reps: 10 },
        { name: 'Face Pulls', muscle: 'shoulders', sets: 3, reps: 15 },
        { name: 'Barbell Curl', muscle: 'arms', sets: 3, reps: 10 },
      ],
    },
    {
      id: uid(),
      name: 'Leg Day',
      subtitle: 'Quads, Hamstrings, Glutes',
      exercises: [
        { name: 'Squat', muscle: 'legs', sets: 4, reps: 8 },
        { name: 'Romanian Deadlift', muscle: 'legs', sets: 3, reps: 10 },
        { name: 'Leg Press', muscle: 'legs', sets: 3, reps: 12 },
        { name: 'Leg Curl', muscle: 'legs', sets: 3, reps: 12 },
        { name: 'Calf Raises', muscle: 'legs', sets: 4, reps: 15 },
      ],
    },
  ]
}

/** A clean starting state. */
export function defaultData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    workouts: {},
    templates: seedTemplates(),
    weeklyPlan: {},
    recipes: [],
    goals: {},
    preferences: { ...DEFAULT_PREFERENCES },
    health: null,
    lastBackupAt: null,
  }
}

/** True for a non-null object value. */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

// --- Schema migrations -----------------------------------------------------

/**
 * Ordered schema migrations. `MIGRATIONS[i]` upgrades a saved journal from
 * schema version `i + 1` to `i + 2`. When the saved-data shape changes:
 *
 *   1. bump `SCHEMA_VERSION` in `types.ts`;
 *   2. append one step here that reshapes the previous version's data.
 *
 * `migrate()` then walks any old save — or old *backup file* — up the chain
 * before it is normalised, so the stamped `schemaVersion` is always honest
 * and a backup taken on an earlier version stays safely restorable.
 */
const MIGRATIONS: Array<(d: Record<string, unknown>) => Record<string, unknown>> = [
  // v1 → v2: ExerciseEntry changes from a flat { sets, reps, weight } triple to
  // { sets: SetEntry[] }. Each old exercise expands into `sets` identical sets,
  // all carrying the old reps and weight.
  (d) => {
    const workouts = isObject(d.workouts) ? d.workouts : {}
    const migrated: Record<string, unknown> = {}
    for (const [dk, w] of Object.entries(workouts)) {
      if (!isObject(w)) {
        migrated[dk] = w
        continue
      }
      const exercises = Array.isArray(w.exercises) ? w.exercises : []
      migrated[dk] = {
        ...w,
        exercises: exercises.map((e) => {
          if (!isObject(e) || Array.isArray(e.sets)) return e
          const count = typeof e.sets === 'number' ? e.sets : 0
          const reps = typeof e.reps === 'number' ? e.reps : 0
          const weight = typeof e.weight === 'number' ? e.weight : 0
          return {
            id: e.id,
            name: e.name,
            muscle: e.muscle,
            sets: Array.from({ length: Math.max(1, count) }, () => ({ reps, weight })),
            ...(e.notes != null ? { notes: e.notes } : {}),
          }
        }),
      }
    }
    return { ...d, workouts: migrated, schemaVersion: 2 }
  },
]

/**
 * Walk parsed data up the migration chain, from its own `schemaVersion` to
 * the current one. Data with no version is treated as the first version.
 */
function migrate(input: unknown): Partial<AppData> {
  let working: Record<string, unknown> = isObject(input) ? { ...input } : {}
  let version = typeof working.schemaVersion === 'number' ? working.schemaVersion : 1
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version - 1]
    if (!step) break
    working = step(working)
    version += 1
  }
  return working as Partial<AppData>
}

/**
 * Migrate, then merge possibly-incomplete data onto the defaults — so an
 * older, partial, or just-migrated save still yields a valid AppData.
 */
function normalize(input: unknown): AppData {
  const parsed = migrate(input)
  const base = defaultData()
  return {
    schemaVersion: SCHEMA_VERSION,
    workouts: parsed.workouts ?? base.workouts,
    templates: parsed.templates ?? base.templates,
    weeklyPlan: parsed.weeklyPlan ?? base.weeklyPlan,
    recipes: parsed.recipes ?? base.recipes,
    goals: parsed.goals ?? base.goals,
    preferences: { ...base.preferences, ...(parsed.preferences ?? {}) },
    health: parsed.health ?? base.health,
    lastBackupAt: parsed.lastBackupAt ?? base.lastBackupAt,
  }
}

// --- IndexedDB access ------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null
/** Set once IndexedDB is found to be unusable, so we stop retrying it. */
let idbUnavailable = false

/** Open (once) the IndexedDB database, creating the object store if needed. */
function openDB(): Promise<IDBDatabase> {
  if (idbUnavailable) return Promise.reject(new Error('IndexedDB unavailable'))
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
  dbPromise.catch(() => {
    // A failed open is treated as permanent for this session — fall back to
    // localStorage rather than retrying it on every read and write.
    idbUnavailable = true
    dbPromise = null
  })
  return dbPromise
}

/** Read the single journal record from IndexedDB (null if none yet). */
function idbGet(): Promise<unknown> {
  return openDB().then(
    (db) =>
      new Promise<unknown>((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY)
        req.onsuccess = () => resolve(req.result ?? null)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
      }),
  )
}

/** Write the journal record to IndexedDB; rejects on quota or other failure. */
function idbPut(data: AppData): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put(data, RECORD_KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'))
      }),
  )
}

// --- localStorage fallback -------------------------------------------------

/** Write the journal to localStorage; returns false if the write failed. */
function writeLocalStorage(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (e) {
    console.warn('[fitjournal] could not save data', e)
    return false
  }
}

// --- Public load / save ----------------------------------------------------

/**
 * Load the on-device journal. Prefers IndexedDB — durable and not subject
 * to Safari's 7-day script-storage cap. On the first run after the
 * IndexedDB switch it migrates an existing localStorage journal across; if
 * IndexedDB is unavailable it falls back to localStorage entirely. Always
 * leaves the chosen store holding a valid, current-shape journal.
 */
export async function loadData(): Promise<AppData> {
  // 1. Preferred path — read from IndexedDB.
  try {
    const stored = await idbGet()
    if (stored !== null && stored !== undefined) {
      const data = normalize(stored)
      // If a schema migration reshaped it, persist the upgrade so it is
      // durable and never has to run again.
      if (!isObject(stored) || stored.schemaVersion !== data.schemaVersion) {
        await idbPut(data).catch(() => {
          /* the upgrade write is best-effort — the next save will retry */
        })
      }
      return data
    }
  } catch {
    /* IndexedDB unavailable — fall through to the localStorage path */
  }

  // 2. IndexedDB is empty (or unavailable). Migrate a legacy localStorage
  //    journal if one exists; otherwise start from a clean slate.
  let data: AppData
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    data = raw ? normalize(JSON.parse(raw)) : defaultData()
  } catch {
    data = defaultData()
  }

  // 3. Seed the journal into IndexedDB. On success, retire the localStorage
  //    copy so it cannot go stale; if IndexedDB cannot be reached, keep
  //    localStorage as the live fallback store.
  try {
    await idbPut(data)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* clearing the migrated copy is best-effort */
    }
  } catch {
    writeLocalStorage(data)
  }
  return data
}

/**
 * Persist the full state to the device. Writes to IndexedDB, falling back
 * to localStorage if that fails. Returns `false` only if *both* fail — so a
 * silent data loss can never look like a successful save.
 */
export async function saveData(data: AppData): Promise<boolean> {
  try {
    await idbPut(data)
    return true
  } catch (e) {
    console.warn('[fitjournal] IndexedDB write failed — falling back to localStorage', e)
    return writeLocalStorage(data)
  }
}

/**
 * Ask the browser to keep this site's storage durable, so it is not evicted
 * under storage pressure or by Safari's 7-day script-storage cap. Best-
 * effort and silent: support varies and no browser prompts for it.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if ('storage' in navigator && typeof navigator.storage.persist === 'function') {
      return await navigator.storage.persist()
    }
  } catch {
    /* best-effort — a denied or unsupported request is harmless */
  }
  return false
}

/**
 * Parse the contents of a backup file into valid AppData. Throws a friendly
 * error if the text isn't valid JSON or isn't a FitJournal backup.
 */
export function importData(raw: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("That file isn't valid JSON — pick a FitJournal backup file.")
  }
  const looksValid =
    isObject(parsed) && isObject(parsed.workouts) && Array.isArray(parsed.templates)
  if (!looksValid) {
    throw new Error("That doesn't look like a FitJournal backup file.")
  }
  return normalize(parsed)
}

/** Serialise everything to a JSON string (used by the backup export). */
export function exportData(data: AppData): string {
  return JSON.stringify(data, null, 2)
}
